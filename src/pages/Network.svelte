<script lang="ts">
  import { onMount } from 'svelte'
  import type { Host } from '../lib/types.js'
  import { fmtRate, fmt } from '../lib/utils/format.js'
  import { cutoffIndex } from '../lib/utils/chart.js'
  import Sparkline from '../lib/components/Sparkline.svelte'
  import Selector from '../lib/components/Selector.svelte'
  import PiholeStats from '../lib/components/PiholeStats.svelte'
  import PageHeader from '../lib/components/PageHeader.svelte'
  import Icon from '../lib/components/Icon.svelte'

  const HOST_ICONS: Record<string, string> = { docker: 'container', proxmox: 'server', truenas: 'hardDrive' }

  interface Props {
    hosts?: Host[]
  }

  let { hosts = [] }: Props = $props()

  // Current interface data + history snapshots for charts
  let networkData = $state(new Map())
  let historySnapshot = $state(new Map())
  let loading = $state(true)

  const HISTORY_LENGTH = 2880   // ~30s poll × 2880 = 24h of data
  const POLL_INTERVAL  = 30000 // 30 seconds between fetches

  // Time range options
  const RANGES = [
    { label: '10m', seconds: 600 },
    { label: '30m', seconds: 1800 },
    { label: '1h',  seconds: 3600 },
    { label: '6h',  seconds: 21600 },
    { label: '24h', seconds: 86400 },
  ]
  let activeLabel = $state('1h')
  let activeRange = $derived(RANGES.find(r => r.label === activeLabel) ?? RANGES[2])

  // Mutable history store (not reactive — we snapshot it into state when needed)
  const _hist = new Map()

  function snapshotHistory() {
    const snap = new Map()

    for (const [hostKey, ifaceMap] of _hist) {
      const inner = new Map()
      for (const [ifaceName, h] of ifaceMap) {
        const startIdx = cutoffIndex(h.ts, activeRange.seconds)
        inner.set(ifaceName, {
          rx: h.rx.slice(startIdx),
          tx: h.tx.slice(startIdx),
          ts: h.ts.slice(startIdx),
        })
      }
      snap.set(hostKey, inner)
    }
    historySnapshot = snap
  }

  async function fetchNetworkForHost(host: Host): Promise<[string, any[]] | null> {
    try {
      const res = await fetch(`/api/glances/${host.key}/api/4/network`)
      const data = await res.json()
      if (!Array.isArray(data)) return null

      const interfaces = data.filter((i: any) => {
        if (/^(lo)$/.test(i.interface_name)) return false
        if (host.interface) return i.interface_name === host.interface
        return true
      })

      // Append to history
      if (!_hist.has(host.key)) _hist.set(host.key, new Map())
      const hostH = _hist.get(host.key)
      const now = new Date().toISOString()

      for (const iface of interfaces) {
        const name = iface.interface_name
        if (!hostH.has(name)) hostH.set(name, { rx: [], tx: [], ts: [] })
        const h = hostH.get(name)
        h.rx.push(iface.bytes_recv_rate_per_sec || 0)
        h.tx.push(iface.bytes_sent_rate_per_sec || 0)
        h.ts.push(now)
        if (h.rx.length > HISTORY_LENGTH) {
          h.rx = h.rx.slice(-HISTORY_LENGTH)
          h.tx = h.tx.slice(-HISTORY_LENGTH)
          h.ts = h.ts.slice(-HISTORY_LENGTH)
        }
      }

      return [host.key, interfaces]
    } catch {
      return null
    }
  }

  async function fetchNetwork() {
    const results = await Promise.all(hosts.map(fetchNetworkForHost))
    const newData = new Map()
    for (const r of results) {
      if (r) newData.set(r[0], r[1])
    }
    networkData = newData
    snapshotHistory()
    loading = false
  }

  // Filter out Glances counter-reset spikes (replace with 0)
  const SPIKE_THRESHOLD = 312_500_000 // 2.5 Gbps = 312.5 MB/s max realistic rate
  function cleanRates(arr: number[]): number[] {
    return arr.map((v: number) => (v != null && v >= 0 && v <= SPIKE_THRESHOLD) ? v : 0)
  }

  async function fetchHistoryForHost(host: Host) {
    try {
      const res = await fetch(`/api/glances/${host.key}/api/4/network/history`)
      if (!res.ok) return
      const data = await res.json()
      if (typeof data !== 'object' || data === null) return

      if (!_hist.has(host.key)) _hist.set(host.key, new Map())
      const hostH = _hist.get(host.key)

      // Glances v4 returns flat keys: "eth0_bytes_recv_rate_per_sec", etc.
      const ifaceKeys = new Map()
      for (const key of Object.keys(data)) {
        const rxMatch = key.match(/^(.+)_bytes_recv_rate_per_sec$/)
        if (rxMatch) ifaceKeys.set(rxMatch[1], true)
      }

      for (const [ifaceName] of ifaceKeys) {
        if (ifaceName === 'lo') continue
        if (host.interface && ifaceName !== host.interface) continue
        const rxKey = `${ifaceName}_bytes_recv_rate_per_sec`
        const txKey = `${ifaceName}_bytes_sent_rate_per_sec`
        const rxArr = (data[rxKey] || []) as any[]
        const txArr = (data[txKey] || []) as any[]
        if (rxArr.length > 0 && Array.isArray(rxArr[0])) {
          hostH.set(ifaceName, {
            rx: cleanRates(rxArr.slice(-HISTORY_LENGTH).map((p: [unknown, number]) => p[1])),
            tx: cleanRates(txArr.slice(-HISTORY_LENGTH).map((p: [unknown, number]) => p[1])),
            ts: rxArr.slice(-HISTORY_LENGTH).map((p: [string, unknown]) => p[0]),
          })
        }
      }

    } catch {
      // Endpoint may not exist
    }
  }

  async function fetchNetworkHistory() {
    await Promise.all(hosts.map(fetchHistoryForHost))
    snapshotHistory()
  }

  onMount(() => {
    fetchNetworkHistory()
    fetchNetwork()
    const interval = setInterval(fetchNetwork, POLL_INTERVAL)
    return () => clearInterval(interval)
  })

  // Total bandwidth: exclude docker VM — its ens18 traffic is already carried by proxmox nic0
  let totals = $derived(
    [...networkData.entries()]
      .filter(([key]) => key !== 'docker')
      .flatMap(([, ifaces]) => ifaces)
      .reduce((t, i) => ({ rx: t.rx + (i.bytes_recv_rate_per_sec || 0), tx: t.tx + (i.bytes_sent_rate_per_sec || 0) }), { rx: 0, tx: 0 })
  )
</script>

<PageHeader title="Network" subtitle="Interface Traffic across all Hosts">
  <div class="page-stat">
    <span class="stat-icon rx"><Icon name="arrowDown" size="18px" /></span>
    <div>
      <div class="page-stat-value rx">{fmtRate(totals.rx)}</div>
      <div class="page-stat-label">Total RX</div>
    </div>
  </div>
  <div class="page-divider"></div>
  <div class="page-stat">
    <span class="stat-icon tx"><Icon name="arrowUp" size="18px" /></span>
    <div>
      <div class="page-stat-value tx">{fmtRate(totals.tx)}</div>
      <div class="page-stat-label">Total TX</div>
    </div>
  </div>
</PageHeader>

<div class="controls-bar">
  <Selector options={RANGES} value={activeLabel} onselect={k => { activeLabel = k; snapshotHistory() }} />
</div>

<PiholeStats />

{#each hosts as host (host.key)}
  {@const interfaces = networkData.get(host.key) ?? []}
  <div class="host-section">
    <div class="host-label">
      <span class="host-label-icon"><Icon name={HOST_ICONS[host.key] ?? 'server'} size="16px" /></span>
      {host.name}
      {#if interfaces.length > 0}
        <span class="host-iface-count">{interfaces.length} interfaces</span>
      {/if}
    </div>

    {#if interfaces.length === 0}
      <div class="empty-hint loading-pulse">{loading ? 'Loading...' : 'Host unreachable'}</div>
    {:else}
      {#each interfaces as iface (iface.interface_name)}
        {@const hist = historySnapshot?.get(host.key)?.get(iface.interface_name)}
        {@const isPhysical = !(/^(docker|veth|br-)/.test(iface.interface_name))}
        <div class="iface-card card" class:secondary={!isPhysical}>
          <div class="iface-header">
            <span class="iface-icon" class:physical={isPhysical}><Icon name="global" size="18px" /></span>
            <span class="iface-name">{iface.interface_name}</span>
            {#if iface.is_up !== undefined}
              <span class="iface-badge" class:up={iface.is_up} class:down={!iface.is_up}>
                {iface.is_up ? 'Up' : 'Down'}
              </span>
            {/if}
          </div>

          <!-- Current rates -->
          <div class="iface-rates">
            <div class="rate-box rx">
              <span class="rate-icon rx"><Icon name="arrowDown" size="16px" /></span>
              <div class="rate-info">
                <span class="rate-label">Download</span>
                <span class="rate-value">{fmtRate(iface.bytes_recv_rate_per_sec)}</span>
              </div>
              {#if iface.bytes_recv != null}
                <span class="rate-total">{fmt(iface.bytes_recv)} total</span>
              {/if}
            </div>
            <div class="rate-box tx">
              <span class="rate-icon tx"><Icon name="arrowUp" size="16px" /></span>
              <div class="rate-info">
                <span class="rate-label">Upload</span>
                <span class="rate-value">{fmtRate(iface.bytes_sent_rate_per_sec)}</span>
              </div>
              {#if iface.bytes_sent != null}
                <span class="rate-total">{fmt(iface.bytes_sent)} total</span>
              {/if}
            </div>
          </div>

          <!-- Traffic history chart -->
          {#if hist && hist.rx.length > 0}
            <div class="iface-chart">
              <div class="chart-header">
                <span class="chart-title">Traffic History</span>
                <div class="chart-legend">
                  <span class="legend-item"><span class="legend-dot rx"></span>RX</span>
                  <span class="legend-item"><span class="legend-dot tx"></span>TX</span>
                </div>
              </div>
              <Sparkline
                series={[{ points: hist.tx, color: 'purple' }, { points: hist.rx, color: 'green' }]}
                timestamps={hist.ts}
                fmtAxis={fmt}
                height="250px"
                rows={i => [
                  { dot: 'green', label: 'RX', value: fmtRate(hist.rx[i] ?? 0) },
                  { dot: 'purple', label: 'TX', value: fmtRate(hist.tx[i] ?? 0) },
                ]}
              />
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
{/each}

<style>
  .page-stat {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    text-align: left;
  }

  .stat-icon { display: flex; }
  .stat-icon.rx { color: #8bb3fa; }
  .stat-icon.tx { color: #56d4a0; }

  .page-stat-value {
    font-size: 1.1rem;
    font-family: 'Geist Mono', monospace;
  }

  .page-stat-value.rx { color: var(--chart-2); }
  .page-stat-value.tx { color: var(--primary); }

  .controls-bar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1rem;
  }

  .host-section {
    margin-bottom: 2rem;
  }

  .host-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-foreground);
    margin-bottom: 0.75rem;
    padding-left: 2px;
  }

  .host-label-icon { display: flex; color: var(--muted-foreground); }

  .host-iface-count {
    font-family: 'Geist Mono', monospace;
    font-size: 0.6rem;
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
    opacity: 0.6;
  }

  .iface-card {
    padding: 1.25rem 1.5rem;
    border: 1px solid var(--border);
    margin-bottom: 0.75rem;
  }

  .iface-card.secondary { opacity: 0.65; }
  .iface-card.secondary:hover { opacity: 0.85; }

  .iface-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.85rem;
  }

  .iface-icon { display: flex; color: var(--muted-foreground); }
  .iface-icon.physical { color: #8bb3fa; }

  .iface-name {
    font-size: 0.85rem;
    font-weight: 600;
    font-family: 'Geist Mono', monospace;
  }

  .iface-badge {
    margin-left: auto;
    font-size: 0.6rem;
    padding: 2px 8px;
    border-radius: 9999px;
    font-weight: 500;
  }

  .iface-badge.up {
    background: color-mix(in oklch, var(--chart-2) 12%, transparent);
    color: var(--chart-2);
    border: 1px solid color-mix(in oklch, var(--chart-2) 25%, transparent);
  }

  .iface-badge.down {
    background: var(--muted);
    color: var(--muted-foreground);
    border: 1px solid var(--border);
  }

  .iface-rates {
    display: flex;
    gap: 0.75rem;
  }

  .rate-box {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.8rem;
    border-radius: calc(var(--radius) - 2px);
    border: 1px solid var(--border);
  }

  .rate-icon { display: flex; }
  .rate-icon.rx { color: #8bb3fa; }
  .rate-icon.tx { color: #56d4a0; }
  .rate-info { display: flex; flex-direction: column; }

  .rate-label {
    font-size: 0.55rem;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }

  .rate-value {
    font-size: 0.85rem;
    font-weight: 700;
    font-family: 'Geist Mono', monospace;
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
  }

  .rate-total {
    margin-left: auto;
    font-size: 0.6rem;
    font-family: 'Geist Mono', monospace;
    color: var(--muted-foreground);
    opacity: 0.7;
  }

  .iface-chart {
    margin-top: 0.85rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--border);
  }

  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .chart-title {
    font-size: 0.65rem;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }

  .chart-legend {
    display: flex;
    gap: 0.75rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.6rem;
    color: var(--muted-foreground);
    font-family: 'Geist Mono', monospace;
  }

  .legend-dot {
    width: 8px;
    height: 3px;
    border-radius: 2px;
  }

  .legend-dot.rx { background: var(--chart-2); }
  .legend-dot.tx { background: var(--primary); }

  .empty-hint {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    padding: 1rem 0;
  }

  @media (max-width: 640px) {
    .iface-rates { flex-direction: column; }
    .iface-card { padding: 1rem; }
    .rate-total { display: none; }
  }
</style>
