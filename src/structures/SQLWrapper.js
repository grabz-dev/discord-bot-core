'use strict';

import Discord from 'discord.js';
import MySQL from 'mysql';
import util from 'util';
import { onShutdown } from 'node-graceful-shutdown';
import { logger } from '../Core.js';
import { Util } from './Util.js';

/**
 * 
 * @param {{user: string, password: string}} account 
 */
export function SQLWrapper(account) {
    const host = 'localhost';
    const dbName = 'lia_bot';

    var created = false;
    var online = false;
    var connections = 0;

    /** @type {null|MySQL.Pool} */
    var pool = null;

    onShutdown(async () => {
        if(!created || !online) return;
        if(connections === 0) return;

        var timer = 0;
        const interval = 100;

        loop:
        while(true) {
            await Util.Promise.sleep(interval);
            timer += interval;
            if(timer > 1000 * 20) return;

            if(connections > 0) continue loop;
            return;
        }
    });

    /**
     * Initialize mysql database
     */
    this.init = async function() {
        //Don't run more than once
        if(created) return;
        created = true;

        //Ensure our database exists
        var connection = MySQL.createConnection({
            host     : host,
            user     : account.user,
            password : account.password,
            database : 'mysql'
        });
        await util.promisify(connection.connect).bind(connection)();
        await query(connection, `CREATE DATABASE IF NOT EXISTS ${dbName}`);
        await util.promisify(connection.end).bind(connection)();

        //Create pool
        pool = MySQL.createPool({
            connectionLimit : 10,
            host            : host,
            user            : account.user,
            password        : account.password,
            database        : dbName,
            multipleStatements: true,
        }); 

        //See if pool accepts connections
        var poolConnection = await util.promisify(pool.getConnection).bind(pool)();
        poolConnection.release();
        online = true;
    }

    /**
     * 
     * @param {(query: (s: string) => Promise<{results: any, fields: MySQL.FieldInfo[] | undefined}>) => Promise<void>} callback
     */
    this.transaction = async function(callback) {
        if(!pool || !online) throw 'MySQL database is offline';

        let connection = await util.promisify(pool.getConnection).bind(pool)();
        connections++;

        try {
            await util.promisify(connection.beginTransaction).bind(connection)();
            await callback( async options => await query(connection, options) );
            await util.promisify(connection.commit).bind(connection)();
        } catch(e) {
            logger.error(e);
            await util.promisify(connection.rollback).bind(connection)();
        } finally {
            connection.release();
            connections--;
        }
    }
}

/**
 * @param {MySQL.Connection|MySQL.PoolConnection} connection
 * @param {string} options 
 * @returns {Promise<{results: any, fields: MySQL.FieldInfo[] | undefined}>}
 */
async function query(connection, options) {
    options = options.replace(/\s\s+/g, ' ');
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