'use strict';

/** @typedef {import('discord-api-types/rest/v9').RESTPostAPIApplicationCommandsJSONBody} RESTPostAPIApplicationCommandsJSONBody */
/** @typedef {import('../Core').Entry} Core.Entry */
/** @typedef {import('./SQLWrapper')} SQLWrapper */

/**
 * @typedef {object} Cache
 * @property {Function} get
 * @property {Function} set
 */

import Discord from 'discord.js';
import { EventEmitter } from 'events';
import { BotCache } from './Cache.js';
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
        this.cache = new BotCache();

        /** @type {string[]} */
        this.commands = [];
    }

    /**
     * Initialize this module. This happens after the module is loaded for the specific guild.
     * @param {Discord.Guild} guild - Current guild.
     */
    init(guild) {}

    /**
     * @param {Discord.CommandInteraction<"cached">} interaction
     * @param {Discord.TextChannel|Discord.ThreadChannel} channel
     */
    async _interact(interaction, channel) {
        let forcePermit = false;
        if(Util.isMemberAdmin(interaction.member) || interaction.member.id === this.bot.fullAuthorityOverride) {
            forcePermit = true;
        }

        if(!forcePermit && !this.interactionPermitted(interaction, interaction.guild, interaction.member)) {
            await interaction.reply({ content: 'You are not permitted to use this command.', ephemeral: true });
            return;
        }
        await this.incomingInteraction(interaction, interaction.guild, interaction.member, channel);
        return;
    }

    /**
     * Return true if the incoming interaction is allowed, false otherwise.
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @returns {boolean}
     */
    interactionPermitted(interaction, guild, member) { return false; }

    /**
     * Handle incoming interaction.
     * @param {Discord.CommandInteraction<"cached">} interaction 
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {Discord.TextChannel | Discord.ThreadChannel} channel
     */
    async incomingInteraction(interaction, guild, member, channel) {}

    /**
     * @returns {RESTPostAPIApplicationCommandsJSONBody[]|null}
     */
    getSlashCommands() { return null }

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