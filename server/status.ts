/**
 * Server-side service checks. Runs every service's href on a timer and
 * keeps a short history, so status reflects real HTTP responses (a 502
 * is down) and is the same for every viewer.
 */

import { jsonEndpoint } from './http.ts'
import { logger } from './log.ts'

const log = logger('status')
const INTERVAL_MS = 30_000
const TIMEOUT_MS = 5_000
const HISTORY = 30

export interface Check { up: boolean; latency: number | null; at: number; code?: number }

/** Per href: the last HISTORY checks, and when the current outage began (it can be older than the window). */
export interface ServiceHistory { history: Check[]; downSince?: number }

const services = new Map<string, ServiceHistory>()

export async function check(href: string): Promise<Check> {
  const start = performance.now()
  try {
    // redirect: 'manual' so a login redirect counts as up without following it
    const res = await fetch(href, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
    await res.body?.cancel()
    return { up: res.status < 500, latency: Math.round(performance.now() - start), at: Date.now(), code: res.status }
  } catch {
    return { up: false, latency: null, at: Date.now() }
  }
}

async function runAll(hrefs: string[]): Promise<void> {
  const results = await Promise.all(hrefs.map(async h => [h, await check(h)] as const))
  for (const [href, c] of results) record(href, c)
}

export function record(href: string, c: Check): void {
  const s = services.get(href) ?? { history: [] }
  if (c.up) {
    delete s.downSince
  } else if (s.downSince === undefined) {
    s.downSince = c.at
    if (s.history.at(-1)?.up) log.warn(`${href} went down`, { code: c.code })
  }
  s.history = [...s.history, c].slice(-HISTORY)
  services.set(href, s)
}

export function initStatus(hrefs: string[]): void {
  if (!hrefs.length) return
  runAll(hrefs)
  setInterval(() => runAll(hrefs), INTERVAL_MS).unref()
  log.info(`Checking ${hrefs.length} services every ${INTERVAL_MS / 1000}s`)
}

export const statusMiddleware = jsonEndpoint('/api/status', async () => Object.fromEntries(services), log)
