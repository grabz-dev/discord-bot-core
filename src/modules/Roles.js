'use strict';

/** @typedef {import('../Core').Entry} Core.Entry */
/** @typedef {import('../structures/Message').Message} Message */

import { logger } from '../Core.js';
import Discord from 'discord.js';
import { Module } from '../structures/Module.js';
import { Util } from '../structures/Util.js';

export default class Roles extends Module {
    /** @param {Core.Entry} bot */
    constructor(bot) {
        super(bot);
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
     * Module Function: Associate a string with a role ID.
     * @param {Message} m - Message of the user executing the command.
     * @param {string[]} args - List of arguments provided by the user delimited by whitespace.
     * @param {string} arg - The full string written by the user after the command.
     * @param {object} ext - Custom parameters provided to function call.
     * @returns {string | void} Nothing if finished correctly, string if an error is thrown.
     */
    role(m, args, arg, ext) {
        let name = args[0];
        if(name == null)
            return this.bot.locale.category('roles', 'err_name_not_provided');

        if(args[1] == null)
            return this.bot.locale.category('', 'err_role_mention_not_provided');

        let snowflake = Util.getSnowflakeFromDiscordPing(args[1]);
        if(snowflake == null)
            return this.bot.locale.category('', 'err_role_mention_not_correct');
            
        let id = snowflake;

        this.bot.sql.transaction(async query => {
            let role = await m.guild.roles.fetch(id).catch(() => {});
            if(!role) {
                m.channel.send(this.bot.locale.category('', 'err_role_not_on_server')).catch(logger.error);
                return;
            }

            /** @type {any[]} */
            let results = (await query(`SELECT name, role_id FROM roles_roles
                                        WHERE guild_id = '${m.guild.id}' AND name = '${name}'
                                        FOR UPDATE`)).results;
            
            if(results.length > 0) {
                await query(`UPDATE roles_roles SET role_id = '${id}'
                             WHERE guild_id = '${m.guild.id}' AND name = '${name}'`);
            }
            else {
                await query(`INSERT INTO roles_roles (guild_id, name, role_id)
                             VALUES ('${m.guild.id}', '${name}', '${id}')`);
            }

            m.channel.send(this.bot.locale.category('roles', 'role_add_success')).catch(logger.error);
        }).then(() => {
            this.emit('rolesChanged', m.guild);
        }).catch(logger.error);
    }
}