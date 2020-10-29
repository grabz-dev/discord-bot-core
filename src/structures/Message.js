'use strict';

import Discord from 'discord.js';

export class Message {
    /**
     * 
     * @param {Discord.Message} message 
     * @param {Discord.GuildMember} member 
     * @param {Discord.Guild} guild 
     * @param {Discord.TextChannel} channel
     */
    constructor(message, member, guild, channel) {
        this.message = message;
        this.member = member;
        this.guild = guild;
        this.channel = channel;
    }
}