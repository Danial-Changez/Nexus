export function fmt(bytes: number): string {
  if (!(bytes >= 1)) return '0 B' // also covers NaN, negatives and fractions
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), s.length - 1)
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i]
}

export function fmtRate(bytesPerSec: number): string {
  return bytesPerSec > 0 ? fmt(bytesPerSec) + '/s' : '0 B/s'
}

/** Bullet-graph thresholds: color appears only once a band is crossed. */
export const WARN_AT = 70
export const CRIT_AT = 90

export function barClass(p: number): 'ok' | 'warn' | 'crit' {
  return p < WARN_AT ? 'ok' : p < CRIT_AT ? 'warn' : 'crit'
}

export function fmtAgo(ms: number, now = Date.now()): string {
  const secs = Math.max(0, Math.floor((now - ms) / 1000))
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export function fmtDuration(ms: number): string {
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'under a minute'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  return mins % 60 ? `${h}h ${mins % 60}m` : `${h}h`
}

/** Turn an upstream error into something the reader can act on. */
export function errorHint(service: string, msg = ''): string {
  if (/40[13]/.test(msg)) return `${service} rejected the credentials (${msg}). Check its API key in .env.`
  if (/timeout|abort/i.test(msg)) return `${service} didn't respond in time. Check that it's running.`
  if (/not configured/i.test(msg)) return `${service} isn't configured. Add its URL and key to .env.`
  return msg ? `${service} returned an error: ${msg}` : `Couldn't reach ${service}.`
}
