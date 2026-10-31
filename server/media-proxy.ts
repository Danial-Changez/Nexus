/**
 * Proxies media service APIs (qBittorrent, NZBGet, Sonarr, Radarr, Prowlarr)
 * with server-side auth so API keys stay off the client.
 */

import type { Plugin } from 'vite'
import { fetchJson, cached, jsonEndpoint } from './http.ts'
import { logger } from './log.ts'

const log = logger('media')
const env = process.env

// ── Config ──────────────────────────────────────────────────────
const QBIT_URL   = env.QBIT_URL   || ''
const QBIT_USER  = env.HOMEPAGE_VAR_QBIT_USER  || ''
const QBIT_PASS  = env.HOMEPAGE_VAR_QBIT_PASS  || ''

const NZBGET_URL  = env.NZBGET_URL  || ''
const NZBGET_USER = env.HOMEPAGE_VAR_NZBGET_USER || ''
const NZBGET_PASS = env.HOMEPAGE_VAR_NZBGET_PASS || ''

const SONARR_URL = env.SONARR_URL || ''
const SONARR_KEY = env.HOMEPAGE_VAR_SONARR_KEY || ''

const RADARR_URL = env.RADARR_URL || ''
const RADARR_KEY = env.HOMEPAGE_VAR_RADARR_KEY || ''

const PROWLARR_URL = env.PROWLARR_URL || ''
const PROWLARR_KEY = env.HOMEPAGE_VAR_PROWLARR_KEY || ''

// ── qBittorrent (session cookie auth) ───────────────────────────
// After a failed login, back off instead of retrying every poll —
// repeated failures trigger qBittorrent's client IP ban.
const QBIT_AUTH_BACKOFF_MS = 60_000
let qbitCookie: string | null = null
let qbitAuthFailedAt = 0
let qbitAuthInflight: Promise<string | null> | null = null

async function qbitAuth(): Promise<string | null> {
  if (Date.now() - qbitAuthFailedAt < QBIT_AUTH_BACKOFF_MS) {
    throw new Error('qBit auth failed recently, backing off')
  }
  log.info('Authenticating with qBittorrent')
  try {
    const body = new URLSearchParams({ username: QBIT_USER, password: QBIT_PASS })
    const res = await fetch(`${QBIT_URL}/api/v2/auth/login`, {
      method: 'POST',
      headers: {
        Referer: QBIT_URL,
        Origin: QBIT_URL,
      },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
    // A session cookie (SID in v4, QBT_SID_<port> in v5.2+) is only set on success; v5.2+ sends no "Ok." body
    const sc = res.headers.getSetCookie?.() || []
    const sid = sc.map(c => c.split(';')[0]).find(c => c.includes('SID'))
    if (!res.ok || !sid) {
      const text = (await res.text()).trim()
      throw new Error(`qBit auth failed (${res.status}${text ? ` ${text}` : ''})`)
    }
    qbitCookie = sid
  } catch (err) {
    qbitAuthFailedAt = Date.now()
    throw err
  }
  log.info('qBittorrent authenticated')
  return qbitCookie
}

async function qbitFetch(path: string, retry = true): Promise<any> {
  if (!qbitCookie) {
    // Share one in-flight login — parallel failures each count toward qBit's IP ban
    qbitAuthInflight ??= qbitAuth().finally(() => { qbitAuthInflight = null })
    await qbitAuthInflight
  }
  const res = await fetch(`${QBIT_URL}/api/v2${path}`, {
    headers: { Cookie: qbitCookie! },
    signal: AbortSignal.timeout(10_000),
  })
  if (res.status === 403 && retry) {
    log.warn('qBit session expired, re-authenticating')
    qbitCookie = null
    return qbitFetch(path, false)
  }
  if (!res.ok) throw new Error(`qBit API error: ${res.status}`)
  return res.json()
}

async function getQbitStats() {
  const [transfer, torrents] = await Promise.all([
    qbitFetch('/transfer/info'),
    qbitFetch('/torrents/info'),
  ])

  const active = torrents.filter((t: any) =>
    ['downloading', 'uploading', 'stalledDL', 'stalledUP', 'forcedDL', 'forcedUP', 'queuedDL', 'queuedUP', 'checkingDL', 'checkingUP', 'moving'].includes(t.state)
  )

  return {
    dl_speed: transfer.dl_info_speed || 0,
    up_speed: transfer.up_info_speed || 0,
    dl_total: transfer.dl_info_data || 0,
    up_total: transfer.up_info_data || 0,
    status: transfer.connection_status || 'unknown',
    total: torrents.length,
    active: active.length,
    downloading: torrents.filter((t: any) => ['downloading', 'forcedDL', 'stalledDL'].includes(t.state)).length,
    seeding: torrents.filter((t: any) => ['uploading', 'forcedUP', 'stalledUP'].includes(t.state)).length,
    torrents: active.slice(0, 5).map((t: any) => ({
      name: t.name,
      state: t.state,
      progress: t.progress,
      size: t.size,
      dlspeed: t.dlspeed,
      upspeed: t.upspeed,
      eta: t.eta,
    })),
  }
}

// ── NZBGet (HTTP basic auth via JSON-RPC) ────────────────────────
async function getNzbgetStats() {
  const auth = Buffer.from(`${NZBGET_USER}:${NZBGET_PASS}`).toString('base64')
  const rpc = (method: string) => fetchJson(`${NZBGET_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({ method, params: [] }),
  })
  const [statusData, groupsData] = await Promise.all([rpc('status'), rpc('listgroups')])

  const status: any = statusData.result
  const groups: any[] = groupsData.result || []

  const activeGroups = groups.filter((g: any) => g.Status === 'DOWNLOADING' || g.Status === 'QUEUED' || g.Status === 'PAUSED')

  return {
    dl_speed: status.DownloadRate || 0,
    remaining_mb: status.RemainingSizeMB || 0,
    downloaded_mb: status.DownloadedSizeMB || 0,
    paused: status.DownloadPaused || false,
    active: activeGroups.length,
    total: groups.length,
    groups: activeGroups.slice(0, 5).map((g: any) => ({
      name: g.NZBName,
      status: g.Status,
      remaining_mb: g.RemainingSizeMB,
      size_mb: g.FileSizeMB,
      progress: g.FileSizeMB > 0 ? (g.FileSizeMB - g.RemainingSizeMB) / g.FileSizeMB : 0,
    })),
  }
}

// ── Sonarr / Radarr (API key header) ────────────────────────────
async function getArrStats(url: string, apiKey: string, name: string) {
  const [queue, wanted] = await Promise.all([
    fetchJson(`${url}/api/v3/queue?pageSize=50&includeUnknownSeriesItems=true`, {
      headers: { 'X-Api-Key': apiKey },
    }).catch((err: Error) => { throw new Error(`${name} queue error: ${err.message}`) }),
    fetchJson(`${url}/api/v3/wanted/missing?pageSize=1`, {
      headers: { 'X-Api-Key': apiKey },
    }).catch(() => ({ totalRecords: 0 })),
  ])

  const records = queue.records || []

  return {
    queue_count: queue.totalRecords || 0,
    missing: wanted.totalRecords || 0,
    downloading: records.filter((r: any) => r.status === 'downloading').length,
    warning: records.filter((r: any) => r.trackedDownloadStatus === 'warning').length,
    items: records.slice(0, 5).map((r: any) => ({
      title: r.title,
      status: r.status,
      timeleft: r.timeleft,
      size: r.size,
      sizeleft: r.sizeleft,
      progress: r.size > 0 ? (r.size - r.sizeleft) / r.size : 0,
      downloadClient: r.downloadClient,
    })),
  }
}

// ── Prowlarr (indexer stats) ─────────────────────────────────────
async function getProwlarrStats() {
  const data: any = await fetchJson(`${PROWLARR_URL}/api/v1/indexerstats`, {
    headers: { 'X-Api-Key': PROWLARR_KEY },
  })
  const indexers = data.indexers || []

  const totals = indexers.reduce((acc: { queries: number; grabs: number; fails: number }, i: any) => ({
    queries: acc.queries + (i.numberOfQueries || 0),
    grabs: acc.grabs + (i.numberOfGrabs || 0),
    fails: acc.fails + (i.numberOfFailedQueries || 0),
  }), { queries: 0, grabs: 0, fails: 0 })

  return {
    indexer_count: indexers.length,
    ...totals,
  }
}

// ── Aggregate endpoint ───────────────────────────────────────────
const SERVICES: { key: string; url: string; fetch: () => Promise<any> }[] = [
  { key: 'qbit',     url: QBIT_URL,     fetch: getQbitStats },
  { key: 'nzbget',   url: NZBGET_URL,   fetch: getNzbgetStats },
  { key: 'sonarr',   url: SONARR_URL,   fetch: () => getArrStats(SONARR_URL, SONARR_KEY, 'Sonarr') },
  { key: 'radarr',   url: RADARR_URL,   fetch: () => getArrStats(RADARR_URL, RADARR_KEY, 'Radarr') },
  { key: 'prowlarr', url: PROWLARR_URL, fetch: getProwlarrStats },
]

const unconfigured = SERVICES.filter(s => !s.url).map(s => s.key)
if (unconfigured.length) log.info(`Not configured, skipping: ${unconfigured.join(', ')}`)

async function getAllMediaStats() {
  const active = SERVICES.filter(s => s.url)
  const results = await Promise.allSettled(active.map(s => s.fetch()))

  const stats: Record<string, any> = {}
  for (const s of SERVICES.filter(s => !s.url)) stats[s.key] = { error: 'not configured' }
  active.forEach((s, i) => {
    const r = results[i]
    stats[s.key] = r.status === 'fulfilled' ? r.value : { error: r.reason?.message }
  })

  const failed = active.filter(s => stats[s.key].error).map(s => s.key)
  if (failed.length) log.warn(`Failed to fetch: ${failed.join(', ')}`)
  log.debug('Media stats fetched')

  return stats
}

// Short cache so several open dashboards share one upstream fan-out
export const mediaMiddleware = jsonEndpoint('/api/media/stats', cached(getAllMediaStats, 5_000), log)

export default function mediaProxy(): Plugin {
  return {
    name: 'media-proxy',
    configureServer(server) {
      server.middlewares.use(mediaMiddleware as any)
    },
  }
}
