import express from 'express'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { logger } from './log.ts'
import { piholeMiddleware } from './pihole-proxy.ts'
import { mediaMiddleware } from './media-proxy.ts'
import { glancesMiddleware, initGlancesProxy } from './glances-proxy.ts'
import { wolMiddleware, initWol, type WolConfig } from './wol.ts'
import { videoDlMiddleware } from './video-dl-proxy.ts'
import { initStatus, statusMiddleware } from './status.ts'

const log = logger('server')
const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3000

interface NexusConfig {
  hosts?: { key: string; name: string; url: string; interface?: string }[]
  services?: { section: string; items: { name: string; icon: string; href: string; desc: string }[] }[]
  overview_services?: string[]
  wol?: WolConfig
}

// Load user config
const configPath = process.env.CONFIG_PATH || '/config/config.json'
let config: NexusConfig = {}
try {
  config = JSON.parse(readFileSync(configPath, 'utf-8'))
  log.info(`Loaded config from ${configPath}`, {
    hosts: (config.hosts || []).length,
    services: (config.services || []).flatMap(g => g.items).length,
  })
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error'
  log.warn(`Could not load config from ${configPath}: ${message}`)
}

// Initialize Glances proxy with host URLs from config
initGlancesProxy(config.hosts || [])
const wolEnabled = initWol(config.wol)
// A Set, so an href listed in two sections is checked once per run
initStatus([...new Set((config.services || []).flatMap(g => g.items.map(i => i.href)))])

const app = express()

// Config endpoint — whitelist what the frontend needs; internal details
// (glances URLs, MACs, ssh users, anything else in config.json) stay
// server-side.
const clientConfig = {
  hosts: (config.hosts || []).map(h => ({ key: h.key, name: h.name, interface: h.interface })),
  services: (config.services || []).map(g => ({
    section: g.section,
    items: g.items.map(({ name, icon, href, desc }) => ({ name, icon, href, desc })),
  })),
  overview_services: config.overview_services || [],
  wol: wolEnabled ? { name: config.wol!.name, hostname: config.wol!.hostname } : null,
}

app.get('/api/config', (_req, res) => {
  res.json(clientConfig)
})

// API middleware (before static files)
app.use(glancesMiddleware)
app.use(piholeMiddleware)
app.use(mediaMiddleware)
app.use(videoDlMiddleware)
app.use(wolMiddleware)
app.use(statusMiddleware)

// Serve static build
app.use(express.static(resolve(__dirname, '../dist')))

// SPA fallback
app.get('/{*splat}', (_req, res) => {
  res.sendFile(resolve(__dirname, '../dist/index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  log.info(`Nexus running on port ${PORT}`)
})
