<script lang="ts">
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import Sidebar from './lib/components/Sidebar.svelte'
  import Overview from './pages/Overview.svelte'
  import Metrics from './pages/Metrics.svelte'
  import Services from './pages/Services.svelte'
  import Containers from './pages/Containers.svelte'
  import Network from './pages/Network.svelte'
  import Media from './pages/Media.svelte'
  import { SVC_ICON, type Host, type HostData, type ServiceGroup, type ServiceItem, type ServiceStatus, type WolConfig, type WolStatus } from './lib/types.js'

  const VALID_PAGES = new Set(['overview', 'metrics', 'services', 'containers', 'network', 'media'])
  const initialHash = window.location.hash.slice(1)
  let activePage = $state(VALID_PAGES.has(initialHash) ? initialHash : 'overview')
  let collapsed = $state(false)
  let mobileOpen = $state(false)

  $effect(() => {
    if (window.location.hash !== `#${activePage}`) window.location.hash = activePage
  })

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
  let onlineCount = $state(0)

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

      return { cpu: c, mem: m, fs: Array.isArray(f) ? f[0] : f, net, cpuHistory, cpuTimestamps, uptime: up }
    } catch {
      return { error: true }
    }
  }

  async function refreshHosts() {
    if (!hosts.length) return
    const results = await Promise.all(
      hosts.map(async (h: Host): Promise<[string, HostData]> => [h.key, await fetchHost(h)])
    )
    hostData = new Map(results)
    onlineCount = [...hostData.values()].filter(d => d && !d.error).length
  }

  // ── Service Status ──
  let serviceStatus = $state<Map<string, ServiceStatus>>(new Map())

  async function checkService(svc: ServiceItem): Promise<ServiceStatus> {
    const start = performance.now()
    try {
      await fetch(svc.href, { mode: 'no-cors', cache: 'no-store' })
      return { status: 'up', latency: Math.round(performance.now() - start) }
    } catch {
      return { status: 'down', latency: null }
    }
  }

  async function refreshServices() {
    if (!services.length) return
    const allItems = services.flatMap(g => g.items)
    const results = await Promise.allSettled(
      allItems.map(async (svc: ServiceItem): Promise<[string, ServiceStatus]> => [svc.href, await checkService(svc)])
    )
    const newMap = new Map<string, ServiceStatus>()
    for (const r of results) {
      if (r.status === 'fulfilled') newMap.set(r.value[0], r.value[1])
    }
    serviceStatus = newMap
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

  // ── Init & Intervals ──
  onMount(() => {
    const onHashChange = () => {
      const page = window.location.hash.slice(1)
      if (VALID_PAGES.has(page)) activePage = page
    }
    window.addEventListener('hashchange', onHashChange)
    loadConfig().then(() => {
      refreshHosts()
      refreshServices()
      refreshWolStatus()
    })
    const hostInterval = setInterval(refreshHosts, 10000)
    const svcInterval = setInterval(refreshServices, 30000)
    const wolInterval = setInterval(refreshWolStatus, 10000)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      clearInterval(hostInterval)
      clearInterval(svcInterval)
      clearInterval(wolInterval)
    }
  })
</script>

<div class="app-layout">
  <Sidebar bind:activePage bind:collapsed bind:mobileOpen />

  <button class="mobile-menu-btn" onclick={() => mobileOpen = !mobileOpen} aria-label="Menu">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
    </svg>
  </button>

  <main class="main-content" class:sidebar-collapsed={collapsed}>
    {#key activePage}
      <div in:fade={{ duration: 150 }}>
        {#if activePage === 'overview'}
          <Overview {hosts} {services} {overviewServiceNames} {hostData} {onlineCount} {serviceStatus} {wolConfig} {wolStatus} />
        {:else if activePage === 'metrics'}
          <Metrics {hosts} {hostData} {onlineCount} />
        {:else if activePage === 'services'}
          <Services {services} {serviceStatus} />
        {:else if activePage === 'containers'}
          <Containers {hosts} />
        {:else if activePage === 'network'}
          <Network {hosts} />
        {:else if activePage === 'media'}
          <Media />
        {/if}
      </div>
    {/key}
  </main>
</div>

<style>
  .app-layout {
    display: flex;
    min-height: 100vh;
  }

  .main-content {
    flex: 1;
    margin-left: var(--sidebar-width);
    padding: 1.5rem 2rem 1rem;
    max-width: calc(100vw - var(--sidebar-width));
    transition: margin-left 200ms ease, max-width 200ms ease;
    position: relative;
    z-index: 1;
    overflow: clip;
  }

  .main-content.sidebar-collapsed {
    margin-left: var(--sidebar-collapsed-width);
    max-width: calc(100vw - var(--sidebar-collapsed-width));
  }

  @media (max-width: 768px) {
    .main-content {
      margin-left: var(--sidebar-collapsed-width);
      max-width: calc(100vw - var(--sidebar-collapsed-width));
      padding: 1.5rem 1rem;
    }
  }

  .mobile-menu-btn {
    display: none;
  }

  @media (max-width: 480px) {
    .main-content {
      margin-left: 0;
      max-width: 100vw;
      padding: 3.5rem 1rem 1rem;
    }

    .mobile-menu-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      position: fixed;
      top: 0.75rem;
      left: 0.75rem;
      z-index: 150;
      width: 36px;
      height: 36px;
      background: var(--sidebar-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--muted-foreground);
      cursor: pointer;
      transition: color 150ms ease;
    }

    .mobile-menu-btn:hover {
      color: var(--foreground);
    }
  }
</style>
