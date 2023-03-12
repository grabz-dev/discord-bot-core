'use strict';

/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('../Core').Entry} Core.Entry */
/** @typedef {import('../structures/Message').Message} Message */

import { logger } from '../Core.js';
import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { Module } from '../structures/Module.js';
import { Util } from '../structures/Util.js';

export default class Roles extends Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);
        this.commands = ['role'];
    }

    /**
     * @param {'rolesChanged'} event
     * @param {(guild: Discord.Guild) => void} listener
     * @returns {this}
     */
    on(event, listener) {
        return super.on(event, listener);
    }
    
    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS roles_roles (
                            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                            guild_id VARCHAR(64) NOT NULL,
                            name VARCHAR(128) NOT NULL,
                            role_id VARCHAR(64) NOT NULL
                         )`);
        }).then(() => {
            this.emit('rolesChanged', guild);
        }).catch(logger.error);
    }

    /**
     * 
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @returns {boolean}
     */
    interactionPermitted(interaction, guild, member) {
        return false;
    }

    /**
     * 
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {Discord.TextChannel | Discord.ThreadChannel} channel
     */
    async incomingInteraction(interaction, guild, member, channel) {
        if(!interaction.isChatInputCommand()) return;
        
        const commandName = interaction.commandName;
        switch(commandName) {
        case 'role': {
            let name = interaction.options.getString('name', true);
            let role = interaction.options.getMentionable('role', true);

            this.role(interaction, guild, name, role.id);
            return;
        }
        }
    }

    /**
     * 
     * @returns {RESTPostAPIApplicationCommandsJSONBody[]}
     */
    getSlashCommands() {
        return [
            new SlashCommandBuilder()
            .setName('role')
            .setDescription('[Admin] Assign a unique identifier to a role, for use with bot permissions.')
            .setDefaultMemberPermissions('0')
            .addStringOption(option =>
                option.setName('name')
                    .setDescription('The internal name for the role.')
                    .setRequired(true)   
            ).addMentionableOption(option =>
                option.setName('role')
                    .setDescription('The role.')
                    .setRequired(true)
            ).toJSON()
        ]
    }

    /**
     * 
     * @param {Discord.CommandInteraction<"cached">} interaction
     * @param {Discord.Guild} guild
     * @param {string} name
     * @param {Discord.Snowflake} roleId
     */
    role(interaction, guild, name, roleId) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();

            let role = await guild.roles.fetch(roleId).catch(() => {});
            if(!role) {
                await interaction.editReply(this.bot.locale.category('', 'err_role_not_on_server'));
                return;
            }

            /** @type {any[]} */
            let results = (await query(`SELECT name, role_id FROM roles_roles
                                        WHERE guild_id = '${guild.id}' AND name = '${name}'
                                        FOR UPDATE`)).results;
            
            if(results.length > 0) {
                await query(`UPDATE roles_roles SET role_id = '${roleId}'
                             WHERE guild_id = '${guild.id}' AND name = '${name}'`);
            }
            else {
                await query(`INSERT INTO roles_roles (guild_id, name, role_id)
                             VALUES ('${guild.id}', '${name}', '${roleId}')`);
            }

            await interaction.editReply(this.bot.locale.category('roles', 'role_add_success'));
        }).then(() => {
            this.emit('rolesChanged', guild);
        }).catch(logger.error);
    }
}