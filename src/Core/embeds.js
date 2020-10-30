"use strict";

/** @typedef {import('../Core').Core} Core */
/** @typedef {import('../Core').Command} Core.Command */
/** @typedef {import('../structures/Locale').Locale} Locale */

import Discord from 'discord.js';
import { Util } from '../structures/Util.js';

/**
 * @this Core
 * @param {Discord.GuildMember} member
 * @param {Locale} locale
 * @param {Core.Command[]} commands
 * @returns {Discord.MessageEmbed|null}
 */
export function getCategoryHelpEmbed(member, locale, commands) {
    let embed = new Discord.MessageEmbed({
        title: ":information_source: Category Help",
        footer: {
            text: "Get command help: !help <command>"
        }
    });

    let counter = 0;
    for(let command of commands) {
        if(!this.canUseCommand(member, command))
            continue;
        counter++;
        let hd = locale.command(command.baseNames[0], command.commandNames[0]);
        populateEmbedFieldsFromLocale(embed, command, hd);
    }

    if(counter === 0) return null;
    return embed;
}

/**
 * @param {Core.Command} command - The queried command.
 * @param {(Discord.Snowflake | null)[]} roleIds - Array of role IDs that can access the queried command.
 * @returns {Discord.MessageEmbed}
 */
export function getCommandDeniedEmbed(command, roleIds) {
    let desc = "Your clearance level is too low to call `!" + command.baseNames[0];
    desc += command.commandNames[0].length === 0 ? "" : " " + command.commandNames[0];
    desc += "`.\n"
    if(roleIds.length > 0) {
        desc += "You need one of the following roles: ";
        roleIds.forEach((roleId, i) => {
            desc += `<@&${roleId}>`;
            if(i < roleIds.length - 1)
                desc += ", ";
        });
    }
    else {
        desc += "You need to be an administrator.";
    }

    return new Discord.MessageEmbed({
        color: 6824314,
        title: ":octopus: Access Denied",
        description: desc
    });
}

/**
 * @this Core
 * @param {Discord.GuildMember} member
 * @param {"error" | "help"} type
 * @param {Locale} locale
 * @param {Core.Command} command 
 * @param {string | null} errStr
 * @returns {Discord.MessageEmbed|null}
 */
export function getCommandHelpEmbed(member, type, locale, command, errStr) {
    let embed = new Discord.MessageEmbed({
        color: type === "error" ? 16763981 : undefined,
        title: type === "error" ? ":warning: Command Error" : ":information_source: Command Help",
        description: errStr || ""
    });

    if(!this.canUseCommand(member, command)) return null;

    let hd = locale.command(command.baseNames[0], command.commandNames[0]);
    populateEmbedFieldsFromLocale(embed, command, hd);

    return embed;
}

/**
 * @param {Discord.MessageEmbed} embed
 * @param {Core.Command} command
 * @param {string[]} hd 
 */
function populateEmbedFieldsFromLocale(embed, command, hd) {
    if(!(embed.fields instanceof Array))
        embed.fields = [];
    
    const space = "⠀⠀";
    let fieldsIndex = embed.fields.length;

    for(let i = 0; i < hd.length; i++) {
        if(embed.fields[fieldsIndex] == null)
            embed.fields[fieldsIndex] = {
                name: "",
                value: "",
                inline: false,
            };

        let row = hd[i];

        row = Util.String.replaceAll(row, "%space%", space);
        row = Util.String.replaceAll(row, "%name%", command.baseNames[0] + (command.commandNames[0].length > 0 ? " " + command.commandNames[0] : ""));

        let nameIndex = row.indexOf("<n>");
        let valueIndex = row.indexOf("<v>");

        if(nameIndex > -1) {
            row = row.substring(nameIndex);
            row = row.substring(row.indexOf(">") + 1);
        }
        else if(valueIndex > -1) {
            row = row.substring(valueIndex);
            row = row.substring(row.indexOf(">") + 1);
        }
        else {
            let name = embed.fields[fieldsIndex].name;
            if(name == null || name.length === 0)
                nameIndex = 0;
            else
                valueIndex = 0;
        }

        if(nameIndex > -1) {
            if(embed.fields[fieldsIndex].name.length > 0) {
                fieldsIndex++;
                embed.fields[fieldsIndex] = {
                    name: "",
                    value: "",
                    inline: false
                };
            }
            
            embed.fields[fieldsIndex].name = row;

            if(i === hd.length - 1)
                embed.fields[fieldsIndex].value = space + "...";
        }
        else if(valueIndex > -1) {
            if(embed.fields[fieldsIndex].value.length === 0)
                embed.fields[fieldsIndex].value = row;
            else
                embed.fields[fieldsIndex].value += "\n" + row;
        }
    }
}