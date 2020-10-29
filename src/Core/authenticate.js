'use strict';

import fs from 'fs';

/**
 * 
 * @throws ENOENT
 * @returns {Promise<{token: string, sql: string}>}
 */
export function authenticate() {
    return new Promise((resolve, reject) => {
        fs.readFile('auth.json', (err, data) => {
            if(err) throw err.message;
            resolve(JSON.parse(data.toString()));
        });
    });
}