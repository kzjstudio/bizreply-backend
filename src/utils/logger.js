/**
 * Simple logger utility
 * You can replace this with Winston, Pino, or any other logging library
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

const log = (level, ...args) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  
  if (level === LOG_LEVELS.ERROR) {
    console.error(prefix, ...args);
  } else if (level === LOG_LEVELS.WARN) {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
};

export const logger = {
  error: (...args) => log(LOG_LEVELS.ERROR, ...args),
  warn: (...args) => log(LOG_LEVELS.WARN, ...args),
  info: (...args) => log(LOG_LEVELS.INFO, ...args),
  debug: (...args) => log(LOG_LEVELS.DEBUG, ...args)
};
