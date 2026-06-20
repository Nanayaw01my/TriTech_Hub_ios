const { createLogger, format, transports, addColors } = require('winston');
const { combine, timestamp, printf, colorize, errors } = format;

const isProduction = process.env.NODE_ENV === 'production';

// Add 'http' between info and verbose
const customLevels = {
  levels: { error: 0, warn: 1, info: 2, http: 3, debug: 4 },
  colors: { error: 'red', warn: 'yellow', info: 'green', http: 'cyan', debug: 'white' },
};
addColors(customLevels.colors);

const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return `${ts} [${level.toUpperCase()}]: ${stack || message}`;
});

const logger = createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'http'),
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    isProduction ? format.uncolorize() : colorize({ all: true }),
    logFormat
  ),
  transports: [new transports.Console()],
  exitOnError: false,
});

module.exports = logger;
