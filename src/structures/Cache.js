import Discord from 'discord.js';

export class BotCache {
    constructor() {
        this._cache = new Map();
    }
    
    /**
     * @param {Discord.Snowflake} guildId - The ID of the guild the cache is saved on.
     * @param {string} propertyName - The name of the property to retrieve.
     * @returns {any} The retrieved item
     */
    get(guildId, propertyName) {
        let item = this._cache.get(guildId);
        if(!item)
            return undefined;

        return item[propertyName];
    }

    /**
     * @param {Discord.Snowflake} guildId - The ID of the guild the cache is saved on.
     * @param {string} propertyName - The name of the property to retrieve.
     * @param {any} value - The value to set on the cache.
     */
    set(guildId, propertyName, value) {
        let item = this._cache.get(guildId);
        if(!item)
            this._cache.set(guildId, {[propertyName]: value})
        else {
            if(value == null) 
                delete item[propertyName];
            else {
                item[propertyName] = value;
                this._cache.set(guildId, item);
            }
        }
    }
}