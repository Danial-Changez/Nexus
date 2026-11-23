// ── Domain types shared across components ──────────────────────────

export const SVC_ICON = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg'

// The glances URL stays server-side; the frontend reaches hosts via /api/glances/:key
export interface Host {
  key: string
  name: string
  interface?: string
}

export interface NetData {
  rx: number
  tx: number
}

export interface HostData {
  error?: boolean
  cpu?: { total: number; cpucore?: number }
  mem?: { percent: number; used: number; total: number }
  fs?: { percent: number; used: number; size: number }
  net?: NetData | null
  cpuHistory?: { user: number[]; system: number[] }
  cpuTimestamps?: string[]
  uptime?: string
  netHistory?: number[]   // rx+tx samples from the 10s poll, for the Overview sparkline
  updatedAt?: number      // last successful fetch
  stale?: boolean         // latest fetch failed; values are from updatedAt
}

export interface ServiceItem {
  name: string
  icon: string
  href: string
  desc: string
}

export interface ServiceGroup {
  section: string
  items: ServiceItem[]
}

export interface Check {
  up: boolean
  latency: number | null
  at: number
  code?: number
}

/** One entry of /api/status (see server/status.ts). */
export interface ServiceHistory {
  history: Check[]
  downSince?: number
}

export interface ServiceStatus {
  status: 'up' | 'down' | 'checking'
  latency: number | null
  history: Check[]
  downSince?: number
}

// Only the display fields are sent to the client; MAC, ssh user, and
// broadcast address stay server-side.
export interface WolConfig {
  name?: string
  hostname: string
}

export interface WolStatus {
  name: string
  online: boolean
}
