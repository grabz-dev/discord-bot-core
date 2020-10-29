'use strict';

import fs from 'fs';
import { Locale } from '../structures/Locale.js';

/**
 * 
 * @throws ENOENT
 * @returns {Promise<Locale>}
 */
export function getLocale() {
    return new Promise((resolve, reject) => {
        fs.readFile(`${process.env.PWD}/src/locale/english.json`, (err, core) => {
            if(err) throw err.message;
            fs.readFile('src/locale/english.json', (err, user) => {
                if(err) throw err.message;
                resolve(new Locale(core.toString(), user.toString()));
            });
        });
    });
}