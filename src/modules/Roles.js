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
        this.emit('rolesChanged', guild);
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
        if(snowflake == null) {
            return this.bot.locale.category('', 'err_role_mention_not_correct');
        }

        if(!m.guild.roles.resolve(snowflake)) {
            return this.bot.locale.category('', 'err_role_not_on_server');
        }

        this.bot.tdb.session(m.guild, 'roles', async session => {
            await this.bot.tdb.update(session, m.guild, 'roles', 'roles', { upsert: true }, { _id: name }, { _id: name, rid: snowflake });
            this.emit('rolesChanged', m.guild);

            m.channel.send(this.bot.locale.category('roles', 'role_add_success')).catch(logger.error);
        }).catch(logger.error);
    }
}