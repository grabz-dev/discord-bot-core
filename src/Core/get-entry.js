"use strict";

/** @typedef {import('../Core').Entry} Core.Entry */
/** @typedef {import('../Core').Data} Core.Data */

import Discord from 'discord.js';

/**
 * @param {Core.Data} data
 * @returns {Core.Entry}
 */
export function getEntry(data) {
    /** @type {Core.Entry} */
    const entry = Object.freeze({
        client: data.client,
        locale: data.locale,
        sql: data.sql,
        token: data.token,
        fullAuthorityOverride: data.fullAuthorityOverride,
        /**
         * 
         * @param {Discord.Snowflake} guildId 
         * @param {string} name
         * @returns {Discord.Snowflake | null}
         */
        getRoleId: function(guildId, name) {
            let r = data.roles.get(guildId);
            if(r == null)
                return null;
            let id = r.get(name);
            if(id == null)
                return null;
            return id;
        },
    });

    return entry;
}