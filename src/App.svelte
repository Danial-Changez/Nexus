<script lang="ts">
  import { onMount, tick } from 'svelte'
  import Sidebar from './lib/components/Sidebar.svelte'
  import Palette from './lib/components/Palette.svelte'
  import Overview from './pages/Overview.svelte'
  import Metrics from './pages/Metrics.svelte'
  import Services from './pages/Services.svelte'
  import Containers from './pages/Containers.svelte'
  import Network from './pages/Network.svelte'
  import Media from './pages/Media.svelte'
  import { poll } from './lib/utils/poll.js'
  import { hashPage } from './lib/utils/hash.js'
  import { PAGE_IDS } from './lib/pages.js'
  import { SVC_ICON, type Check, type Host, type HostData, type ServiceGroup, type ServiceItem, type ServiceStatus, type WolConfig, type WolStatus } from './lib/types.js'

  const NET_SAMPLES = 60

  let activePage = $state(PAGE_IDS.includes(hashPage()) ? hashPage() : 'overview')
  let collapsed = $state(false)
  let paletteOpen = $state(false)

  $effect(() => {
    if (hashPage() !== activePage) location.hash = activePage
  })

  function showPage(page: string) {
    if (page === activePage || !PAGE_IDS.includes(page)) return
    if (!document.startViewTransition) {
      activePage = page
      return
    }
    document.startViewTransition(() => {
      activePage = page
      return tick()
    })
  }

  // ── Config (loaded from server) ──
  let hosts = $state<Host[]>([])
  let services = $state<ServiceGroup[]>([])
  let overviewServiceNames = $state<string[]>([])
  let wolConfig = $state<WolConfig | null>(null)

  async function loadConfig() {
    try {
      const res = await fetch('/api/config')
      const config = await res.json()
      hosts = config.hosts || []
      overviewServiceNames = config.overview_services || []
      wolConfig = config.wol || null

      // Resolve short icon names to full URLs
      services = (config.services || []).map((group: ServiceGroup) => ({
        ...group,
        items: group.items.map((svc: ServiceItem) => ({
          ...svc,
          icon: svc.icon.startsWith('http')
            ? svc.icon
            : `${SVC_ICON}/${svc.icon}.svg`,
        })),
      }))
    } catch (err) {
      console.error('Failed to load config:', err)
    }
  }

  // ── Telemetry State ──
  let hostData = $state<Map<string, HostData>>(new Map())

  async function fetchHost(host: Host): Promise<HostData> {
    try {
      const g = `/api/glances/${host.key}`
      const [c, m, f, n, ch, up] = await Promise.all([
        fetch(`${g}/api/4/cpu`).then(r => r.json()),
        fetch(`${g}/api/4/mem`).then(r => r.json()),
        fetch(`${g}/api/4/fs`).then(r => r.json()),
        fetch(`${g}/api/4/network`).then(r => r.json()).catch(() => null),
        fetch(`${g}/api/4/cpu/history`).then(r => r.json()).catch(() => null),
        fetch(`${g}/api/4/uptime`).then(r => r.json()).catch(() => null),
      ])

      let net = null
      if (Array.isArray(n) && n.length) {
        const iface = host.interface
          ? (n.find((i: any) => i.interface_name === host.interface) ?? n[0])
          : (n.filter((i: any) => !(/^(lo|docker|veth|br-)/.test(i.interface_name)))
              .sort((a: any, b: any) => (b.bytes_all_rate_per_sec || 0) - (a.bytes_all_rate_per_sec || 0))[0]
            ?? n[0])
        net = {
          rx: iface.bytes_recv_rate_per_sec || 0,
          tx: iface.bytes_sent_rate_per_sec || 0,
        }
      }

      let cpuHistory = { user: [] as number[], system: [] as number[] }
      let cpuTimestamps: string[] = []
      if (ch) {
        if (ch.user) {
          cpuHistory.user = ch.user.map((p: [string, number]) => p[1])
          cpuTimestamps = ch.user.map((p: [string, number]) => p[0])
        }
        if (ch.system) cpuHistory.system = ch.system.map((p: [string, number]) => p[1])
      }

      return { cpu: c, mem: m, fs: Array.isArray(f) ? f[0] : f, net, cpuHistory, cpuTimestamps, uptime: up, updatedAt: Date.now() }
    } catch {
      return { error: true }
    }
  }

  async function refreshHosts() {
    if (!hosts.length) return
    const results = await Promise.all(
      hosts.map(async (h: Host): Promise<[string, HostData]> => {
        const prev = hostData.get(h.key)
        const next = await fetchHost(h)
        // Keep the last good values on failure, marked stale
        if (next.error) return [h.key, prev?.updatedAt ? { ...prev, stale: true } : next]
        const sample = (next.net?.rx ?? 0) + (next.net?.tx ?? 0)
        return [h.key, { ...next, netHistory: [...(prev?.netHistory ?? []), sample].slice(-NET_SAMPLES) }]
      })
    )
    hostData = new Map(results)
  }

  // ── Service Status (checked server-side, see server/status.ts) ──
  let serviceStatus = $state<Map<string, ServiceStatus>>(new Map())

  function toStatus(history: Check[]): ServiceStatus {
    const last = history.at(-1)
    if (!last) return { status: 'checking', latency: null, history }
    let downSince: number | undefined
    for (let i = history.length - 1; i >= 0 && !history[i].up; i--) downSince = history[i].at
    return { status: last.up ? 'up' : 'down', latency: last.latency, history, downSince }
  }

  async function refreshServices() {
    try {
      const res = await fetch('/api/status')
      if (!res.ok) return
      const data: Record<string, Check[]> = await res.json()
      serviceStatus = new Map(Object.entries(data).map(([href, h]) => [href, toStatus(h)]))
    } catch { /* keep last known; StatusLine shows its age */ }
  }

  // ── Upstream health (Pi-hole, media stack) for the Overview status sentence ──
  const MEDIA_NAMES: Record<string, string> = { qbit: 'qBittorrent', nzbget: 'NZBGet', sonarr: 'Sonarr', radarr: 'Radarr', prowlarr: 'Prowlarr' }
  let upstreamProblems = $state<string[]>([])

  async function refreshUpstreams() {
    const problems: string[] = []
    try {
      if (!(await fetch('/api/pihole/stats')).ok) problems.push('Pi-hole')
    } catch { problems.push('Pi-hole') }
    try {
      const res = await fetch('/api/media/stats')
      if (!res.ok) throw new Error()
      const stats: Record<string, { error?: string }> = await res.json()
      for (const [key, s] of Object.entries(stats)) {
        // Unconfigured services aren't problems, just absent
        if (s?.error && !/not configured/i.test(s.error)) problems.push(MEDIA_NAMES[key] ?? key)
      }
    } catch { problems.push('Media stack') }
    upstreamProblems = problems
  }

  // ── WoL Status ──
  let wolStatus = $state<WolStatus | null>(null)

  async function refreshWolStatus() {
    if (!wolConfig) return
    try {
      const res = await fetch('/api/wol/status')
      if (res.ok) wolStatus = await res.json()
    } catch { /* ignore */ }
  }

  // ── Keyboard: ⌘K / Ctrl+K or / opens the palette, 1–6 jump to pages ──
  function onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      paletteOpen = !paletteOpen
      return
    }
    const target = e.target as HTMLElement
    if (paletteOpen || e.metaKey || e.ctrlKey || e.altKey || target.closest('input, textarea, select, [contenteditable], dialog')) return
    if (e.key === '/') {
      e.preventDefault()
      paletteOpen = true
    } else if (/^[1-6]$/.test(e.key)) {
      location.hash = PAGE_IDS[+e.key - 1]
    }
  }

  // ── Init & Intervals ──
  onMount(() => {
    const onHashChange = () => showPage(hashPage())
    window.addEventListener('hashchange', onHashChange)
    let stops: (() => void)[] = []
    loadConfig().then(() => {
      stops = [
        poll(refreshHosts, 10000),
        poll(refreshServices, 30000),
        poll(refreshWolStatus, 10000),
        poll(refreshUpstreams, 60000),
      ]
    })
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      stops.forEach(stop => stop())
    }
  })
</script>

<svelte:window onkeydown={onKeydown} />

<div class="app-layout">
  <Sidebar {activePage} bind:collapsed onsearch={() => paletteOpen = true} />

  <main class="main-content" class:sidebar-collapsed={collapsed}>
    {#if activePage === 'overview'}
      <Overview {hosts} {services} {overviewServiceNames} {hostData} {serviceStatus} {upstreamProblems} {wolConfig} {wolStatus} />
    {:else if activePage === 'metrics'}
      <Metrics {hosts} {hostData} />
    {:else if activePage === 'services'}
      <Services {services} {serviceStatus} />
    {:else if activePage === 'containers'}
      <Containers {hosts} />
    {:else if activePage === 'network'}
      <Network {hosts} />
    {:else if activePage === 'media'}
      <Media />
    {/if}
  </main>
</div>

<Palette bind:open={paletteOpen} {hosts} {services} {serviceStatus} {wolConfig} {wolStatus} />

<style>
  .app-layout {
    display: flex;
    min-height: 100vh;
  }

  /* Floating content panel beside the floating sidebar (Arcane shell); the panel scrolls, not the window */
  .main-content {
    flex: 1;
    min-width: 0;
    height: calc(100dvh - 1rem);
    margin: 0.5rem 0.5rem 0.5rem var(--sidebar-width);
    padding: 1.25rem 1.5rem 1rem;
    overflow-y: auto;
    overflow-x: clip;
    background: var(--background);
    border-radius: var(--radius);
    box-shadow: var(--shell-shadow);
    transition: margin-left 200ms ease-out;
    position: relative;
    z-index: 1;
  }

  .main-content.sidebar-collapsed {
    margin-left: var(--sidebar-collapsed-width);
  }

  @media (max-width: 768px) {
    .main-content {
      margin-left: var(--sidebar-collapsed-width);
      padding: 1.25rem 1rem;
    }
  }

  /* Phone: no panel, the page scrolls under the floating tab bar */
  @media (max-width: 480px) {
    .main-content,
    .main-content.sidebar-collapsed {
      height: auto;
      margin: 0;
      overflow: clip;
      border-radius: 0;
      box-shadow: none;
      padding: 1.25rem 0.75rem calc(var(--tabbar-height) + var(--tabbar-inset) + 1.5rem);
    }
  }
</style>
