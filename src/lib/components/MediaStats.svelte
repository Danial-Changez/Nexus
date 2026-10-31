<script lang="ts">
  import { onMount } from 'svelte'
  import { fmt, fmtRate } from '../utils/format.js'
  import { SVC_ICON } from '../types.js'
  import Icon from './Icon.svelte'
  import VideoDl from './VideoDl.svelte'

  interface QbitStats {
    error?: string
    dl_speed: number; up_speed: number
    dl_total: number; up_total: number
    status: string; total: number; active: number
    downloading: number; seeding: number
    torrents: { name: string; state: string; progress: number; size: number; dlspeed: number; upspeed: number; eta: number }[]
  }

  interface NzbgetStats {
    error?: string
    dl_speed: number; remaining_mb: number; downloaded_mb: number
    paused: boolean; active: number; total: number
    groups: { name: string; status: string; size_mb: number; progress: number }[]
  }

  interface ArrStats {
    error?: string
    queue_count: number; missing: number; downloading: number; warning: number
    items: { title: string; status: string; timeleft?: string; size: number; sizeleft: number; progress: number; downloadClient?: string }[]
  }

  interface ProwlarrStats {
    error?: string
    indexer_count: number; queries: number; grabs: number; fails: number
  }

  interface MediaData {
    qbit: QbitStats
    nzbget: NzbgetStats
    sonarr: ArrStats
    radarr: ArrStats
    prowlarr: ProwlarrStats
  }

  let stats = $state<MediaData | null>(null)

  async function fetchStats() {
    try {
      const res = await fetch('/api/media/stats')
      if (!res.ok) throw new Error(`${res.status}`)
      stats = await res.json()
    } catch {
      // errors surface per-service via stats.*.error
    }
  }

  onMount(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  })

  function fmtEta(seconds: number): string {
    if (!seconds || seconds <= 0 || seconds >= 8640000) return '\u2014'
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m`
  }

  // qbit state → [badge label, css class]
  const STATES: Record<string, [string, string]> = {
    downloading: ['DL', 'downloading'], forcedDL: ['DL', 'downloading'],
    uploading: ['Seed', 'seeding'], forcedUP: ['Seed', 'seeding'], stalledUP: ['Seed', 'seeding'],
    pausedDL: ['Paused', 'paused'], pausedUP: ['Paused', 'paused'],
    stalledDL: ['Stalled', 'stalled'], queuedDL: ['Queued', 'stalled'], queuedUP: ['Queued', 'stalled'],
    checkingDL: ['Check', 'error'], checkingUP: ['Check', 'error'],
    moving: ['Moving', 'error'], missingFiles: ['Error', 'error'],
  }

  const stateLabel = (state: string) => STATES[state]?.[0] ?? state
  const stateClass = (state: string) => STATES[state]?.[1] ?? 'error'
</script>

<div class="media-section">
  <!-- NZBGet -->
  <div class="media-panel card">
    <div class="panel-header">
      <img src="{SVC_ICON}/nzbget.svg" alt="" class="panel-icon" />
      <div>
        <span class="panel-title">NZBGet</span>
        <span class="panel-subtitle">Usenet Downloader</span>
      </div>
      {#if stats?.nzbget && !stats.nzbget.error}
        <span class="panel-badge" class:connected={!stats.nzbget.paused} class:paused={stats.nzbget.paused}>
          {stats.nzbget.paused ? 'Paused' : 'Active'}
        </span>
      {:else}
        <span class="panel-badge offline">{stats?.nzbget?.error ? 'Error' : 'Loading'}</span>
      {/if}
    </div>

    {#if stats?.nzbget && !stats.nzbget.error}
      <div class="transfer-row">
        <div class="transfer-stat">
          <span class="transfer-icon dl"><Icon name="download" size="14px" /></span>
          <span class="transfer-label">Speed</span>
          <span class="transfer-value dl">{fmtRate(stats.nzbget.dl_speed)}</span>
        </div>
        <div class="transfer-stat">
          <span class="transfer-icon muted"><Icon name="database" size="14px" /></span>
          <span class="transfer-label">Remaining</span>
          <span class="transfer-value">{stats.nzbget.remaining_mb > 0 ? fmt(stats.nzbget.remaining_mb * 1048576) : '\u2014'}</span>
        </div>
        <div class="transfer-counts">
          <span class="count-pill">{stats.nzbget.active} <small>Active</small></span>
          <span class="count-pill">{stats.nzbget.total} <small>Queue</small></span>
        </div>
      </div>

      {#if stats.nzbget.groups.length > 0}
        <div class="item-list">
          {#each stats.nzbget.groups as g (g.name)}
            <div class="item-row">
              <div class="item-info">
                <span class="item-name" title={g.name}>{g.name}</span>
                <div class="item-meta">
                  <span class="item-badge {g.status === 'DOWNLOADING' ? 'downloading' : g.status === 'PAUSED' ? 'paused' : 'stalled'}">{g.status}</span>
                  <span class="item-detail">{fmt(g.size_mb * 1048576)}</span>
                </div>
              </div>
              <div class="item-progress-wrap">
                <div class="item-progress-track">
                  <div class="item-progress-fill downloading" style="width:{(g.progress * 100).toFixed(1)}%"></div>
                </div>
                <span class="item-pct">{(g.progress * 100).toFixed(0)}%</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {:else if stats?.nzbget?.error}
      <div class="panel-error">{stats.nzbget.error}</div>
    {:else}
      <div class="panel-error loading-pulse">Loading...</div>
    {/if}
  </div>

  <!-- qBittorrent -->
  <div class="media-panel card">
    <div class="panel-header">
      <img src="{SVC_ICON}/qbittorrent.svg" alt="" class="panel-icon" />
      <div>
        <span class="panel-title">qBittorrent</span>
        <span class="panel-subtitle">Torrent Client</span>
      </div>
      {#if stats?.qbit && !stats.qbit.error}
        <span class="panel-badge" class:connected={stats.qbit.status === 'connected'}
              class:firewalled={stats.qbit.status === 'firewalled'}>
          {stats.qbit.status === 'firewalled' ? 'VPN' : stats.qbit.status}
        </span>
      {:else}
        <span class="panel-badge offline">{stats?.qbit?.error ? 'Error' : 'Loading'}</span>
      {/if}
    </div>

    {#if stats?.qbit && !stats.qbit.error}
      <div class="transfer-row">
        <div class="transfer-stat">
          <span class="transfer-icon dl"><Icon name="download" size="14px" /></span>
          <span class="transfer-label">DL</span>
          <span class="transfer-value dl">{fmtRate(stats.qbit.dl_speed)}</span>
        </div>
        <div class="transfer-stat">
          <span class="transfer-icon ul"><Icon name="upload" size="14px" /></span>
          <span class="transfer-label">UL</span>
          <span class="transfer-value ul">{fmtRate(stats.qbit.up_speed)}</span>
        </div>
        <div class="transfer-counts">
          <span class="count-pill">{stats.qbit.downloading} <small>DL</small></span>
          <span class="count-pill">{stats.qbit.seeding} <small>Seed</small></span>
          <span class="count-pill">{stats.qbit.total} <small>Total</small></span>
        </div>
      </div>

      {#if stats.qbit.torrents.length > 0}
        <div class="item-list">
          {#each stats.qbit.torrents as t (t.name)}
            <div class="item-row">
              <div class="item-info">
                <span class="item-name" title={t.name}>{t.name}</span>
                <div class="item-meta">
                  <span class="item-badge {stateClass(t.state)}">{stateLabel(t.state)}</span>
                  <span class="item-detail">{fmt(t.size)}</span>
                  {#if t.dlspeed > 0}<span class="item-detail dl">{fmtRate(t.dlspeed)}</span>{/if}
                  {#if t.upspeed > 0}<span class="item-detail ul">{fmtRate(t.upspeed)}</span>{/if}
                  {#if t.eta > 0 && t.eta < 8640000}<span class="item-detail">{fmtEta(t.eta)}</span>{/if}
                </div>
              </div>
              <div class="item-progress-wrap">
                <div class="item-progress-track">
                  <div class="item-progress-fill {stateClass(t.state)}" style="width:{(t.progress * 100).toFixed(1)}%"></div>
                </div>
                <span class="item-pct">{(t.progress * 100).toFixed(0)}%</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {:else if stats?.qbit?.error}
      <div class="panel-error">{stats.qbit.error}</div>
    {:else}
      <div class="panel-error loading-pulse">Loading...</div>
    {/if}
  </div>

  <!-- Video Downloader -->
  <VideoDl />

  <!-- Sonarr & Radarr -->
  <div class="arr-grid">
    {#each [
      { key: 'sonarr', icon: 'sonarr', title: 'Sonarr', sub: 'TV Shows' },
      { key: 'radarr', icon: 'radarr', title: 'Radarr', sub: 'Movies' },
    ] as arr (arr.key)}
      {@const d = stats?.[arr.key as 'sonarr' | 'radarr']}
      <div class="media-panel card">
        <div class="panel-header">
          <img src="{SVC_ICON}/{arr.icon}.svg" alt="" class="panel-icon" />
          <div>
            <span class="panel-title">{arr.title}</span>
            <span class="panel-subtitle">{arr.sub}</span>
          </div>
        </div>

        {#if d && !d.error}
          <div class="arr-summary">
            <div class="arr-stat">
              <span class="arr-stat-value">{d.queue_count}</span>
              <span class="arr-stat-label">In Queue</span>
            </div>
            <div class="arr-stat">
              <span class="arr-stat-value">{d.downloading}</span>
              <span class="arr-stat-label">Downloading</span>
            </div>
            <div class="arr-stat">
              <span class="arr-stat-value warning">{d.warning}</span>
              <span class="arr-stat-label">Warnings</span>
            </div>
            <div class="arr-stat">
              <span class="arr-stat-value muted">{d.missing}</span>
              <span class="arr-stat-label">Missing</span>
            </div>
          </div>

          {#if d.items.length > 0}
            <div class="item-list">
              {#each d.items as item (item.title)}
                <div class="item-row">
                  <div class="item-info">
                    <span class="item-name" title={item.title}>{item.title}</span>
                    <div class="item-meta">
                      <span class="item-badge {item.status === 'downloading' ? 'downloading' : 'stalled'}">{item.status}</span>
                      <span class="item-detail">{fmt(item.size)}</span>
                      {#if item.timeleft}<span class="item-detail">{item.timeleft}</span>{/if}
                      {#if item.downloadClient}<span class="item-detail">{item.downloadClient}</span>{/if}
                    </div>
                  </div>
                  <div class="item-progress-wrap">
                    <div class="item-progress-track">
                      <div class="item-progress-fill downloading" style="width:{(item.progress * 100).toFixed(1)}%"></div>
                    </div>
                    <span class="item-pct">{(item.progress * 100).toFixed(0)}%</span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {:else if d?.error}
          <div class="panel-error">{d.error}</div>
        {:else}
          <div class="panel-error loading-pulse">Loading...</div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Prowlarr -->
  {#if stats?.prowlarr && !stats.prowlarr.error}
    <div class="media-panel card prowlarr-panel">
      <div class="panel-header">
        <img src="{SVC_ICON}/prowlarr.svg" alt="" class="panel-icon" />
        <div>
          <span class="panel-title">Prowlarr</span>
          <span class="panel-subtitle">Indexer Manager</span>
        </div>
      </div>
      <div class="prowlarr-stats">
        <div class="prowlarr-stat">
          <span class="prowlarr-value">{stats.prowlarr.indexer_count}</span>
          <span class="prowlarr-label">Indexers</span>
        </div>
        <div class="prowlarr-stat">
          <span class="prowlarr-value">{stats.prowlarr.queries.toLocaleString()}</span>
          <span class="prowlarr-label">Queries</span>
        </div>
        <div class="prowlarr-stat">
          <span class="prowlarr-value">{stats.prowlarr.grabs.toLocaleString()}</span>
          <span class="prowlarr-label">Grabs</span>
        </div>
        <div class="prowlarr-stat">
          <span class="prowlarr-value warning">{stats.prowlarr.fails}</span>
          <span class="prowlarr-label">Failures</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .media-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .media-panel { padding: 1.25rem 1.5rem; }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .panel-icon { width: 28px; height: 28px; border-radius: calc(var(--radius) - 2px); }
  .panel-title { font-size: 0.85rem; font-weight: 600; display: block; line-height: 1.2; }
  .panel-subtitle { font-size: 0.6rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; }

  .panel-badge {
    margin-left: auto;
    font-size: 0.6rem;
    padding: 2px 8px;
    border-radius: 9999px;
    font-weight: 500;
    text-transform: capitalize;
    background: var(--muted);
    color: var(--muted-foreground);
    border: 1px solid var(--border);
  }

  .panel-badge.connected {
    background: color-mix(in oklch, var(--chart-2) 12%, transparent);
    color: var(--chart-2);
    border-color: color-mix(in oklch, var(--chart-2) 25%, transparent);
  }

  .panel-badge.firewalled, .panel-badge.paused {
    background: color-mix(in oklch, var(--chart-3) 12%, transparent);
    color: var(--chart-3);
    border-color: color-mix(in oklch, var(--chart-3) 25%, transparent);
  }

  .panel-badge.offline {
    background: color-mix(in oklch, var(--destructive) 12%, transparent);
    color: var(--destructive);
    border-color: color-mix(in oklch, var(--destructive) 25%, transparent);
  }

  .panel-error { font-size: 0.7rem; color: var(--muted-foreground); padding: 0.75rem 0; text-align: center; }

  /* Transfer stats */
  .transfer-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
  .transfer-stat { display: flex; align-items: center; gap: 0.4rem; }
  .transfer-icon { display: flex; }
  .transfer-icon.dl { color: #60a5fa; }
  .transfer-icon.ul { color: #4ade80; }
  .transfer-icon.muted { color: var(--muted-foreground); }
  .transfer-label { font-size: 0.6rem; color: var(--muted-foreground); text-transform: uppercase; }
  .transfer-value { font-size: 0.8rem; font-weight: 600; font-family: 'Geist Mono', monospace; font-variant-numeric: tabular-nums; }
  .transfer-value.dl { color: oklch(0.72 0.13 230); }
  .transfer-value.ul { color: var(--chart-2); }
  .transfer-counts { margin-left: auto; display: flex; gap: 0.35rem; }
  .count-pill { font-size: 0.65rem; font-family: 'Geist Mono', monospace; font-variant-numeric: tabular-nums; padding: 2px 6px; border-radius: 6px; border: 1px solid var(--border); color: var(--muted-foreground); }
  .count-pill small { font-size: 0.55rem; opacity: 0.7; }

  /* Item list */
  .item-list { display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--border); padding-top: 0.75rem; }
  .item-row { display: flex; flex-direction: column; gap: 0.35rem; }
  .item-info { min-width: 0; }
  .item-name { font-size: 0.7rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
  .item-meta { display: flex; align-items: center; gap: 0.35rem; margin-top: 0.15rem; flex-wrap: wrap; }
  .item-badge { font-size: 0.55rem; padding: 1px 5px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
  .item-badge.downloading { background: color-mix(in oklch, oklch(0.72 0.13 230) 15%, transparent); color: oklch(0.72 0.13 230); }
  .item-badge.seeding { background: color-mix(in oklch, var(--chart-2) 15%, transparent); color: var(--chart-2); }
  .item-badge.paused { background: color-mix(in oklch, var(--chart-3) 15%, transparent); color: var(--chart-3); }
  .item-badge.stalled { background: var(--muted); color: var(--muted-foreground); }
  .item-badge.error { background: color-mix(in oklch, var(--destructive) 15%, transparent); color: var(--destructive); }
  .item-detail { font-size: 0.58rem; font-family: 'Geist Mono', monospace; color: var(--muted-foreground); }
  .item-detail.dl { color: oklch(0.72 0.13 230); }
  .item-detail.ul { color: var(--chart-2); }
  .item-progress-wrap { display: flex; align-items: center; gap: 0.5rem; }
  .item-progress-track { flex: 1; height: 4px; background: var(--muted); border-radius: 2px; overflow: hidden; }
  .item-progress-fill { height: 100%; border-radius: 2px; transition: width 300ms ease; }
  .item-progress-fill.downloading { background: oklch(0.72 0.13 230); }
  .item-progress-fill.seeding { background: var(--chart-2); }
  .item-progress-fill.paused { background: var(--chart-3); }
  .item-progress-fill.stalled { background: var(--muted-foreground); }
  .item-progress-fill.error { background: var(--destructive); }
  .item-pct { font-size: 0.6rem; font-family: 'Geist Mono', monospace; font-variant-numeric: tabular-nums; color: var(--muted-foreground); min-width: 2.5ch; text-align: right; }

  /* Arr grid */
  .arr-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
  .arr-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 0.75rem; }
  .arr-stat { text-align: center; padding: 0.5rem 0.25rem; border-radius: calc(var(--radius) - 2px); border: 1px solid var(--border); }
  .arr-stat-value { font-size: 1rem; font-weight: 700; font-family: 'Geist Mono', monospace; font-variant-numeric: tabular-nums; display: block; }
  .arr-stat-value.warning { color: var(--chart-3); }
  .arr-stat-value.muted { color: var(--muted-foreground); }
  .arr-stat-label { font-size: 0.5rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; }

  /* Prowlarr */
  .prowlarr-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
  .prowlarr-stat { text-align: center; padding: 0.5rem 0.25rem; border-radius: calc(var(--radius) - 2px); border: 1px solid var(--border); }
  .prowlarr-value { font-size: 1rem; font-weight: 700; font-family: 'Geist Mono', monospace; font-variant-numeric: tabular-nums; display: block; }
  .prowlarr-value.warning { color: var(--chart-3); }
  .prowlarr-label { font-size: 0.5rem; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; }

  @media (max-width: 640px) {
    .arr-grid { grid-template-columns: 1fr; }
    .arr-summary { grid-template-columns: repeat(2, 1fr); }
    .prowlarr-stats { grid-template-columns: repeat(2, 1fr); }
  }
</style>
