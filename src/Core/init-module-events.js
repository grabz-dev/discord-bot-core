'use strict';

/** @typedef {import('winston').Logger} winston.Logger */
/** @typedef {import('../Core').Core} Core */
/** @typedef {import('../structures/Module').Module} Module */

import { logger } from '../Core.js';
import Discord from 'discord.js';
import { Message } from '../structures/Message.js';

/**
 * 
 * @this {Core}
 */
export function initModuleEvents() {
    const client = this.data.client;
    const tdb = this.data.tdb;
    const modules = this.data.modules;

    client.on('guildCreate', guild => {
        tdb.createDatabase(guild).then(() => {
            for(const key of modules.keys()) {
                const module = /** @type {Module} */ (modules.get(key));
                if(typeof module.init === 'function') module.init(guild);
            }
        }).catch(logger.error);
    });

    client.on('message', (message) => { //check each message to see if it's a command
        if(message.author.bot) return;
        if(message.type !== 'DEFAULT') return;
        
        if(message.channel instanceof Discord.DMChannel) {
            try {
                for(const key of modules.keys()) {
                    const module = /** @type {Module} */ (modules.get(key));
                    if(typeof module.onMessageDM === 'function') {
                        module.onMessageDM(message);
                    }
                }
            } catch(err) {
                logger.error(err);
            }
            return;
        }
        if(message.channel instanceof Discord.NewsChannel)
            return;
        
        try {
            for(const key of modules.keys()) {
                const module = /** @type {Module} */ (modules.get(key));
                if(typeof module.onMessage === 'function')
                    module.onMessage(message);
            }
        } catch(err) {
            logger.error(err);
        }
        
        //Bot command check follow

        let member = message.member;
        let guild = message.guild;

        if(member == null && guild != null)
            member = guild.members.resolve(message.author.id);

        if(!member || !guild)
            return;

        let m = new Message(message, member, guild, message.channel);

        try {
            this.checkCommand(m);
        } catch(err) {
            logger.error(err);
        }
    });

    client.on('messageUpdate', (messageOld, messageNew) => {
        if(!messageOld.partial && messageOld.author.bot) return;
        if(!messageNew.partial && messageNew.author.bot) return;

        if(messageOld.type && messageOld.type !== 'DEFAULT') return;
        if(messageNew.type && messageNew.type !== 'DEFAULT') return;

        try {
            for(const key of modules.keys()) {
                const module = /** @type {Module} */ (modules.get(key));
                if(typeof module.onMessageUpdate === 'function') {
                    if(messageOld.content === messageNew.content) 
                        module.onMessageUpdate(null, messageNew);
                    else
                        module.onMessageUpdate(messageOld, messageNew);
                }
            }
        } catch(err) {
            logger.error(err);
        }
    });

    client.on('messageDelete', message => {
        if(!message.partial && message.author.bot) return;
        if(message.type && message.type !== 'DEFAULT') return;

        try {
            for(const key of modules.keys()) {
                const module = /** @type {Module} */ (modules.get(key));
                if(typeof module.onMessageDelete === 'function') module.onMessageDelete(message);
            }
        } catch(e) {
            logger.error(e);
        }
    });

    client.on('guildMemberAdd', member => {
        if(member.user.bot) return;
        try {
            for(const key of modules.keys()) {
                const module = /** @type {Module} */ (modules.get(key));
                if(typeof module.onGuildMemberAdd === 'function') module.onGuildMemberAdd(member);
            }
        } catch(e) {
            console.error(e);
        }
    });
    client.on('guildMemberRemove', member => {
        if(member.user && member.user.bot) return;
        try {
            for(const key of modules.keys()) {
                const module = /** @type {Module} */ (modules.get(key));
                if(typeof module.onGuildMemberRemove === 'function') module.onGuildMemberRemove(member);
            }
        } catch(e) {
            console.error(e);
        }
    });

    client.on('messageReactionAdd', (messageReaction, user) => {
        if(user.bot) return;
        try {
            for(const key of modules.keys()) {
                const module = /** @type {Module} */ (modules.get(key));
                if(typeof module.onMessageReactionAdd === 'function') module.onMessageReactionAdd(messageReaction, user);
            }
        } catch(e) {
            console.error(e);
        }
    });
}