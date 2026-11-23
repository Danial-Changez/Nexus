/**
 * Proxies video-dl status API calls and returns them for the Nexus media
 * dashboard.
 */

import { cached, fetchJson, jsonEndpoint } from './http.ts'
import { logger } from './log.ts'

const log = logger('video-dl')
const VIDEO_DL_URL = process.env.VIDEO_DL_1_URL || ''
const FETCH_TIMEOUT_MS = 4000

async function getVideoDlStats() {
  if (!VIDEO_DL_URL) return { stacks: [], error: 'VIDEO_DL_1_URL not configured' }

  try {
    const [status, history] = await Promise.all([
      fetchJson(`${VIDEO_DL_URL}/status`, {}, FETCH_TIMEOUT_MS),
      fetchJson(`${VIDEO_DL_URL}/history`, {}, FETCH_TIMEOUT_MS),
    ])
    return {
      stacks: [{ online: true }],
      active: status.active || [],
      recent_attempts: (history.recent_attempts || [])
        .sort((a: any, b: any) => b.at.localeCompare(a.at))
        .slice(0, 20),
      tracked_count: (history.tracked_series || []).length,
      queued: status.queued || 0,
      resolving: status.resolving || 0,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.debug(`video-dl unreachable: ${message}`)
    return { stacks: [{ online: false, error: message }], active: [], recent_attempts: [], tracked_count: 0, queued: 0, resolving: 0 }
  }
}

export const videoDlMiddleware = jsonEndpoint('/api/video-dl', cached(getVideoDlStats, 1_000), log)
