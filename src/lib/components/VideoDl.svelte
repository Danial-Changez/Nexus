<script lang="ts">
  import { onMount } from 'svelte'
  import { poll } from '../utils/poll.js'
  import { errorHint, fmt, fmtAgo, fmtRate } from '../utils/format.js'
  import Icon from './Icon.svelte'

  // result: "pending_release" = aired but not posted yet (shown as
  // Waiting); other values ("download_failed", "resolve_failed",
  // "not_on_site", legacy "unknown") render as Attempted.
  interface Attempt { key: string; at: string; result?: string }
  interface ActiveDl { series: string; season: number; episode: number; flat_n: number; started_at: number; bytes_downloaded: number; total_bytes: number; speed_bps?: number; stage?: string }
  interface StackInfo { online: boolean; error?: string }

  interface VideoDlData {
    error?: string
    stacks: StackInfo[]
    active: ActiveDl[]
    recent_attempts: Attempt[]
    tracked_count: number
    queued: number
    resolving: number
  }

  let data = $state<VideoDlData | null>(null)

  async function fetchStats() {
    try {
      const res = await fetch('/api/video-dl')
      if (!res.ok) throw new Error(`${res.status}`)
      data = await res.json()
    } catch {
      // individual stack errors surface via data.stacks[*].error
    }
  }

  onMount(() => poll(fetchStats, 1000))

  function fmtElapsed(startedAt: number | null): string {
    if (!startedAt) return ''
    const secs = Math.floor(Date.now() / 1000 - startedAt)
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  function episodeLabel(d: ActiveDl): string {
    return `S${String(d.season).padStart(2, '0')}E${String(d.episode).padStart(2, '0')} (EP-${d.flat_n})`
  }

  function attemptLabel(key: string): string {
    const m = key.match(/^(.+):([^:]+):([^:]+)$/)
    return m ? `${m[1]} S${m[2].padStart(2, '0')}E${m[3].padStart(2, '0')}` : key
  }

  function dedupeAttempts(attempts: Attempt[]): Attempt[] {
    const seen = new Map<string, Attempt>()
    for (const a of attempts) {
      const label = attemptLabel(a.key)
      if (!seen.has(label) || a.at > seen.get(label)!.at) {
        seen.set(label, a)
      }
    }
    return [...seen.values()].sort((a, b) => b.at.localeCompare(a.at))
  }

</script>

<div class="media-panel card">
  <div class="panel-header">
    <span class="panel-icon-wrap"><Icon name="downloadSquare" size="28px" /></span>
    <div>
      <span class="panel-title">Video Downloader</span>
      <span class="panel-subtitle">Self-hosted downloader</span>
    </div>

    {#if !data}
      <span class="panel-badge offline">Loading</span>
    {:else if data.error}
      <span class="panel-badge offline">Error</span>
    {:else}
      {@const online = (data.stacks || []).some(s => s.online)}
      <span class="panel-badge" class:connected={online} class:offline={!online}>
        {online ? 'Online' : 'Offline'}
      </span>
    {/if}
  </div>

  {#if data && !data.error}
    {@const totalSpeed = (data.active || []).reduce((s, d) => s + (d.speed_bps || 0), 0)}
    <div class="vdl-summary">
      <div class="vdl-stat">
        {#if data.resolving}
          <span class="vdl-value">{data.resolving}</span>
          <span class="vdl-label">Resolving</span>
        {:else if data.queued}
          <span class="vdl-value">{data.queued}</span>
          <span class="vdl-label">Queued</span>
        {:else}
          <span class="vdl-value">{data.active?.length ?? 0}</span>
          <span class="vdl-label">Active</span>
        {/if}
      </div>
      <div class="vdl-stat">
        <span class="vdl-value">{totalSpeed > 0 ? fmtRate(totalSpeed) : '0 B/s'}</span>
        <span class="vdl-label">Speed</span>
      </div>
      <div class="vdl-stat">
        <span class="vdl-value">{data.tracked_count ?? 0}</span>
        <span class="vdl-label">Tracked series</span>
      </div>
    </div>

    {#if data.active?.length > 0}
      <div class="item-list">
        {#each data.active as dl (dl.series + dl.season + dl.episode)}
          {@const pct = dl.total_bytes ? Math.min(100, Math.round(dl.bytes_downloaded / dl.total_bytes * 100)) : 0}
          {@const stage = dl.stage || 'downloading'}
          {@const badgeLabel = stage === 'verifying' ? 'CHK' : stage === 'moving' ? 'MV' : 'DL'}
          <div class="item-row dl-row">
            <div class="item-info">
              <span class="item-name" title="{dl.series} {episodeLabel(dl)}">
                {dl.series} — {episodeLabel(dl)}
              </span>
              <div class="item-meta">
                <span class="item-badge downloading">{badgeLabel}</span>
                <span class="item-detail dl">{fmtElapsed(dl.started_at)}</span>
                {#if dl.total_bytes}
                  <span class="item-detail">{fmt(dl.bytes_downloaded)} / {fmt(dl.total_bytes)}</span>
                {:else if dl.bytes_downloaded}
                  <span class="item-detail">{fmt(dl.bytes_downloaded)}</span>
                {/if}
                {#if stage === 'verifying'}
                  <span class="item-detail dl">Verifying\u2026</span>
                {:else if stage === 'moving'}
                  <span class="item-detail dl">Moving\u2026</span>
                {:else if dl.speed_bps}
                  <span class="item-detail dl">{fmtRate(dl.speed_bps)}</span>
                {/if}
              </div>
            </div>
            {#if dl.total_bytes}
              <span class="dl-pct">{pct}%</span>
            {/if}
            <div class="dl-pulse"></div>
            {#if dl.total_bytes}
              <div class="dl-progress-track">
                <div class="dl-progress-bar" style="width: {pct}%"></div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if data.recent_attempts?.length > 0}
      {@const deduped = dedupeAttempts(data.recent_attempts).slice(0, 8)}
      <div class="item-list recent-list">
        {#each deduped as a (a.key)}
          <div class="item-row">
            <div class="item-info">
              <span class="item-name">{attemptLabel(a.key)}</span>
              <div class="item-meta">
                {#if a.result === 'pending_release'}
                  <span class="item-badge waiting">Waiting</span>
                {:else}
                  <span class="item-badge stalled">Attempted</span>
                {/if}
                <span class="item-detail">{fmtAgo(Date.parse(a.at))}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else if data?.error}
    <div class="panel-error">{errorHint('The video downloader', data.error)}</div>
  {:else}
    <div class="panel-error loading-pulse">Loading…</div>
  {/if}
</div>

<style>
  .media-panel { padding: 1.25rem 1.5rem; }
  .panel-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
  .panel-icon-wrap { display: flex; color: var(--foreground); }
  .panel-title { font-size: var(--text-md); font-weight: 600; display: block; line-height: 1.2; }
  .panel-subtitle { font-size: var(--text-xs); color: var(--muted-foreground); }

  .panel-badge {
    margin-left: auto; font-size: var(--text-xs); padding: 2px 8px; border-radius: 9999px;
    font-weight: 500; text-transform: capitalize; background: var(--muted); color: var(--muted-foreground); border: 1px solid var(--border);
  }
  .panel-badge.connected { background: color-mix(in oklch, var(--ok) 12%, transparent); color: var(--ok); border-color: color-mix(in oklch, var(--ok) 25%, transparent); }
  .panel-badge.offline { background: color-mix(in oklch, var(--destructive) 12%, transparent); color: var(--destructive); border-color: color-mix(in oklch, var(--destructive) 25%, transparent); }
  .panel-error { font-size: var(--text-xs); color: var(--muted-foreground); padding: 0.75rem 0; text-align: center; }

  .vdl-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 0.75rem; }
  .vdl-stat { text-align: center; padding: 0.5rem 0.25rem; border-radius: calc(var(--radius) - 2px); border: 1px solid var(--border); }
  .vdl-value { font-size: var(--text-md); font-weight: 700; font-family: var(--font-mono); font-variant-numeric: tabular-nums; display: block; }
  .vdl-label { font-size: var(--text-xs); color: var(--muted-foreground); }

  .item-list { display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--border); padding-top: 0.75rem; margin-bottom: 0.75rem; }
  .recent-list { margin-bottom: 0; }
  .item-row { display: flex; align-items: center; gap: 0.5rem; }
  .item-info { min-width: 0; flex: 1; }
  .item-name { font-size: var(--text-xs); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
  .item-meta { display: flex; align-items: center; gap: 0.35rem; margin-top: 0.15rem; flex-wrap: wrap; }
  .item-badge { font-size: var(--text-xs); padding: 0 6px; border-radius: 9999px; border: 1px solid color-mix(in oklch, currentColor 25%, transparent); font-weight: 500; }
  .item-badge.downloading { background: color-mix(in oklch, var(--series-1) 10%, transparent); color: var(--series-1); }
  .item-badge.stalled { background: color-mix(in oklch, var(--muted-foreground) 10%, transparent); color: var(--muted-foreground); }
  .item-badge.waiting { background: color-mix(in oklch, var(--series-3) 10%, transparent); color: var(--series-3); }
  .item-detail { font-size: var(--text-xs); font-family: var(--font-mono); color: var(--muted-foreground); }
  .item-detail.dl { color: var(--series-1); }

  .dl-row { flex-wrap: wrap; }
  .dl-pct { font-size: var(--text-xs); font-family: var(--font-mono); font-variant-numeric: tabular-nums; color: var(--series-1); flex-shrink: 0; }
  .dl-progress-track { width: 100%; height: 3px; background: color-mix(in oklch, var(--series-1) 15%, transparent); border-radius: 2px; overflow: hidden; }
  .dl-progress-bar { height: 100%; background: var(--series-1); border-radius: 2px; transition: width 0.5s ease; }
  .dl-pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--series-1); flex-shrink: 0; animation: pulse 1.5s ease-in-out infinite; }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.75); }
  }
</style>
