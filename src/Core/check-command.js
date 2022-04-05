'use strict';

/** @typedef {import('../Core').Core} Core */
/** @typedef {import('../Core').Command} Core.Command */
/** @typedef {import('../structures/Message').Message} Message */

import { logger } from '../Core.js';
import { getCategoryHelpEmbed, getCommandDeniedEmbed, getCommandHelpEmbed } from './embeds.js';

/**
 * @this {Core}
 * @param {Message} m
 * @returns {boolean} true if success, false if failure
 */
export function checkCommand(m) {
    if(this.blacklist.includes(m.member.id)) return false;

    const commandsByName = this.data.commands.name;
    const commandsByCategory = this.data.commands.category;

    let str = m.message.content;
    let isHelp = false;

    let helpCommand = (() => {
        let helpCommands = commandsByName.get("help");
        if(helpCommands)
            return helpCommands.filter(value => value.commandNames[0].length === 0)[0];
    })();

    //Do nothing if the message is not a command.
    if(str.charAt(0) !== '!')
        return false;
    str = m.message.content.substring(1);
    str = str.trimLeft();

    //If we found help somewhere, try removing it on a new string.
    //If a valid category name is found after all thats left, assume the user is querying help for the category.
    //This means we don't really need the rest of this function.
    //Examples: !help exp, !exp help.
    if(str.toLowerCase().indexOf("help") > -1) {
        let categoryName = str.replace("help", "");
        categoryName = categoryName.trim();
        let category = commandsByCategory.get(categoryName);
        if(category && (helpCommand && this.canUseCommand(m.member, helpCommand))) {
            let embed = getCategoryHelpEmbed.bind(this)(m.member, this.data.locale, category);
            if(embed) m.channel.send({ embeds: [embed] }).catch(logger.error);

            return true;
        }
    }

    //If we found help at the beginning, remove it from the command string, and assume it isn't there.
    //If a command is found after that, post its help message.
    if(str.toLowerCase().startsWith("help")) {
        isHelp = true;
        str = str.substring(4);
        str = str.trimLeft();
    }
    
    //Find the base name of the command based on the first expression used.
    /** @type {string|null} */ let baseName = null;
    /** @type {Core.Command[]|null} */ let commandsArr = null;
    for(const names of commandsByName.keys()) {
        for(const name of names.split(",")) {
            if(str.toLowerCase().split(" ")[0] === name) {
                baseName = name;
                commandsArr = commandsByName.get(names) || null;
                break;
            }
        }
        if(baseName != null) break;
    }

    if(baseName == null || commandsArr == null) {
        if(isHelp && str.trim().length === 0) {
            baseName = "help";
            let c = commandsByName.get(baseName);
            if(!c) return false;
            commandsArr = c;
            isHelp = false;
        }
        else return false;
    }

    //Trim the expression and beginning whitespaces from the string.
    str = str.substring(baseName.length);
    str = str.trimLeft();

    //Find the command executed, based on whether the starting expression matches any of the command names in order.
    /** @type {Core.Command|null} */let command = null;
    /** @type {Core.Command|null} */let fallback = null;
    let found = false;
    for(let i = 0; i < commandsArr.length; i++) {
        let c = commandsArr[i];

        for(let j = 0; j < c.commandNames.length; j++) {
            let name = c.commandNames[j];

            if(name.length === 0) fallback = c;

            if(str.toLowerCase().split(" ")[0] === name) {
                str = str.substring(name.length);
                command = c;
                found = true;
                break;
            }
        }
        if(found) break;
    }
    if(!found && fallback)
        command = fallback;
    if(!command) return false;

    str = str.trimLeft();
    //If we found help right before the argument list, assume the user is asking for help on this command.
    if(str.toLowerCase().startsWith("help"))
        isHelp = true;

    //We've now passed syntax validation and found a command to execute.
    //If member or guild are unavailable, that means there is a server outage, or an other error.
    if(!m.guild.available) {
        m.message.reply("Commands unavailable during temporary Discord server outage. Try again later.").catch(logger.error);
        return false;
    }

    //Check if the user has the required permissions to execute this command.
    if(!this.canUseCommand(m.member, command)) {
        let embed = getCommandDeniedEmbed(command, command.authorityLevel.slice().map(id => {
            let r = this.data.roles.get(m.guild.id);
            if(!r) return null;
            return r.get(id) || null;
        }));
        m.channel.send({ embeds: [embed] }).catch(logger.error);
        
        return false;
    }

    //Build the arguments array. Remove all whitespaces, and each word separated by a whitespace becomes an argument.
    let args = str.split(" ");
    for(let i = 0; i < args.length; i++) {
        if(args[i].length === 0) {
            args.splice(i, 1);
            i--;
        }
    }

    if(isHelp) {
        const embed = getCommandHelpEmbed.bind(this)(m.member, "help", this.data.locale, command, "");
        if(embed) m.channel.send({ embeds: [embed] }).catch(logger.error);
        return true;
    }

    //Execute the command.
    //If the command callback returns a string, display an error.
    let errStr = command.callback(m, args, str, {});
    if(typeof errStr === "string") {
        let embed = getCommandHelpEmbed.bind(this)(m.member, "error", this.data.locale, command, errStr);
        if(embed) m.channel.send({ embeds: [embed] }).then(message => 
            setTimeout(() => message.delete().catch(logger.error), 1000 * 60)
        );
    }
    return true;
}
