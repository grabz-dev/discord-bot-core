'use strict';

import Discord from 'discord.js';
import MySQL from 'mysql';
import util from 'util';
import { onShutdown } from 'node-graceful-shutdown';
import { logger } from '../Core.js';
import { Util } from './Util.js';

export class SQLWrapper {
    /**
     * 
     * @param {string} password 
     */
    constructor(password) {
        this.password = password;
        /** @type {Discord.Collection<Discord.Snowflake, { pool: MySQL.Pool, busy: boolean }>} */
        this.pools = new Discord.Collection();
        this.offline = false;

        onShutdown(async () => {
            if(this.offline) return;

            var timer = 0;
            const interval = 100;

            loop:
            while(true) {
                await Util.Promise.sleep(interval);
                timer += interval;
                if(timer > 1000 * 20) return;

                for(let pool of this.pools) {
                    if(pool[1].busy) continue loop;
                }
                
                return;
            }
        });
    }

    /**
     * 
     * @param {Discord.Guild|null} guild 
     */
    async create(guild) {
        if(this.offline) return;

        const id = guild ? guild.id+"" : "0";

        let connection = MySQL.createConnection({
            host     : 'localhost',
            user     : 'root',
            password : this.password,
            database : 'mysql'
        });

        this.offline = true;
        await util.promisify(connection.connect).bind(connection)();
        this.offline = false;

        await connection.query(`CREATE DATABASE IF NOT EXISTS guild${id};`, function (error, results, fields) {
            if (error) {
                logger.error(error);
                return;
            };
        });
        await connection.end();
    
        let pool = MySQL.createPool({
            connectionLimit : 1,
            host            : 'localhost',
            user            : 'root',
            password        : this.password,
            database        : `guild${id}`,
            multipleStatements: true,
        });

        this.pools.set(id, { pool: pool, busy: false } );
    }

    /**
     * 
     * @param {Discord.Guild|null} guild 
     * @param {(query: (s: string) => Promise<{results: any, fields: MySQL.FieldInfo[] | undefined}>) => Promise<void>} callback
     */
    async session(guild, callback) {
        if(this.offline) return;

        const id = guild ? guild.id+"" : "0";
        
        let pool = this.pools.get(id);
        if(!pool) return;

        pool.busy = true;
        let connection = await util.promisify(pool.pool.getConnection).bind(pool.pool)();
        await callback(
            async options => await query(connection, options)
        ).catch(logger.error);
        connection.release();
        pool.busy = false;
    }
}

/**
 * @param {MySQL.PoolConnection} connection
 * @param {string} options 
 * @returns {Promise<{results: any, fields: MySQL.FieldInfo[] | undefined}>}
 */
async function query(connection, options) {
    return new Promise((resolve, reject) => {
        connection.query(options, (error, results, fields) => {
            if(error) {
                reject(error);
                return;
            }

            resolve({results: results, fields: fields});
        });
    });
}