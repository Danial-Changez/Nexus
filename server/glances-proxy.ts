import { Router } from 'express'
import { DEFAULT_TIMEOUT_MS } from './http.ts'
import { logger } from './log.ts'

interface HostEntry {
  key: string
  url: string
}

const log = logger('glances')
const router = Router()

let hostMap = new Map<string, string>()

// Only the read-only endpoints the UI uses. Anything else (processlist,
// config, ../ paths) is refused so the proxy can't read beyond them.
const ALLOWED_PATH = /^api\/4\/(cpu|mem|fs|network|uptime|containers)(\/history)?$/

export function initGlancesProxy(hosts: HostEntry[]): void {
  hostMap = new Map(hosts.map(h => [h.key, h.url]))
  log.info(`Proxy initialized for ${hosts.length} host(s)`, hosts.map(h => h.key))
}

// Proxy /api/glances/:hostKey/* -> host's Glances API (read-only, GET only)
router.get('/api/glances/:hostKey/{*path}', async (req, res) => {
  const hostKey = req.params.hostKey
  const path = Array.isArray(req.params.path) ? req.params.path.join('/') : req.params.path
  const url = hostMap.get(hostKey)
  if (!url) {
    log.warn(`Unknown host key: ${hostKey}`)
    return res.status(404).json({ error: 'Unknown host' })
  }

  if (!ALLOWED_PATH.test(path ?? '')) return res.status(404).json({ error: 'Unknown Glances endpoint' })
  const target = `${url}/${path}`

  try {
    const resp = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) })
    const data = await resp.text()
    log.debug(`${hostKey} ${path}`, { status: resp.status })
    res.status(resp.status).type('json').send(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.error(`${hostKey} ${path} failed: ${message}`, { target })
    res.status(502).json({ error: `Upstream error: ${message}` })
  }
})

export const glancesMiddleware = router
