'use strict';

/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('../Core').Entry} Core.Entry */
/** @typedef {import('../structures/Message').Message} Message */

/**
 * @typedef {object} Db.blacklist_users
 * @property {number} id - Primary key
 * @property {Discord.Snowflake} user_id
 */

import { logger } from '../Core.js';
import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { Module } from '../structures/Module.js';
import { Util } from '../structures/Util.js';

export default class Blacklist extends Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);
        this.commands = ['blacklist'];

        this.bot.sql.transaction(async query => {
            await query(`CREATE TABLE IF NOT EXISTS blacklist_users (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL
            )`);
            
            try {
                /** @type {Db.blacklist_users[]} */
                var resultsUsers = (await query(`SELECT * FROM blacklist_users`)).results;
                this.emit('blacklistChanged', resultsUsers);
            } catch {
                this.emit('blacklistChanged', []);
            }
        }).catch(logger.error);
    }

    /**
     * @param {'blacklistChanged'} event
     * @param {(results: Db.blacklist_users[]) => void} listener
     * @returns {this}
     */
    on(event, listener) {
        return super.on(event, listener);
    }

    /** @param {Discord.Guild} guild - Current guild. */
    init(guild) {
        super.init(guild);
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

        const subcommandName = interaction.options.getSubcommand();
        switch(subcommandName) {
        case 'add': {
            let user = interaction.options.getUser('user', true);
            this.action(interaction, true, user.id);
            return;
        }
        case 'remove': {
            let user = interaction.options.getUser('user', true);
            this.action(interaction, false, user.id);
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
            .setName('blacklist')
            .setDescription('[Admin] Prevent a user from using bot commands.')
            .setDefaultMemberPermissions('0')
            .addSubcommand(subcommand => 
                subcommand.setName('add')
                    .setDescription('[Admin] Add a user to the blacklist, preventing them from using commands.')
                    .addUserOption(option =>
                        option.setName('user')
                            .setDescription('The user to add to the blacklist.')
                            .setRequired(true)
                    )
            ).addSubcommand(subcommand => 
                subcommand.setName('remove')
                    .setDescription('[Admin] Remove a user from the blacklist, allowing them use of commands.')
                    .addUserOption(option =>
                        option.setName('user')
                            .setDescription('The user to remove from the blacklist.')
                            .setRequired(true)
                    )
            ).toJSON()
        ]
    }

    /**
     * 
     * @param {Discord.CommandInteraction<"cached">} interaction
     * @param {boolean} add 
     * @param {Discord.Snowflake} user
     */
    action(interaction, add, user) {
        this.bot.sql.transaction(async query => {
            await interaction.deferReply();

            /** @type {Db.blacklist_users|null} */
            var resultUsers = (await query(`SELECT * FROM blacklist_users WHERE user_id = ?`, [user])).results[0];

            if(add) {
                if(resultUsers) {
                    await interaction.editReply('This user is already blacklisted.');
                    return;
                }
                await query(`INSERT INTO blacklist_users (user_id) VALUES (?)`, [user]);
                await interaction.editReply('User blacklisted.');
            }
            else {
                if(!resultUsers) {
                    await interaction.editReply('This user is not blacklisted.');
                    return;
                }
                await query(`DELETE FROM blacklist_users WHERE user_id = ?`, [user]);
                await interaction.editReply('User no longer blacklisted.');
            }

            /** @type {Db.blacklist_users[]} */
            var resultsUsers = (await query(`SELECT * FROM blacklist_users`)).results;
            this.emit('blacklistChanged', resultsUsers);
        }).catch(logger.error)
    }
}