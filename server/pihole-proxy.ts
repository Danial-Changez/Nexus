/**
 * Proxies Pi-hole v6 API stats with server-side auth.
 */

import type { Plugin } from 'vite'
import { cached, jsonEndpoint } from './http.ts'
import { logger } from './log.ts'

const log = logger('pihole')
const PIHOLE_URL = process.env.PIHOLE_URL || ''
const PIHOLE_PASSWORD = process.env.PIHOLE_PASSWORD || ''

let sessionId: string | null = null

async function authenticate(): Promise<string> {
  log.info('Authenticating with Pi-hole')
  const res = await fetch(`${PIHOLE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PIHOLE_PASSWORD }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Pi-hole auth failed: ${res.status}`)
  const data: any = await res.json()
  sessionId = data.session?.sid
  if (!sessionId) throw new Error('No session ID returned')
  log.info('Pi-hole authenticated')
  return sessionId
}

export async function piholeRequest(path: string, retry = true): Promise<any> {
  if (!sessionId) await authenticate()
  const res = await fetch(`${PIHOLE_URL}/api${path}`, {
    headers: { sid: sessionId! },
    signal: AbortSignal.timeout(10_000),
  })
  if (res.status === 401 && retry) {
    log.warn('Pi-hole session expired, re-authenticating')
    sessionId = null
    return piholeRequest(path, false)
  }
  if (!res.ok) throw new Error(`Pi-hole API error: ${res.status}`)
  return res.json()
}

// Short cache so several open dashboards share one upstream request
export const piholeMiddleware = jsonEndpoint('/api/pihole/stats', cached(() => piholeRequest('/stats/summary'), 5_000), log)

export default function piholeProxy(): Plugin {
  return {
    name: 'pihole-proxy',
    configureServer(server) {
      server.middlewares.use(piholeMiddleware as any)
    },
  }
}
