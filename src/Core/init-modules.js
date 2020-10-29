'use strict';

/** @typedef {import('winston').Logger} winston.Logger */
/** @typedef {import('../Core').Core} Core */
/** @typedef {import('../Core').Entry} Core.Entry */
/** @typedef {import('../structures/Module').Module} Module */

import { logger } from '../Core.js';
import Discord from 'discord.js';
import fs from 'fs';
import path from 'path';
import { Util } from '../structures/Util.js';

import Roles from '../modules/Roles.js';

//https://techsparx.com/nodejs/esnext/dirname-es-modules.html
// @ts-ignore
const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * 
 * @throws ENOENT
 * @this {Core} 
 * @param {Core.Entry} entry
 */
export async function initModules(entry) {
    logger.info('Searching core modules...');
    await searchModule.bind(this)(entry, __dirname + '/../modules');
    
    let roles = /** @type {Roles | undefined} */(this.data.modules.get(Roles));
    if(!roles) throw 'Required core module Roles not found.';
    roles.on('rolesChanged', guild => {
        this.data.tdb.session(guild, 'roles', async session => {
            this.data.tdb.find(session, guild, 'roles', 'roles', {}, {}, { rid: 1 }).then(documents => {
                let roleStrings = this.data.roles.get(guild.id);
                if(roleStrings) roleStrings.clear();
                else {
                    let c = new Discord.Collection();
                    this.data.roles.set(guild.id, c);
                    roleStrings = c;
                }
                for(let document of documents) 
                    // @ts-ignore
                    roleStrings.set(document._id, document.rid);
            }).catch(logger.error);
        }).catch(logger.error);
    });

    logger.info('Searching custom modules...');
    await searchModule.bind(this)(entry, process.env.PWD + '/src/modules');

    {
        let guildsArr = this.data.client.guilds.cache.array();
        let keys = this.data.modules.keyArray();

        for(let j = 0; j < guildsArr.length; j++) {
            let str = '[' + guildsArr[j].name + '] %0 modules OK: ';
            let oks = 0;
            for(let i = 0; i < keys.length; i++) {
                let module = /** @type {Module} */(this.data.modules.get(keys[i]));
                module.init(guildsArr[j]);
                oks++;
                str += module.constructor.name + ' ';
            }
            logger.info(Util.String.replaceAll(str, '%0', oks+''));
        }
    }
}

/**
 * 
 * @throws ENOENT
 * @this {Core}
 * @param {Core.Entry} entry
 * @param {string} path 
 * @returns {Promise<void>}
 */
function searchModule(entry, path) {
    // @ts-ignore
    return new Promise((resolve, reject) => {
        fs.readdir(path, async (err, files) => {
            if(err) throw err.message;

            for(let file of files) {
                // @ts-ignore
                /** @type {Module} */ let module = (await import(path + '/' + file)).default;
                // @ts-ignore
                this.addModule(new module(entry));
            }

            logger.info('   ' + (files.length <= 0 ? 'No modules found.' : 'Modules found: ' + files.join(', ').replace(/.js/g, '')));
            resolve();
        });
    });
}