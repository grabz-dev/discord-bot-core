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
    const modules = this.data.modules;

    client.on('interactionCreate', async interaction => {
        if(!interaction.isCommand()) return;
        if(!interaction.inCachedGuild()) return;
        if(this.blacklist.includes(interaction.member.id)) {
            logger.info(`Blacklisted user ${interaction.member.nickname??interaction.member.user.username}#${interaction.member.user.discriminator} tried to use /${interaction.commandName}`);
            await interaction.reply({ content: "You're not allowed to use this command.", ephemeral: true });
            return;
        }

        if(interaction.guild == null || 
            !(interaction.member instanceof Discord.GuildMember) ||
            !(interaction.channel instanceof Discord.TextChannel || interaction.channel instanceof Discord.ThreadChannel)) {
            await interaction.reply({ content: 'This interaction is unsupported.' });
            return;
        }

        logger.info(`${interaction.member.nickname??interaction.member.user.username}#${interaction.member.user.discriminator} used /${interaction.commandName}`);

        let module = this.slashCommands[interaction.commandName];
        if(module == null) {
            logger.error('Command not registered as module.');
            return;
        }
        else {
            await module._interact(interaction, interaction.channel).catch(logger.error);
        }
    });

    client.on('messageCreate', async message => { //check each message to see if it's a command
        if(message.author.bot) return;
        if(message.type !== Discord.MessageType.Default && message.type !== Discord.MessageType.Reply) return;
        
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
        if(message.channel instanceof Discord.NewsChannel || message.channel instanceof Discord.StageChannel)
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

        /** @type {Discord.GuildMember|null|void} */
        let member = message.member;
        let guild = message.guild;

        if(member == null && guild != null)
            member = await guild.members.fetch(message.author.id).catch(()=>{});

        if(!member || !guild)
            return;

        let m = new Message(message, member, guild, message.channel);

        try {
            this.checkCommand(m);
        } catch(err) {
            logger.error(err);
        }
    });

    client.on('messageUpdate', async (partialOld, partialNew) => {
        try {
            if(partialNew.partial) {
                /** @type {Discord.OmitPartialGroupDMChannel<Discord.Message<boolean>>|Discord.Message<boolean>} */
                var messageNew = await partialNew.fetch();
            }
            else {
                /** @type {Discord.OmitPartialGroupDMChannel<Discord.Message<boolean>>|Discord.Message<boolean>} */
                var messageNew = partialNew;
            }
        } catch(err) {
            logger.error(err);
            return;
        }
    
        if(messageNew.author.bot) return;
        if(messageNew.type !== Discord.MessageType.Default) return;

        try {
            if(partialOld.partial) {
                /** @type {Discord.OmitPartialGroupDMChannel<Discord.Message<boolean>>|Discord.Message<boolean>} */
                var messageOld = await partialOld.fetch();
            }
            else {
                /** @type {Discord.OmitPartialGroupDMChannel<Discord.Message<boolean>>|Discord.Message<boolean>} */
                var messageOld = partialOld;
            }
        } catch(err) {
            logger.error(err);
            return;
        }
    
        if(messageOld.author.bot) return;
        if(messageOld.type !== Discord.MessageType.Default) return;

        try {
            for(const key of modules.keys()) {
                const module = /** @type {Module} */ (modules.get(key));
                if(typeof module.onMessageUpdate === 'function') {
                    module.onMessageUpdate(messageOld, messageNew);
                }
            }
        } catch(err) { logger.error(err); }
    });

    client.on('messageDelete', async message => {
        if(!message.partial) {
            if(message.author.bot) return;
            if(message.type !== Discord.MessageType.Default) return;
        }

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

    client.on('presenceUpdate', (oldPresence, newPresence) => {
        if(!newPresence.user || newPresence.user.bot) return;
        try {
            for(const key of modules.keys()) {
                const module = /** @type {Module} */ (modules.get(key));
                if(typeof module.onPresenceUpdate === 'function') module.onPresenceUpdate(oldPresence??null, newPresence);
            }
        } catch(e) {
            console.error(e);
        }
    });

    client.on('interactionCreate', interaction => {
        try {
            for(const key of modules.keys()) {
                const module = /** @type {Module} */ (modules.get(key));
                if(typeof module.onInteractionCreate === 'function') module.onInteractionCreate(interaction);
            }
        } catch(e) {
            console.error(e);
        }
    });
}