'use strict';

import Discord from 'discord.js';
import { mkdir } from 'fs';

export const Util = Object.freeze({
    SQL: Object.freeze({
        /**
         * 
         * @param {Object.<string, any>} obj 
         * @param {string} tableName
         * @returns {string}
         */
        getInsert(obj, tableName) {
            for(let k of Object.keys(obj)) {
                let o = obj[k];
                if(typeof o === "string")
                    obj[k] = `"${o}"`
            }

            return `INSERT INTO ${tableName} ( ${Object.keys(obj).join(", ")} ) VALUES ( ${Object.values(obj).join(", ")} ) `;
        }
    }),
    String: Object.freeze({
        /**
         * A `string.replace` that finds and replaces all matches.
         * @param {string} str - Original string.
         * @param {string | RegExp} search  - Search regex.
         * @param {string} replacement - Replacement string for matches.
         * @returns {string} The new string.
         */
        replaceAll: function(str, search, replacement) {
            return str.replace(typeof search === "string" ? new RegExp(search, 'g') : search, replacement);
        },
        /**
         * If the first character in this string is a letter that is not capitalized, capitalize it.
         * @param {string} str - Original string.
         * @returns {string} The new string.
         */
        capitalize: function(str) {
            return str.charAt(0).toUpperCase() + str.slice(1);
        },
        /**
         * Formats a string to a string of a set width, by inserting spaces in front or after the string.
         * @param {string} str - The string to format.
         * @param {number} length - The target length of the string.
         * @param {string} fillChar - The character to fill the remaining space of the string with.
         * @param {boolean=} spacesAfterString - Whether the spaces should be inserted after the string or before the string.
         * @param {boolean=} cutTooLong - Whether a string that is too long to fit the length requirement should be cut short.
         * @returns {string} The new string.
         */
        fixedWidth(str, length, fillChar, spacesAfterString, cutTooLong) {
            let l = length - str.length;

            if(l < 0) return str.substring(0, length);
            else if(l === 0) return str;
            else {
                let spaces = "";
                for(let i = 0; i < l; i++) {
                    spaces += fillChar;
                }

                if(spacesAfterString) return str + spaces;
                else return spaces + str;
            }
        }
    }),
    Promise: Object.freeze({
        /**
         * Returns a new promise, whose sole purpose is to resolve after a set amount of `milliseconds`.
         * This can be useful with async functions as a way of purposefully slowing down the function.
         * For example, when sending multiple messages, you might want to create a pause between them.
         * @param {number} milliseconds - The number.
         * @returns {Promise<null>} Promise to wait for.
         */
        sleep: function(milliseconds) {
            return new Promise(resolve => setTimeout(resolve, milliseconds));
        }
    }),
    /**
     * Given a `path`, this function will create a new directory. Will not do anything if the directory already exists.
     * @param {*} path - The path to the new directory.
     * @returns {Promise<void>}
     */
    createDirectory : function(path) {
        return new Promise((resolve, reject) => {
            mkdir(path, err => {
                if(err && err.code !== "EEXIST")
                    reject(err);
                resolve();
            });
        });
    },
    /**
     * Takes unix time in `milliseconds` and returns a date as a formatted string.
     * @param {null | number | string} milliseconds - Unix time timestamp. If not a number or string, uses current time.
     * @param {boolean} alsoTime - If true will include current time, otherwise stops at day.
     * @returns {string} The formatted date.
     */
    getFormattedDate : function(milliseconds, alsoTime) {
        let d = (typeof milliseconds === "number" || typeof milliseconds === "string") ? new Date(milliseconds) : new Date();
        let tz = (d.getTimezoneOffset() / 60) * -1;
        let str = d.getFullYear() + "-" + ('0' + (d.getMonth() + 1)).slice(-2) + "-" + ('0' + d.getDate()).slice(-2) + (alsoTime === true ? (" " + ('0' + d.getHours()).slice(-2) + ":" + ('0' + d.getMinutes()).slice(-2) + ":" + ('0' + d.getSeconds()).slice(-2)) + " UTC" + (tz >= 0 ? "+" : "") + tz : "");
        return str;
    },
    /**
     * Takes an amount of time in `milliseconds` and returns remaining time formatted as string.
     * @param {number} milliseconds The time remaining in milliseconds.
     * @returns {string} The formatted time remaining.
     */
    getFormattedTimeRemaining : function(milliseconds) {
        let d, h, m, s;

        s = Math.floor(milliseconds / 1000);
        m = Math.floor(s / 60);
        s = s % 60;
        h = Math.floor(m / 60);
        m = m % 60;
        d = Math.floor(h / 24);
        h = h % 24;

        return d + " days, " + h + " hours, " + m + " minutes";
    },
    /**
     * Takes an amount of time in `milliseconds` and returns remaining time formatted as string in a shorter format.
     * @param {number} milliseconds The time remaining in milliseconds.
     * @returns {string} The formatted time remaining.
     */
    getFormattedTimeRemainingShort : function(milliseconds) {
        let y, d, h, m, s;

        s = Math.floor(milliseconds / 1000);
        m = Math.floor(s / 60);
        s = s % 60;
        h = Math.floor(m / 60);
        m = m % 60;
        d = Math.floor(h / 24);
        h = h % 24;
        y = Math.floor(d / 365);
        d = d % 365;

        if(y > 0)
            return y + "y" + d + "d" + h + "h" + m + "m" + s + "s";
        if(d > 0)
            return d + "d" + h + "h" + m + "m" + s + "s";
        if(h > 0)
            return h + "h" + m + "m" + s + "s";
        if(m > 0)
            return m + "m" + s + "s";
        if(s > 0)
            return s + "s";
        return "";
    },
    /**
     * Returns a random integer between min (inclusive) and max (exclusive).
     * @param {number} minIncl The minimum number (inclusive).
     * @param {number} maxExcl The maximum number (exclusive).
     * @returns {number} The random integer.
     */
    getRandomInt : function(minIncl, maxExcl) {
        return Math.floor(Math.random() * (maxExcl - minIncl)) + minIncl;
    },
    /**
     * Removes all non alphanumeric characters from the string.
     * Given any Discord mention, clears out the string such that only the Snowflake remains.
     * @param {string} ping
     * @returns {string | null} The returned string, that should match to an existing Snowflake mapping.
     */
    getSnowflakeFromDiscordPing: function(ping) {
        ping = ping.toString();
        ping = ping.split(":").reverse()[0]; //emote pings
        ping = ping.replace(/\D/g,'');
        
        if(ping.length === 0 || Number.isNaN(Number(ping)))
            return null;

        return ping;
    },
    /**
     * Checks if this `Discord.GuildMember` has a role that contains the "ADMINISTRATOR" permission.
     * @param {Discord.GuildMember} member - The member to check.
     * @returns {boolean} Whether the user is an admin or not.
     */
    isMemberAdmin : function(member) {
        for(let role of member.roles.cache) {                    //check user roles
            if(role[1].permissions.has('ADMINISTRATOR')) {   //if one of roles is administrator
                return true;                               //override
            }
        }
        return false;
    },
    /**
     * Checks if this `Discord.GuildMember` has a role that contains the "MANAGE_MESSAGES" permission.
     * @param {Discord.GuildMember} member - The member to check.
     * @returns {boolean} Whether the user is a mod or not. 
     */
    isMemberModerator : function(member) {
        for(let role of member.roles.cache) {                    //check user roles
            if(role[1].permissions.has("MANAGE_MESSAGES")) { //if one of roles is moderator
                return true;                               //override
            }
        }
        return false;
    },
    /**
     * Given duration format, returns the amount of milliseconds that it adds up to.
     * Example duration format: 1h20m5s
     * Negative numbers are allowed, and will subtract from the total.
     * The returned number of milliseconds can be negative if the duration format adds up to a negative number.
     * @param {string} str 
     * @returns {number}
     */
    getMillisecondsFromDurationFormat : function(str) {
        let matches = str.match(/-?\d+([\,\.]\d+)?[a-z]/g);
        let milliseconds = 0;

        if(matches == null)
            return milliseconds;

        for(let match of matches) {
            let number = Number(match.substring(0, match.length - 1).replace(",", "."));
            let suffix = match.substring(match.length - 1);

            if(!Number.isFinite(number))
                continue;

            switch(suffix) {
                case "s": number *= 1000;             break;
                case "m": number *= 60000;            break;
                case "h": number *= 3600000;          break;
                case "d": number *= 86400000;         break;
                case "y": number *= 31536000000;      break;
                case "c": number *= 3153600000000;    break;
                default: continue;
            }

            milliseconds += number;
        }

        return milliseconds;
    },
    /**
     * Given a number of milliseconds, returns the simplest possible duration format string.
     * For example, 10000000 turns to "2h46m40s"
     * Negative input are allowed.
     * @param {number} ms 
     * @returns {string}
     */
    getDurationFormatFromMilliseconds : function(ms) {
        let str = "";
        let neg = ms < 0 ? true : false;
        ms = Math.abs(ms);

        //1 second minimum.
        //<1001 is 1s, but 1001 is 2s.
        ms += 999;
        ms = Math.max(ms, 1000);
        
        while(ms >= 1000) {
            let curNum = 0;
            let curSuf = "";

            if(curNum === 0) while(ms >= 3153600000000) { curNum++; curSuf = "c"; ms -= 3153600000000; }
            if(curNum === 0) while(ms >= 31536000000)   { curNum++; curSuf = "y"; ms -= 31536000000; }
            if(curNum === 0) while(ms >= 86400000)      { curNum++; curSuf = "d"; ms -= 86400000; }
            if(curNum === 0) while(ms >= 3600000)       { curNum++; curSuf = "h"; ms -= 3600000; }
            if(curNum === 0) while(ms >= 60000)         { curNum++; curSuf = "m"; ms -= 60000; }
            if(curNum === 0) while(ms >= 1000)          { curNum++; curSuf = "s"; ms -= 1000; }
            
            if(curNum === 0) break;
            str += (neg ? "-" : "") + curNum + curSuf;
        }

        return str;
    },
    /**
     * Get a special whitespace character that isn't removed in discord embeds
     * @param {number} count
     */
    getSpecialWhitespace : function(count) {
        let str = '⠀';
        let ret = '';
        for(let i = 0; i < count; i++)
            ret += str;
        return ret;
    }
});