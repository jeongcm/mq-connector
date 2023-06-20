import fs from 'fs';
import winston from 'winston';
import winstonDaily from 'winston-daily-rotate-file';

// RYAN:
// 1. As per Sebastian's decision, we are going to enforce /var/log path as default

// logs dir
const LOG_DIR = process.env.__ENV_ONLY_FOR_DEV_LOG_PATH || './log';

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

// Define log format
const logFormat = winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`);

/*
 * Log Level
 * error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6
 */
const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        logFormat,
    ),
    transports: [
        // debug log setting
        new winstonDaily({
            level: 'debug',
            datePattern: 'YYYY-MM-DD',
            dirname: LOG_DIR, // log file /logs/debug/*.log in save
            filename: `debug.%DATE%.log`,
            maxFiles: 7, // 7 Days saved
            json: false,
            zippedArchive: true,
        }),
        // error log setting
        new winstonDaily({
            level: 'error',
            datePattern: 'YYYY-MM-DD',
            dirname: LOG_DIR, // log file /logs/error/*.log in save
            filename: `error.%DATE%.log`,
            maxFiles: 7, // 7 Days saved
            handleExceptions: true,
            json: false,
            zippedArchive: true,
        }),
    ],
});

logger.add(
    new winston.transports.Console({
        format: winston.format.combine(winston.format.splat(), winston.format.colorize()),
    }),
);


export { logger };
