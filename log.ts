import fs from 'fs'
import { ILogObject, Logger } from 'tslog'

if (fs.existsSync('log.txt')) { // remove log file
    fs.unlinkSync('log.txt')
}

const writeLog = (log: ILogObject) => {
    let obj = {
        date: log.date,
        level: log.logLevel,
        file: `${log.fileName}:${log.lineNumber}`,
        message: log.argumentsArray
    }
    fs.appendFileSync('log.txt', JSON.stringify(obj, null, 2) + '\n')
}
export const logger = new Logger({ minLevel: "trace", suppressStdOutput: true })
logger.attachTransport({
    silly: writeLog,
    debug: writeLog,
    trace: writeLog,
    info: writeLog,
    warn: writeLog,
    error: writeLog,
    fatal: writeLog,
}, "debug")