export function fmt(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i]
}

export function fmtRate(bytesPerSec: number): string {
  return bytesPerSec > 0 ? fmt(bytesPerSec) + '/s' : '0 B/s'
}

export function barClass(p: number): string {
  return p < 50 ? 'low' : p < 75 ? 'mid' : p < 90 ? 'high' : 'critical'
}
