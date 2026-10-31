<script lang="ts">
  import type { Host, HostData } from '../types.js'
  import Icon from './Icon.svelte'
  import { fmt, fmtAgo, fmtRate } from '../utils/format.js'
  import { clock } from '../utils/clock.svelte.js'
  import MetricRow from './MetricRow.svelte'
  import MiniSpark from './MiniSpark.svelte'
  import Sparkline from './Sparkline.svelte'
  import NetworkStats from './NetworkStats.svelte'

  /** Map host keys to icon names */
  const HOST_ICONS: Record<string, string> = {
    docker: 'container',
    proxmox: 'server',
    truenas: 'hardDrive',
  }
  const SPARK_POINTS = 60

  interface Props {
    host: Host
    data?: HostData | null
    compact?: boolean
  }

  let { host, data = null, compact = false }: Props = $props()

  let ok = $derived(!!data && !data.error)
  let status = $derived(!data ? 'loading' : data.error ? 'offline' : data.stale ? 'stale' : 'online')

  let user = $derived(data?.cpuHistory?.user ?? [])
  let system = $derived(data?.cpuHistory?.system ?? [])
  let total = $derived(user.map((u, i) => u + (system[i] || 0)))
  let avgCpu = $derived(total.length ? total.reduce((a, b) => a + b, 0) / total.length : undefined)

  let summary = $derived.by(() => {
    if (!total.length) return ''
    let peak = 0
    for (let i = 1; i < total.length; i++) if (total[i] > total[peak]) peak = i
    const at = data?.cpuTimestamps?.[peak]
    const when = at ? ` at ${new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''
    return `Peak ${Math.round(total[peak])}%${when}, average ${Math.round(avgCpu ?? 0)}%`
  })

  function fmtUptime(raw: unknown): string | null {
    if (!raw) return null
    const str = typeof raw === 'string' ? raw : String(raw)
    const dayMatch = str.match(/(\d+)\s*days?,?\s*(\d+):(\d+)/)
    if (dayMatch) {
      const d = +dayMatch[1], h = +dayMatch[2]
      return h > 0 ? `${d}d ${h}h` : `${d}d`
    }
    const timeMatch = str.match(/(\d+):(\d+):(\d+)/)
    if (timeMatch) {
      const h = +timeMatch[1], m = +timeMatch[2]
      return h > 0 ? `${h}h ${m}m` : `${m}m`
    }
    return str
  }
  let uptime = $derived(ok ? fmtUptime(data?.uptime) : null)
</script>

<div class="host-card card" class:stale={status === 'stale'}>
  <div class="card-header">
    <div class="card-icon">
      <Icon name={HOST_ICONS[host.key] ?? 'server'} size="20px" />
    </div>
    <div class="card-heading">
      <h2 class="card-title">{host.name}</h2>
      <div class="card-subtitle">{uptime ? `Up ${uptime}` : ok ? 'Uptime unknown' : ''}</div>
    </div>
    <div class="card-status" aria-live="polite">
      {#if status === 'online'}
        <span class="card-badge online">Online</span>
        <span class="age">{fmtAgo(data!.updatedAt!, clock.now)}</span>
      {:else if status === 'stale'}
        <span class="card-badge offline">Not responding</span>
        <span class="age warn">Last seen {fmtAgo(data!.updatedAt!, clock.now)}</span>
      {:else if status === 'offline'}
        <span class="card-badge offline">Unreachable</span>
      {:else}
        <span class="card-badge loading">Connecting…</span>
      {/if}
    </div>
  </div>

  {#if ok}
    <div class="metrics" class:metrics-vertical={compact}>
      <MetricRow
        icon="cpu"
        label="CPU"
        value={data!.cpu?.total ?? 0}
        detail="{data!.cpu?.cpucore ?? '–'} cores"
        avg={avgCpu}
      />
      <MetricRow
        icon="memory"
        label="Memory"
        value={data!.mem?.percent ?? 0}
        detail="{fmt(data!.mem?.used ?? 0)} of {fmt(data!.mem?.total ?? 0)}"
      />
      <MetricRow
        icon="server"
        label="Disk"
        value={data!.fs?.percent ?? 0}
        detail="{fmt(data!.fs?.used ?? 0)} of {fmt(data!.fs?.size ?? 0)}"
      />
    </div>

    {#if compact}
      <div class="trends">
        {#if total.length > 1}
          {@const recent = total.slice(-SPARK_POINTS)}
          <span class="trend-label">CPU</span>
          <!-- Floor of 20% keeps idle noise flat instead of filling the line -->
          <MiniSpark points={recent} max={Math.max(20, ...recent)} color="var(--series-2)" label="CPU trend: {summary}" />
        {/if}
        <span class="trend-label">Network</span>
        {#if (data!.netHistory?.length ?? 0) > 1}
          <MiniSpark points={data!.netHistory ?? []} color="var(--series-1)" label="Network trend, now {fmtRate((data!.net?.rx ?? 0) + (data!.net?.tx ?? 0))}" />
        {:else}
          <span class="trend-label">{fmtRate((data!.net?.rx ?? 0) + (data!.net?.tx ?? 0))}</span>
        {/if}
      </div>
    {:else}
      {@const pct = (v: number) => `${v.toFixed(1)}%`}
      <div class="cpu-chart">
        <div class="cpu-chart-header">
          <h3 class="cpu-chart-title">CPU history</h3>
          <div class="cpu-legend">
            <span class="cpu-legend-item"><span class="cpu-legend-dot user"></span>User</span>
            <span class="cpu-legend-item"><span class="cpu-legend-dot system"></span>System</span>
          </div>
        </div>
        {#if summary}<p class="cpu-summary">{summary}</p>{/if}
        <Sparkline
          series={[
            { points: total, color: 'series2' },
            { points: user, color: 'series1' },
          ]}
          timestamps={data!.cpuTimestamps ?? []}
          maxVal={100}
          fmtAxis={v => `${v}%`}
          endDot
          label="{host.name} CPU usage. {summary}"
          rows={i => [
            { dot: 'series1', label: 'User', value: pct(user[i] ?? 0) },
            { dot: 'series2', label: 'System', value: pct(system[i] ?? 0) },
            { dot: 'muted', label: 'Total', value: pct((user[i] ?? 0) + (system[i] ?? 0)), divider: true },
          ]}
        />
      </div>

      <NetworkStats net={data!.net} />
    {/if}
  {:else if data}
    <p class="error-msg">Glances on {host.name} isn't responding. Check that the host is on and Glances is running.</p>
  {:else}
    <div class="loading-rows" aria-hidden="true">
      {#each [0, 1, 2] as i (i)}
        <div class="skeleton" style="width:{40 + i * 12}%"></div>
        <div class="skeleton bar-skel"></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .host-card {
    padding: 1.25rem 1.5rem;
  }

  .host-card.stale { opacity: 0.7; }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .card-icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--secondary);
    border: 1px solid var(--border);
    color: var(--foreground);
  }

  .card-heading { min-width: 0; }

  .card-title {
    font-size: var(--text-md);
    font-weight: 600;
    color: var(--foreground);
  }

  .card-subtitle {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    margin-top: 1px;
  }

  .card-status {
    margin-left: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    text-align: right;
  }

  .card-badge {
    font-size: var(--text-xs);
    padding: 2px 10px;
    border-radius: 9999px;
    font-weight: 500;
    white-space: nowrap;
  }

  .card-badge.online {
    background: color-mix(in oklch, var(--ok) 12%, transparent);
    color: var(--ok);
  }

  .card-badge.offline {
    background: color-mix(in oklch, var(--crit) 12%, transparent);
    color: var(--crit);
  }

  .card-badge.loading {
    background: var(--muted);
    color: var(--muted-foreground);
  }

  .age {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .age.warn { color: var(--warn); }

  .metrics { display: flex; gap: 1rem; }
  .metrics-vertical { flex-direction: column; gap: 0.85rem; }

  .trends {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.4rem 0.75rem;
    margin-top: 1rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--border);
  }

  .trend-label {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  .trends :global(.mini-spark) { width: 100%; }

  .cpu-chart {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
  }

  .cpu-chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .cpu-chart-title {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    font-weight: 600;
  }

  .cpu-summary {
    font-size: var(--text-sm);
    color: var(--foreground);
    margin: 0.2rem 0 0.5rem;
    font-variant-numeric: tabular-nums;
  }

  .cpu-legend {
    display: flex;
    gap: 1rem;
  }

  .cpu-legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  .cpu-legend-dot {
    width: 8px;
    height: 3px;
    border-radius: 2px;
  }

  .cpu-legend-dot.user { background: var(--series-1); }
  .cpu-legend-dot.system { background: var(--series-2); }

  @media (max-width: 480px) {
    .metrics { flex-direction: column; gap: 0.85rem; }
  }

  .error-msg {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
    padding: 1rem 0;
  }

  .loading-rows {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .bar-skel { height: 12px; margin-bottom: 0.5rem; }
</style>
