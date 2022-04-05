'use strict';

/** @typedef {import('../Core').Entry} Core.Entry */
/** @typedef {import('../structures/Message').Message} Message */

/**
 * @typedef {object} Db.blacklist_users
 * @property {number} id - Primary key
 * @property {Discord.Snowflake} user_id
 */

import { logger } from '../Core.js';
import Discord from 'discord.js';
import { Module } from '../structures/Module.js';
import { Util } from '../structures/Util.js';

export default class Blacklist extends Module {
    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super(bot);
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
     * Module Function
     * @param {Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext
     * @param {'add' | 'remove'} ext.action - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    land(m, args, arg, ext) {
        let argSnowflake = args[0];
        if(argSnowflake == null)
            return "You must ping the user, or type their ID";

        let snowflake = Util.getSnowflakeFromDiscordPing(argSnowflake);
        if(snowflake == null) {
            return "The provided user ID is not correct";
        }

        switch(ext.action) {
        case 'add':
            action.call(this, m, true, snowflake);
            return;
        case 'remove':
            action.call(this, m, false, snowflake);
            return;
        }
    }
}

/**
 * 
 * @this {Blacklist}
 * @param {Message} m - Message of the user executing the command.
 * @param {boolean} add 
 * @param {Discord.Snowflake} user
 */
function action(m, add, user) {
    this.bot.sql.transaction(async query => {
        /** @type {Db.blacklist_users|null} */
        var resultUsers = (await query(`SELECT * FROM blacklist_users WHERE user_id = ?`, [user])).results[0];

        if(add) {
            if(resultUsers) {
                m.message.reply('This user is already blacklisted.').catch(logger.error);
                return;
            }
            await query(`INSERT INTO blacklist_users (user_id) VALUES (?)`, [user]);
            m.message.reply('User blacklisted.').catch(logger.error);
        }
        else {
            if(!resultUsers) {
                m.message.reply('This user is not blacklisted.').catch(logger.error);
                return;
            }
            await query(`DELETE FROM blacklist_users WHERE user_id = ?`, [user]);
            m.message.reply('User no longer blacklisted.').catch(logger.error);
        }

        /** @type {Db.blacklist_users[]} */
        var resultsUsers = (await query(`SELECT * FROM blacklist_users`)).results;
        this.emit('blacklistChanged', resultsUsers);
    }).catch(logger.error)
}