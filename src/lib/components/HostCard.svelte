<script lang="ts">
  import type { Host, HostData } from '../types.js'
  import Icon from './Icon.svelte'
  import { fmt } from '../utils/format.js'
  import MetricRow from './MetricRow.svelte'
  import Sparkline from './Sparkline.svelte'
  import NetworkStats from './NetworkStats.svelte'

  /** Map host keys to icon names */
  const HOST_ICONS: Record<string, string> = {
    docker: 'container',
    proxmox: 'server',
    truenas: 'hardDrive',
  }

  interface Props {
    host: Host
    data?: HostData | null
    compact?: boolean
  }

  let { host, data = null, compact = false }: Props = $props()

  let status = $derived(data ? (data.error ? 'offline' : 'online') : 'loading')
  let statusText = $derived(data ? (data.error ? 'Offline' : 'Online') : 'Loading...')

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
</script>

<div class="host-card card">
  <div class="card-header">
    <div class="card-icon {host.key}">
      <Icon name={HOST_ICONS[host.key] ?? 'server'} size="20px" />
    </div>
    <div>
      <div class="card-title">{host.name}</div>
      <div class="card-subtitle">
        {#if data && !data.error && fmtUptime(data.uptime)}
          UP {fmtUptime(data.uptime)}
        {:else if data && !data.error}
          --
        {:else}
          ...
        {/if}
      </div>
    </div>
    <span class="card-badge {status}">{statusText}</span>
  </div>

  {#if data && !data.error}
    <div class="metrics" class:metrics-vertical={compact}>
      <MetricRow
        icon="cpu"
        label="CPU"
        value={data.cpu?.total ?? 0}
        detail="{data.cpu?.cpucore ?? '--'} cores"
      />
      <MetricRow
        icon="memory"
        label="Memory"
        value={data.mem?.percent ?? 0}
        detail="{fmt(data.mem?.used ?? 0)} / {fmt(data.mem?.total ?? 0)}"
      />
      <MetricRow
        icon="server"
        label="Disk"
        value={data.fs?.percent ?? 0}
        detail="{fmt(data.fs?.used ?? 0)} / {fmt(data.fs?.size ?? 0)}"
      />
    </div>

    {#if !compact}
      {@const user = data.cpuHistory?.user ?? []}
      {@const system = data.cpuHistory?.system ?? []}
      {@const pct = (v: number) => `${v.toFixed(1)}%`}
      <div class="cpu-chart">
        <div class="cpu-chart-header">
          <span class="cpu-chart-icon"><Icon name="station" size="13px" /></span>
          <span class="cpu-chart-title">CPU History</span>
          <span class="cpu-chart-value">{pct(data.cpu?.total ?? 0)}</span>
        </div>
        <div class="cpu-legend">
          <div class="cpu-legend-item"><span class="cpu-legend-dot user"></span>User</div>
          <div class="cpu-legend-item"><span class="cpu-legend-dot system"></span>System</div>
        </div>
        <Sparkline
          series={[
            { points: user.map((u, i) => u + (system[i] || 0)), color: 'purple' },
            { points: user, color: 'green' },
          ]}
          timestamps={data.cpuTimestamps ?? []}
          maxVal={100}
          fmtAxis={v => `${v}%`}
          endDot
          rows={i => [
            { dot: 'green', label: 'User', value: pct(user[i] ?? 0) },
            { dot: 'purple', label: 'System', value: pct(system[i] ?? 0) },
            { dot: 'muted', label: 'Total', value: pct((user[i] ?? 0) + (system[i] ?? 0)), divider: true },
          ]}
        />
      </div>

      <NetworkStats net={data.net} />
    {/if}
  {:else if data}
    <div class="error-msg">Unable to connect</div>
  {:else}
    <div class="error-msg loading-pulse">Connecting...</div>
  {/if}
</div>

<style>
  .host-card {
    padding: 1.25rem 1.5rem;
  }

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
  }

  .card-icon.docker {
    background: color-mix(in oklch, var(--chart-1) 15%, transparent);
    border: 1px solid color-mix(in oklch, var(--chart-1) 25%, transparent);
    color: #8bb3fa;
  }
  .card-icon.proxmox {
    background: color-mix(in oklch, var(--chart-3) 15%, transparent);
    border: 1px solid color-mix(in oklch, var(--chart-3) 25%, transparent);
    color: #e9b74a;
  }
  .card-icon.truenas {
    background: color-mix(in oklch, var(--chart-2) 15%, transparent);
    border: 1px solid color-mix(in oklch, var(--chart-2) 25%, transparent);
    color: #56d4a0;
  }

  .card-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .card-subtitle {
    font-size: 0.7rem;
    color: var(--muted-foreground);
    font-family: 'Geist Mono', monospace;
    margin-top: 1px;
  }

  .card-badge {
    margin-left: auto;
    font-size: 0.65rem;
    padding: 3px 10px;
    border-radius: 9999px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .card-badge.online {
    background: color-mix(in oklch, var(--chart-2) 12%, transparent);
    color: var(--chart-2);
    border: 1px solid color-mix(in oklch, var(--chart-2) 25%, transparent);
  }

  .card-badge.offline {
    background: color-mix(in oklch, var(--destructive) 12%, transparent);
    color: var(--destructive);
    border: 1px solid color-mix(in oklch, var(--destructive) 25%, transparent);
  }

  .card-badge.loading {
    background: var(--muted);
    color: var(--muted-foreground);
    border: 1px solid var(--border);
  }

  .metrics { display: flex; gap: 0.75rem; }
  .metrics-vertical { flex-direction: column; gap: 0.85rem; }

  .cpu-chart {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
  }

  .cpu-chart-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .cpu-chart-icon { display: flex; color: var(--muted-foreground); }

  .cpu-chart-title {
    font-size: 0.65rem;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }

  .cpu-chart-value {
    margin-left: auto;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: 'Geist Mono', monospace;
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
  }

  .cpu-legend {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.4rem;
  }

  .cpu-legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.6rem;
    color: var(--muted-foreground);
    font-family: 'Geist Mono', monospace;
  }

  .cpu-legend-dot {
    width: 8px;
    height: 3px;
    border-radius: 2px;
  }

  .cpu-legend-dot.user { background: var(--chart-2); }
  .cpu-legend-dot.system { background: var(--primary); }

  @media (max-width: 480px) {
    .metrics { flex-direction: column; gap: 0.85rem; }
  }

  .error-msg {
    color: var(--destructive);
    font-size: 0.8rem;
    text-align: center;
    padding: 1.5rem 1rem;
  }
</style>
