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
 * @property {MongoWrapper} tdb
 * @property {SQLWrapper} sql
 */


/**
 * @typedef {object} Entry
 * @property {Locale} locale
 * @property {MongoWrapper} tdb
 * @property {SQLWrapper} sql
 * @property {(guildId: Discord.Snowflake, name: string) => Discord.Snowflake | null} getRoleId
 */

/** @type {Core | null} */
var instance = null;

import Discord from 'discord.js';
import { EventEmitter } from 'events';

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
import { MongoWrapper } from './structures/MongoWrapper.js';
import { SQLWrapper } from './structures/SQLWrapper.js';
import { Util } from './structures/Util.js';

export { logger };
export class Core extends EventEmitter {
    constructor() {
        super();

        if(instance != null) return instance;
        instance = this;
        
        logger.silly('I awake from my slumber.');

        /** @type {Data} */ this.data;
        this.firstConnect = true;
        /** @type {checkCommand} */
        this.checkCommand = checkCommand;
        init.bind(this)();
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
            this.data.client.setInterval(guild => {
                try { func(guild) } catch(e) { console.error(e) }
            }, milliseconds, guild);
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
     * @returns {Promise<any>} //TODO
     */
    getModule(base) {
        return new Promise((resolve, reject) => {
            const module = this.data.modules.get(base);
            if(!module) {
                reject("Module " + base.constructor.name + " not found.");
                return;
            }

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

        //If no role definitions have been added to this guild, no point checking.
        let guildRoles = this.data.roles.get(member.guild.id);
        if(guildRoles == null)
            return false;

        let pass = false;
        guildRoles.forEach((roleSnowflake, roleDefName) => {
            //If the command can be executed by a role that the member has, execute the command.
            if(command.authorityLevel.includes(roleDefName) && member.roles.resolve(roleSnowflake)) {
                pass = true;
                return;
            }
        });
        return pass;
    }

    /**
     * Add a usable command to the bot.
     * @param {string | string[]} baseNames - The defining name for the command.
     * @param {string | string[] | null} commandNames - The subname for the command, or an array containing the subname, followed by aliases.
     * @param {string | string[]} categoryNames - The help category this command will be slotted into.
     * @param {string | string[] | null} authorityLevel - The custom bot role ID's that can execute this command. Blank can only be used by Administrators.
     * @param {Command.Callback} callback - The callback to run when this command is executed.
     */
    addCommand(baseNames, commandNames, categoryNames, authorityLevel, callback) { //add a command to the bot
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
}

/**
 * @this {Core}
 */
async function init() {
    logger.info('Looking for auth.json...');
    const auth = await authenticate();
    const client = new Discord.Client({
        partials: ['USER', 'CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'REACTION'],
    });

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
        tdb: new MongoWrapper(),
        sql: new SQLWrapper(auth.sql),
    }
    this.data = data;
    

    client.on("error", (err) => {
        logger.error(err);
    });
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
        
        await data.tdb.createDatabase(null);
        for(const guild of client.guilds.cache.values())
            await data.tdb.createDatabase(guild);

        try {
            await data.sql.create(null);
            for(const guild of client.guilds.cache.values())
                await data.sql.create(guild);
        }
        catch(e) {
            logger.warn("SQL database is offline.");
        }

        const entry = getEntry(data);
        await initModules.bind(this)(entry);
        initModuleEvents.bind(this)();

        this.removeAllCommands();
        this.addCommand("help", "", "misc", "EVERYONE", displayHelp.bind(this));
        this.addCommand("role", "", "core", null, (message, args, arg) => {
            // @ts-ignore
            return /** @type {BotModule} */ (this.data.modules.get(require("./BotCore/modules/Roles.js")))["role"](message, args, arg, {});
        });

        this.emit("ready", entry);
    });

    logger.info('Logging in...');
    await client.login(auth.token);
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
        let embed = new Discord.MessageEmbed({
            //color: 0,
            title: ":information_source: Help",
            footer: {
                text: "Get category help: !help <category> • Get command help: !help <command>"
            }
        });
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

        bm.channel.send('', { embed:embed });
    })().catch(console.error);
}