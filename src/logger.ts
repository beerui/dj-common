export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
}

export class Logger {
  private level: LogLevel

  constructor(
    private readonly name: string,
    level: LogLevel = 'warn'
  ) {
    this.level = level
  }

  setLevel(level: LogLevel): void {
    this.level = level
  }

  getLevel(): LogLevel {
    return this.level
  }

  debug(...values: unknown[]): void {
    this.logAtLevel('debug', console.debug, values)
  }

  info(...values: unknown[]): void {
    this.logAtLevel('info', console.info, values)
  }

  warn(...values: unknown[]): void {
    this.logAtLevel('warn', console.warn, values)
  }

  error(...values: unknown[]): void {
    this.logAtLevel('error', console.error, values)
  }

  private shouldLog(level: LogLevel): boolean {
    if (level === 'silent') {
      return false
    }
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level]
  }

  private logAtLevel(level: LogLevel, writer: (...args: unknown[]) => void, values: unknown[]): void {
    if (!this.shouldLog(level)) {
      return
    }
    writer(`[${this.name}]`, ...values)
  }
}
