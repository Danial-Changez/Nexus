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

export interface ServiceStatus {
  status: 'up' | 'down' | 'checking'
  latency: number | null
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
