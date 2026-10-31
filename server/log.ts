const LEVELS: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const level = LEVELS[process.env.LOG_LEVEL || 'info'] ?? 1

function ts(): string {
  return new Date().toLocaleString('en-CA', {
    timeZone: process.env.TZ || 'UTC',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).replace(',', '')
}

function fmt(lvl: string, tag: string, msg: string, meta?: unknown): string {
  const base = `${ts()} [${lvl.toUpperCase()}] [${tag}] ${msg}`
  return meta !== undefined ? `${base} ${JSON.stringify(meta)}` : base
}

export interface Logger {
  debug: (msg: string, meta?: unknown) => void
  info:  (msg: string, meta?: unknown) => void
  warn:  (msg: string, meta?: unknown) => void
  error: (msg: string, meta?: unknown) => void
}

export function logger(tag: string): Logger {
  return {
    debug: (msg, meta) => { if (level <= 0) console.log(fmt('debug', tag, msg, meta)) },
    info:  (msg, meta) => { if (level <= 1) console.log(fmt('info', tag, msg, meta)) },
    warn:  (msg, meta) => { if (level <= 2) console.warn(fmt('warn', tag, msg, meta)) },
    error: (msg, meta) => { if (level <= 3) console.error(fmt('error', tag, msg, meta)) },
  }
}
