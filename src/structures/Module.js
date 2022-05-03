'use strict';

/** @typedef {import('../Core').Entry} Core.Entry */
/** @typedef {import('./SQLWrapper')} SQLWrapper */

/**
 * @typedef {object} Cache
 * @property {Function} get
 * @property {Function} set
 */

import Discord from 'discord.js';
import { EventEmitter } from 'events';
import { Util } from './Util.js';

/** Module for use with the bot. Class primarily exists for being extended from. */
export class Module extends EventEmitter {
    /**
     * @name BotModule#bot
     * @type {Core.Entry}
     */

    /**
     * @name BotModule#cache
     * @type {Cache}
     */

    /**
     * @constructor
     * @param {Core.Entry} bot
     */
    constructor(bot) {
        super();

        this.bot = bot;

        const _cache = new Discord.Collection();
        this.cache = {
            /**
             * @param {Discord.Snowflake} guildId - The ID of the guild the cache is saved on.
             * @param {string} propertyName - The name of the property to retrieve.
             * @returns {any} The retrieved item
             */
            get: function(guildId, propertyName) {
                let item = _cache.get(guildId);
                if(!item)
                    return undefined;

                return item[propertyName];
            },
            /**
             * @param {Discord.Snowflake} guildId - The ID of the guild the cache is saved on.
             * @param {string} propertyName - The name of the property to retrieve.
             * @param {any} value - The value to set on the cache.
             */
            set: function(guildId, propertyName, value) {
                let item = _cache.get(guildId);
                if(!item)
                    _cache.set(guildId, {[propertyName]: value})
                else {
                    item[propertyName] = value;
                    _cache.set(guildId, item);
                }
            }
        }

        Object.freeze(this.cache);
    }

    /**
     * Initialize this module. This happens after the module is loaded for the specific guild.
     * @param {Discord.Guild} guild - Current guild.
     */
    init(guild) {}

    /**
     * Called when a message is sent.
     * @param {Discord.Message} message - The message that was sent.
     */
    onMessage(message) {}

    /**
     * Called when a message is sent in DM's.
     * @param {Discord.Message} message - The message that was sent.
     */
    onMessageDM(message) {}

    /**
     * Called when a message is edited.
     * @param {Discord.Message} messageOld - The old message.
     * @param {Discord.Message} messageNew - The new message.
     */
    onMessageUpdate(messageOld, messageNew) {}

    /**
     * Called when a message is deleted.
     * @param {Discord.Message|Discord.PartialMessage} message - The message that was deleted.
     */
    onMessageDelete(message) {}

    /**
     * Called when a member joins.
     * @param {Discord.GuildMember} member - The new member.
     */
    onGuildMemberAdd(member) {}

    /**
     * Called when a member leaves.
     * @param {Discord.GuildMember|Discord.PartialGuildMember} member - The old member.
     */
    onGuildMemberRemove(member) {}

    /**
     * Emitted whenever a reaction is added to a cached message.
     * @param {Discord.MessageReaction | Discord.PartialMessageReaction} messageReaction 
     * @param {Discord.User|Discord.PartialUser} user 
     */
    onMessageReactionAdd(messageReaction, user) {}

    /**
     * Emitted whenever a reaction is added to a cached message.
     * @param {Discord.Presence|null} oldPresence 
     * @param {Discord.Presence} newPresence 
     */
    onPresenceUpdate(oldPresence, newPresence) {}
}