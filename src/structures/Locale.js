'use strict';

export class Locale {
    /**
     * @param {string} coreLocale - JSON string of a language file from locale.
     * @param {string} userLocale - JSON string of a language file from locale.
     */
    constructor(coreLocale, userLocale) {
        const locale = JSON.parse(coreLocale);
        const localeUser = JSON.parse(userLocale);

        ["command", "category"].forEach(section => {
            if(localeUser[section]) {
                for(let name of Object.keys(localeUser[section])) {
                    locale[section][name] = localeUser[section][name];
                }
            }
        });

        /**
         * Get a language string from the locale file command module.
         * @param {string} baseName - The category name.
         * @param {string} firstAlias - The command's first alias.
         * @returns {string[]} The language string array.
         */
        this.command = function(baseName, firstAlias) {
            if(locale == null)
                return ["command_string_missing", "(0)"];

            let m = locale.command;
            if(m == null)
                return ["command_string_missing", "(1)"];

            m = m[baseName];
            if(m == null)
                return ["command_string_missing", "(2)"];

            m = m[firstAlias];
            if(m == null)
                return ["command_string_missing", "(3)"];

            if(!(m instanceof Array))
                m = [m];

            return m.slice();
        }

        /**
         * Get a language string from the locale file category.
         * @param {string} category - The category name.
         * @param {string} strname - The name of the string to retrieve.
         * @param {string[]} args - Any arguments that were passed to replace arguments with on the original string.
         * @returns {string} The language string.
         */
        this.category = function(category, strname, ...args) {
            if(locale == null)
                return strname;

            let m = locale.category;
            if(m == null)
                return strname;

            m = m[category];
            if(m == null)
                return strname;

            m = m[strname];
            if(m == null)
                return strname;

            for(let i = 0; i < args.length; i++)
                m = m.replaceAll("%" + i, args[i]);

            return m;
        }
    }
}