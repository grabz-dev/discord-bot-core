'use strict';

/**
 * @typedef {(message: Message, args: string[], arg: string, ext: object) => string|void} Command.Callback
 */

/**
 * @typedef {object} Command
 * @property {string[]} baseNames
 * @property {string[]} commandNames
 * @property {string[]} categoryNames
 * @property {string[]} authorityLevel
 * @property {Command.Callback} callback
 */

/**
 * @typedef {object} Data
 * @property {Discord.Client} client
 * @property {{name: Discord.Collection<string, Command[]>, category: Discord.Collection<string, Command[]>}} commands
 * @property {Discord.Collection<typeof Module, Module>} modules
 * @property {Discord.Collection<string, Discord.Collection<string, Discord.Snowflake>>} roles
 * @property {Locale} locale
 * @property {SQLWrapper} sql
 * @property {string} token
 * @property {BotCache} cache
 * @property {Discord.Snowflake} fullAuthorityOverride
 */


/**
 * @typedef {object} Entry
 * @property {Discord.Client} client
 * @property {Locale} locale
 * @property {SQLWrapper} sql
 * @property {(guildId: Discord.Snowflake, name: string) => Discord.Snowflake | null} getRoleId
 * @property {(guild: Discord.Guild) => Promise<void>} refreshGuildSlashCommands
 * 
 * @property {string} token
 * @property {BotCache} cache
 * @property {Discord.Snowflake} fullAuthorityOverride
 */

/** @type {Core | null} */
var instance = null;

import Discord from 'discord.js';
import { EventEmitter } from 'events';

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';

import { authenticate } from './Core/authenticate.js';
import { logger } from './Core/logger.js';
import { getLocale } from './Core/get-locale.js';
import { getEntry } from './Core/get-entry.js';
import { initModules } from './Core/init-modules.js';
import { initModuleEvents } from './Core/init-module-events.js';
import { checkCommand } from './Core/check-command.js';

import { Locale } from './structures/Locale.js';
import { Message } from './structures/Message.js';
import { Module } from './structures/Module.js';
import { SQLWrapper } from './structures/SQLWrapper.js';
import { Util } from './structures/Util.js';
import { BotCache } from './structures/Cache.js';

import Roles from './modules/Roles.js';
import Blacklist from './modules/Blacklist.js';

export { logger };
export class Core extends EventEmitter {
    /**
     * @param {object} opts
     * @param {string} opts.dbName
     * @param {number[]} opts.intents
     * @param {Discord.Snowflake=} opts.errorGuildId
     * @param {Discord.Snowflake=} opts.errorChannelId
     */
    constructor(opts) {
        super();

        this.dbName = opts.dbName;
        this.errorChannelId = opts.errorChannelId??null;
        this.errorGuildId = opts.errorGuildId??null;

        if(instance != null) return instance;
        instance = this;
        
        logger.silly('I awake from my slumber.');

        /** @type {Data} */ this.data;
        this.firstConnect = true;
        /** @type {checkCommand} */
        this.checkCommand = checkCommand;
        /** @type {Discord.Client} */
        this.client;
        /** @type {number[]} */
        this.intents = opts.intents;
        /** @type {Array<Discord.Snowflake>} */
        this.blacklist = [];
        /** @type {{[commandName: string]: Module}} */
        this.slashCommands = {};

        (() => {
            let _error = logger.error;
            /**
             * 
             * @param {any} message 
             */
            logger.error = message => {
                if(this.client && this.errorGuildId != null && this.errorChannelId != null) {
                    this.client.guilds.fetch(this.errorGuildId).then(async guild => {
                        return await guild.channels.fetch(this.errorChannelId??"");
                    }).then(async channel => {
                        if(channel instanceof Discord.TextChannel) await channel.send(JSON.stringify(message));
                    }).catch(console.error);
                }
                return _error(message);
            }
        })();
        
        this.#init.call(this, opts.dbName);
    }
    
    /**
     * @function
     * @variation ready
     * @param {"ready"} event
     * @param {(bot: Entry) => void} listener
     * @returns {this}
    */
    on(event, listener) {
        return super.on(event, listener);
    }

    /**
     * TODO this needs to handle the join guild event too and the calls should be more spread out.
     * @param {number} milliseconds 
     * @param {(guild:Discord.Guild) => void} func
     */
    addLoop(milliseconds, func) {
        for(const guild of this.data.client.guilds.cache.values()) {
            try { func(guild) } catch(e) { console.error(e) }

            // @ts-ignore
            setInterval(guild => {
                try { func(guild) } catch(e) { console.error(e) }
            }, milliseconds, guild);
        }
    }

    /**
     *
     * @param {(guild:Discord.Guild) => void} func
     */
    call(func) {
        for(const guild of this.data.client.guilds.cache.values()) {
            try { func(guild) } catch(e) { console.error(e) }
        }
    }

    /**
     * 
     * @param {any} module
     * @returns {Module | null}
     */
    addModule(module) {
        if(!(module instanceof Module)) {
            logger.error("Attempted to add a non-module as a module.");
            return null;
        }

        this.data.modules.set(/** @type {typeof Module} */ (module.constructor), module);
        return module;
    }

    /**
     * @template {typeof Module} T
     * @param {T} base
     * @returns {Promise<any>}
     * returns {Promise<T[keyof T]>}
     */
    getModule(base) {
        return new Promise((resolve, reject) => {
            const module = this.data.modules.get(base);
            if(!module) {
                reject("Module " + base.constructor.name + " not found.");
                return;
            }

            // @ts-ignore
            resolve(module);
        });
    }

    /**
     * 
     */
    removeAllCommands() {
        this.data.commands.name.clear();
        this.data.commands.category.clear();
    }



    /**
     * 
     * @param {string[]} authorityLevel 
     */
    modifyHelpAuthority(authorityLevel) {
        let c = this.data.commands.name.get("help");
        if(c) c[0].authorityLevel = authorityLevel;
    }

    /**
     * 
     * @param {Discord.GuildMember} member 
     * @param {Command} command 
     * @returns {boolean} If the member can use this command
     */
    canUseCommand(member, command) {
        //Administrators have a full override.
        if(Util.isMemberAdmin(member) || command.authorityLevel.includes("EVERYONE"))
            return true;

        if(this.data.fullAuthorityOverride != null && member.id === this.data.fullAuthorityOverride)
            return true;

        //If no role definitions have been added to this guild, no point checking.
        let guildRoles = this.data.roles.get(member.guild.id);
        if(guildRoles == null)
            return false;

        let pass = false;
        guildRoles.forEach((roleSnowflake, roleDefName) => {
            //If the command can be executed by a role that the member has, execute the command.
            if(command.authorityLevel.includes(roleDefName) && member.roles.cache.get(roleSnowflake)) {
                pass = true;
                return;
            }
        });
        return pass;
    }

    /**
     * Add a usable command to the bot.
     * @param {object} settings - 
     * @param {string | string[]} settings.baseNames - The defining name for the command.
     * @param {string | string[] | null} settings.commandNames - The subname for the command, or an array containing the subname, followed by aliases.
     * @param {string | string[]} settings.categoryNames - The help category this command will be slotted into.
     * @param {string | string[] | null} settings.authorityLevel - The custom bot role ID's that can execute this command. Blank can only be used by Administrators.
     * @param {Command.Callback} callback - The callback to run when this command is executed.
     */
    addCommand(settings, callback) { //add a command to the bot
        let baseNames = settings.baseNames;
        let commandNames = settings.commandNames;
        let categoryNames = settings.categoryNames;
        let authorityLevel = settings.authorityLevel;

        if(typeof baseNames === "string") baseNames = [baseNames];

        if(commandNames == null) commandNames = "";
        if(!(commandNames instanceof Array)) commandNames = [commandNames];

        if(typeof categoryNames === "string") categoryNames = [categoryNames];

        if(authorityLevel == null) authorityLevel = [];
        if(!(authorityLevel instanceof Array)) authorityLevel = [authorityLevel];

        const baseName = baseNames.join(",");

        const command = {
            baseNames: baseNames,
            commandNames: commandNames,
            categoryNames: categoryNames,
            authorityLevel: authorityLevel,
            callback : callback,
        }

        let arr = this.data.commands.name.get(baseName);
        if(arr == null) {
            arr = [];
            this.data.commands.name.set(baseName, arr);
        }
        arr.push(command);

        for(let categoryName of categoryNames) {
            arr = this.data.commands.category.get(categoryName);
            if(arr == null) {
                arr = [];
                this.data.commands.category.set(categoryName, arr);
            }
            arr.push(command);
        }
    }

    /**
     * @param {Discord.Guild} guild 
     */
    async refreshGuildSlashCommands(guild) {
        logger.info(`Refreshing commands for ${guild.name}.`);
        try {
            await (async () => {
                if(this.client.user == null) throw new Error('client.user is null');
                const clientId = this.client.user.id;
                const rest = new REST({ version: '9' }).setToken(this.data.token);
                const commands = [];
                for(const module of this.data.modules.values()) {
                    let slash = module.getSlashCommands();
                    if(slash != null) commands.push(...slash);
                }

                let guildCommands = commands.slice();
                for(const module of this.data.modules.values()) {
                    let slash = await module.getSlashCommandsAsync(guild);
                    guildCommands.push(...slash);
                }

                await rest.put(
                    Routes.applicationGuildCommands(clientId, guild.id),
                    { body: guildCommands },
                );
            })();
        }
        catch(e) {
            logger.warn(`Failed to refresh slash commands for ${guild.name}. Retrying in 1 minute.`);
            logger.error(e);
            setTimeout(() => {
                this.refreshGuildSlashCommands(guild);
            }, 60000);
        }
    }

    /**
     * @param {string} dbName
     */
    async #init(dbName) {
        logger.info('Looking for auth.json...');
        const auth = await authenticate();
        const client = new Discord.Client({
            partials: [Discord.Partials.User, Discord.Partials.Channel, Discord.Partials.GuildMember, Discord.Partials.Message, Discord.Partials.Reaction],
            intents: this.intents,
            allowedMentions: {
                parse: ["users"]
            }
        });
        this.client = client;

        /** @type {Data} */
        const data = {
            client: client,
            commands: {
                name: new Discord.Collection(),
                category: new Discord.Collection
            },
            modules: new Discord.Collection(),
            roles: new Discord.Collection(),
            locale: await (async () => {
                logger.info("Loading strings...");
                return await getLocale();
            })(),
            sql: new SQLWrapper(auth.sql, dbName),
            token: auth.token,
            cache: new BotCache(),
            fullAuthorityOverride: auth.full_authority
        }
        this.data = data;
        
        //client.on("debug", msg => {
        //    logger.info(msg);
        //})
        client.on("error", (err) => {
            logger.error(err);
        });
        client.on("shardError", err => {
            logger.error(err);
        })
        client.on("shardDisconnect", err => {
            logger.info('Disconnected. Reconnecting...');
            setTimeout(() => { client.login(auth.token); }, 1000 * 10);
        })
        client.on("disconnect", () => {
            logger.info('Disconnected. Reconnecting...');
            setTimeout(() => { client.login(auth.token); }, 1000 * 10);
        });
        client.on('ready', async () => {
            if(client.user == null)
                throw 'Failed to connect.';

            if(!this.firstConnect) {
                logger.info(`Successfully reconnected as: ${client.user.username} - (${client.user.id})`);
                return;
            }
            logger.info(`Logged in as: ${client.user.username} - (${client.user.id})`);
            this.firstConnect = false;
            
            await data.sql.init();

            const entry = getEntry(this, data);
            // @ts-ignore
            // todo ts bug
            await initModules.bind(this)(entry);
            initModuleEvents.bind(this)();

            this.removeAllCommands();

            await (async () => {
                for(const guild of Array.from(client.guilds.cache.values())) {
                    await this.refreshGuildSlashCommands(guild);
                    await Util.Promise.sleep(1000);
                }
            })().catch(logger.error);

            this.emit("ready", entry);
        });

        logger.info('Logging in...');
        await client.login(auth.token);
    }
}

/**
 * @this Core
 * @param {Message} bm 
 * @param {string[]} args 
 * @param {string} arg 
 * @param {object} ext
 */
function displayHelp(bm, args, arg, ext) {
    (async () => {
        /** @type {Discord.APIEmbed} */
        let embed = {
            //color: 0,
            title: ":information_source: Help",
            footer: {
                text: "Get category help: !help <category> • Get command help: !help <command>"
            }
        }
        embed.fields = [];

        /** @type {Command[]} */
        const commands = [];
        for(const categoryName of this.data.commands.category) {
            var field = {
                name: categoryName[0],
                value: "",
                inline: false
            }

            categoryName[1].forEach((command, i) => {
                //No repeats
                if(commands.includes(command)) return;
                commands.push(command);

                if(this.canUseCommand(bm.member, command)) {
                    field.value += `\`${command.baseNames[0]}`;
                    if(command.commandNames[0].length > 0)
                        field.value +=  ` ${command.commandNames[0]}`;
                    field.value += '`';
                    field.value += ", ";
                }
            });

            if(field.value.length > 0) {
                field.value = field.value.substring(0, field.value.length - 2);
                embed.fields.push(field);
            }
        }

        bm.channel.send({ embeds: [embed] });
    })().catch(console.error);
}