import {LogLevel} from 'bunyan'

export function getLoglevel(): LogLevel {
  return process.env.LOGLEVEL as LogLevel ?? 'info'
}
