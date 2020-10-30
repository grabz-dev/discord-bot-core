// @ts-nocheck
'use strict';

/** @typedef {import("winston").Logger} winston.Logger */

import Discord from 'discord.js';
import TingoDB from 'tingodb';
import fs from 'fs';
import path from 'path';
import { onShutdown } from 'node-graceful-shutdown';
import { logger } from '../Core.js';
import { Util } from './Util.js';

const Engine = TingoDB({
    apiLevel: 200
});

/**
 * A database session object.
 */
export class Session {
    constructor() { }
}


/**
 * @this MongoWrapper
 */
async function loop() {
    while(Array.from(this.currentSessions.keys()).length !== 0)
        await Util.Promise.sleep(100).catch(logger.error);

    const now = new Date();
    const dateStr = `${Util.String.fixedWidth(now.getUTCFullYear()+"", 4, "0")}-${Util.String.fixedWidth(now.getUTCMonth()+1+"", 2, "0")}-${Util.String.fixedWidth(now.getUTCDate()+"", 2, "0")}--${Util.String.fixedWidth(now.getUTCHours()+"", 2, "0")}-${Util.String.fixedWidth(now.getUTCMinutes()+"", 2, "0")}-${Util.String.fixedWidth(now.getUTCSeconds()+"", 2, "0")}`;
    
    logger.verbose(`[TingoDB] Starting backup at ${now.toISOString()}...`);

    for(let db of this.dbs.values()) {
        db.locked = true;
        db.db.close(async () => {
            try {
                const pathToDb = `db/${db.guildId}`;
                const pathToBak = `db_bak/${dateStr}/${db.guildId}`

                if(!fs.existsSync("db_bak"))
                    fs.mkdirSync("db_bak");
                if(!fs.existsSync(`db_bak/${dateStr}`))
                    fs.mkdirSync(`db_bak/${dateStr}`);
                
                fs.mkdirSync(pathToBak);

                if(fs.lstatSync(pathToDb).isDirectory()) {
                    let files = fs.readdirSync(pathToDb);
                    for(let file of files) {
                        fs.writeFileSync(path.join(pathToBak, file), fs.readFileSync(path.join(pathToDb, file)));
                    }
                }
            }
            catch(e) {
                logger.error(e);
            }
            finally {
                db.db.open(() => {
                    db.locked = false;

                    for(let promise of db.waiting)
                        promise();

                    db.waiting.splice(0, db.waiting.length);
                });
            }
        });
    }
    logger.verbose("[TingoDB] Backup complete.");
    

    setTimeout(loop.bind(this), 1000 * 60 * 60 * 24);
}

export class MongoWrapper {
    constructor() {
        /** @type {Discord.Collection<string, Session>} */
        this.currentSessions = new Discord.Collection();
        this.locked = false;
        this.db = new Engine.Db('database', {});
        /** @type {Discord.Collection<Discord.Snowflake, {db: any, guildId: string, locked: boolean, waiting: ((value?: any) => void)[]}>} */
        this.dbs = new Discord.Collection();

        setTimeout(loop.bind(this), 1000 * 10);

        onShutdown(async () => {
            var timer = 0;
            const interval = 100;

            loop:
            while(true) {
                await Util.Promise.sleep(interval);
                timer += interval;
                if(timer > 1000 * 20) return;

                for(let db of this.dbs) {
                    if(db[1].locked) continue loop;
                }

                if(this.currentSessions.size > 0) continue loop;

                return;
            }
        });
    }

    /**
     * @param {Discord.Guild|null} guild 
     */
    async createDatabase(guild) {
        const id = guild == null ? "0" : guild.id;

        await Util.createDirectory("db");
        await Util.createDirectory("db/" + id);

        let db = new Engine.Db("db/" + id, {});
        this.dbs.set(id, {
            db: db,
            guildId: id,
            locked: false,
            waiting: []
        });
    }

    /**
     * @param {Discord.Guild|null} guild 
     * @param {string} group 
     * @param {(session: Session) => Promise<void>} callback
     */
    async session(guild, group, callback) {
        const id = guild == null ? "0" : guild.id;

        const db = this.dbs.get(id);
        if(!db) throw new Error("A database for this guild doesn't exist.");

        if(db.locked) {
            await new Promise((resolve) => { 
                db.waiting.push(resolve);
            });
        }

        let session = new Session();

        while(this.currentSessions.get(getSessionKey(guild, group)) != null) await Util.Promise.sleep(10);

        this.currentSessions.set(getSessionKey(guild, group), session);
        await callback(session).catch(logger.error);
        this.currentSessions.delete(getSessionKey(guild, group));
    }

    /**
     * @param {Session} session
     * @param {Discord.Guild|null} guild 
     * @param {string} group 
     * @param {string} collection 
     * @param {object} options
     * @param {object} query - The selection criteria for the update
     * @param {object} update - The modifications to apply
     * @returns {Promise<any>}
     */
    update(session, guild, group, collection, options, query, update) {
        return new Promise(async (resolve, reject) => {
            const id = guild == null ? "0" : guild.id;

            const dbobj = this.dbs.get(id);
            if(!dbobj) throw new Error("A database for this guild doesn't exist.");
            const db = dbobj.db;
            if(dbobj.locked) {
                await new Promise((resolve) => { dbobj.waiting.push(resolve) });
            }

            await new Promise(resolve => {
                if(this.currentSessions.get(getSessionKey(guild, group)) !== session)
                    throw new Error("Bad database session");
                resolve();
            }).catch(reject);

            //If no operation was specified, assume the key is meant to be part of the $set operation.
            let parsedUpdate = {};
            for(let key of Object.keys(update)) {
                if(key[0] === "$")
                    parsedUpdate[key] = update[key];
                else {
                    if(parsedUpdate.$set == null)
                        parsedUpdate.$set = {};
                    parsedUpdate.$set[key] = update[key];
                }
            }

            db.collection(getName(group, collection)).update(query, parsedUpdate, options, (err, result) => {
                if(err) {
                    reject(err);
                    return;
                }

                resolve(result);
            });
        });
    }

    /**
     * @param {Session} session
     * @param {Discord.Guild|null} guild
     * @param {string} group
     * @param {string} collection
     * @param {object} options
     * @param {object} query - The selection criteria for the update
     * @param {object} projection - Specifies the fields to return in the documents that match the query filter
     * @returns {Promise<any|null>}
     */
    findOne(session, guild, group, collection, options, query, projection) {
        return new Promise(async (resolve, reject) => {
            const id = guild == null ? "0" : guild.id;

            const dbobj = this.dbs.get(id);
            if(!dbobj) throw new Error("A database for this guild doesn't exist.");
            const db = dbobj.db;
            if(dbobj.locked) {
                await new Promise((resolve) => { dbobj.waiting.push(resolve) });
            }

            await new Promise(resolve => {
                if(this.currentSessions.get(getSessionKey(guild, group)) !== session)
                    throw new Error("Bad database session");
                resolve();
            }).catch(reject);

            db.collection(getName(group, collection)).findOne(query, projection, options, (err, result) => {
                if(err) {
                    reject(err);
                    return;
                }

                resolve(result);
            });
        });
    }

    /**
     * @param {Session} session
     * @param {Discord.Guild|null} guild
     * @param {string} group
     * @param {string} collection
     * @param {object} options
     * @param {object} query - The selection criteria for the update
     * @param {object} projection - Specifies the fields to return in the documents that match the query filter
     * @returns {Promise<any[]>}
     */
    find(session, guild, group, collection, options, query, projection) {
        return new Promise(async (resolve, reject) => {
            const id = guild == null ? "0" : guild.id;

            const dbobj = this.dbs.get(id);
            if(!dbobj) throw new Error("A database for this guild doesn't exist.");
            const db = dbobj.db;
            if(dbobj.locked) {
                await new Promise((resolve) => { dbobj.waiting.push(resolve) });
            }

            await new Promise(resolve => {
                if(this.currentSessions.get(getSessionKey(guild, group)) !== session)
                    throw new Error("Bad database session");
                resolve();
            }).catch(reject);

            db.collection(getName(group, collection)).find(query, projection, options).toArray((err, result) => {
                if(err) {
                    reject(err);
                    return;
                }

                resolve(result);
            });
        });
    }
    
    /**
     * @param {Session} session
     * @param {Discord.Guild|null} guild
     * @param {string} group
     * @param {string} collection
     * @param {object} options
     * @param {object} query - The selection criteria for the update
     * @returns {Promise<any>}
     */
    remove(session, guild, group, collection, options, query) {
        return new Promise(async (resolve, reject) => {
            const id = guild == null ? "0" : guild.id;

            const dbobj = this.dbs.get(id);
            if(!dbobj) throw new Error("A database for this guild doesn't exist.");
            const db = dbobj.db;
            if(dbobj.locked) {
                await new Promise((resolve) => { dbobj.waiting.push(resolve) });
            }

            await new Promise(resolve => {
                if(this.currentSessions.get(getSessionKey(guild, group)) !== session)
                    throw new Error("Bad database session");
                resolve();
            }).catch(reject);

            db.collection(getName(group, collection)).remove(query, options, (err, result) => {
                if(err) {
                    reject(err);
                    return;
                }

                resolve();
            });
        });
    }

    /**
     * @param {Session} session
     * @param {Discord.Guild|null} guild
     * @param {string} group 
     * @param {string} collection
     * @param {object} options
     * @param {object} document - A document or array of documents to insert into the collection.
     * @returns {Promise<any>}
     */
    insert(session, guild, group, collection, options, document) {
        return new Promise(async (resolve, reject) => {
            const id = guild == null ? "0" : guild.id;

            const dbobj = this.dbs.get(id);
            if(!dbobj) throw new Error("A database for this guild doesn't exist.");
            const db = dbobj.db;
            if(dbobj.locked) {
                await new Promise((resolve) => { dbobj.waiting.push(resolve) });
            }

            await new Promise(resolve => {
                if(this.currentSessions.get(getSessionKey(guild, group)) !== session)
                    throw new Error("Bad database session");
                resolve();
            }).catch(reject);

            db.collection(getName(group, collection)).insert(document, options, (err, result) => {
                if(err) {
                    reject(err);
                    return;
                }

                resolve(result[0]);
            });
        });
    }

    /**
     * @param {Session} session
     * @param {Discord.Guild|null} guild
     * @param {string} group 
     * @param {string} collection
     * @param {object} options
     * @param {object} query - The selection criteria for the update
     * @returns {Promise<any>}
     */
    count(session, guild, group, collection, options, query) {
        return new Promise(async (resolve, reject) => {
            const id = guild == null ? "0" : guild.id;

            const dbobj = this.dbs.get(id);
            if(!dbobj) throw new Error("A database for this guild doesn't exist.");
            const db = dbobj.db;
            if(dbobj.locked) {
                await new Promise((resolve) => { dbobj.waiting.push(resolve) });
            }

            await new Promise(resolve => {
                if(this.currentSessions.get(getSessionKey(guild, group)) !== session)
                    throw new Error("Bad database session");
                resolve();
            }).catch(reject);

            db.collection(getName(group, collection)).count(query, options, (err, result) => {
                if(err) {
                    reject(err);
                    return;
                }

                resolve(result);
            });
        });
    }

    /**
     * @param {Session} session
     * @param {Discord.Guild|null} guild
     * @param {string} group 
     * @param {string} collection
     * @returns {Promise<void>}
     */
    drop(session, guild, group, collection) {
        return new Promise(async (resolve, reject) => {
            const id = guild == null ? "0" : guild.id;

            const dbobj = this.dbs.get(id);
            if(!dbobj) throw new Error("A database for this guild doesn't exist.");
            const db = dbobj.db;
            if(dbobj.locked) {
                await new Promise((resolve) => { dbobj.waiting.push(resolve) });
            }

            await new Promise(resolve => {
                if(this.currentSessions.get(getSessionKey(guild, group)) !== session)
                    throw new Error("Bad database session");
                resolve();
            }).catch(reject);

            db.collection(getName(group, collection)).drop((err) => {
                if(err) {
                    reject(err);
                    return;
                }

                resolve();
            });
        });
    }
}

MongoWrapper.Session = Session;

/**
 * 
 * @param {string} group 
 * @param {string} collection 
 * @returns {string}
 */
function getName(group, collection) {
    return group + "." + collection + ".json";
}

/**
 * 
 * @param {Discord.Guild|null} guild 
 * @param {string} group 
 * @returns {string}
 */
function getSessionKey(guild, group) {
    const id = guild == null ? "0" : guild.id;
    return id + "__" + group;
}