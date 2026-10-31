/**
 * Shared upstream-fetch helpers: every proxied call gets a timeout, and
 * polled aggregate endpoints can be wrapped in a short TTL cache so
 * multiple open dashboards don't multiply upstream load.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import type { Logger } from './log.ts'

export const DEFAULT_TIMEOUT_MS = 10_000

export async function fetchJson<T = any>(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

/**
 * Wraps an async producer with a TTL cache. Concurrent callers share the
 * in-flight promise; rejections are not cached so the next call retries.
 */
export function cached<T>(fn: () => Promise<T>, ttlMs: number): () => Promise<T> {
  let value: Promise<T> | null = null
  let expires = 0
  return () => {
    if (!value || Date.now() > expires) {
      expires = Date.now() + ttlMs
      value = fn()
      value.catch(() => { value = null })
    }
    return value
  }
}

/** Connect-style middleware answering one GET url with fn()'s JSON, 502 on error. */
export function jsonEndpoint(url: string, fn: () => Promise<unknown>, log: Logger) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (req.url !== url) return next()
    fn()
      .then(data => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(data))
      })
      .catch((err: Error) => {
        log.error(`${url} failed: ${err.message}`)
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: err.message }))
      })
  }
}
