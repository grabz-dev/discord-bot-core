'use strict';

/** @typedef {import('winston').Logger} winston.Logger */
/** @typedef {import('../Core').Core} Core */
/** @typedef {import('../Core').Entry} Core.Entry */
/** @typedef {import('../structures/Module').Module} Module */

import { logger } from '../Core.js';
import Discord from 'discord.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Util } from '../structures/Util.js';

import Roles from '../modules/Roles.js';
import Blacklist from '../modules/Blacklist.js';

//https://techsparx.com/nodejs/esnext/dirname-es-modules.html
// @ts-ignore
const __dirname = (() => {
    let str = path.dirname(new URL(import.meta.url).pathname);
    if(str[0] === '/' && os.platform() === 'win32') str = str.substring(1);
    return str;
})();

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
        this.data.sql.transaction(async query => {
            let roleStrings = this.data.roles.get(guild.id);
            if(roleStrings) roleStrings.clear();
            else {
                let c = new Discord.Collection();
                this.data.roles.set(guild.id, c);
                roleStrings = c;
            }

            /** @type {any[]} */
            let results = (await query(`SELECT * FROM roles_roles WHERE guild_id = '${guild.id}'`)).results;
            for(let result of results)
                // @ts-ignore
                roleStrings.set(result.name, result.role_id);
        });
    });

    let blacklist = /** @type {Blacklist | undefined} */(this.data.modules.get(Blacklist));
    if(!blacklist) throw 'Required core module Blacklist not found.';
    blacklist.on('blacklistChanged', results => {
        this.blacklist = results.map(v => v.user_id);
    })

    logger.info('Searching custom modules...');
    await searchModule.bind(this)(entry, process.cwd() + '/src/modules');

    {
        let guildsArr = Array.from(this.data.client.guilds.cache.values());
        let keys = Array.from(this.data.modules.keys());

        for(let j = 0; j < guildsArr.length; j++) {
            let str = '[' + guildsArr[j].name + '] %0 modules OK: ';
            let oks = 0;
            for(let i = 0; i < keys.length; i++) {
                let module = /** @type {Module} */(this.data.modules.get(keys[i]));
                module.init(guildsArr[j]);
                for(let commandName of module.commands) {
                    this.slashCommands[commandName] = module;
                }
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
                if(file.indexOf('.') < 0) continue;
                // @ts-ignore
                /** @type {Module} */ let module = (await import(`file://${path}/${file}`)).default;
                // @ts-ignore
                this.addModule(new module(entry));
            }

            logger.info('   ' + (files.length <= 0 ? 'No modules found.' : 'Modules found: ' + files.join(', ').replace(/.js/g, '')));
            resolve();
        });
    });
}