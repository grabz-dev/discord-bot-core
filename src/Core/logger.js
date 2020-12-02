'use strict';

import winston from 'winston';

const myFormat = winston.format.printf(info => {
    if(info.stack) {
        return `${info.timestamp} ${info.level}: ${info.stack}`;
    }
    return `${info.timestamp} ${info.level}: ${info.message}`;
});

/** @type {winston.Logger} */
export const logger = winston.createLogger({
    level: 'silly',
    
    transports: [
        new winston.transports.Console({ format: winston.format.combine(
            winston.format.colorize(),
            winston.format.splat(),
            winston.format.timestamp({
                format: 'MM-DD-YYYY HH:mm'
            }),
            winston.format.simple(),
            myFormat,
          )}),
    ],
});

{
    let oldError = logger.error;
    /**
     * 
     * @param {any} message 
     */
    logger.error = function(message) {
        if(typeof message === 'object')
            return oldError('', message);
        else
            return oldError(message);
    }
}