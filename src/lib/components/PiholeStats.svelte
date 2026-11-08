<script lang="ts">
  import { onMount } from 'svelte'
  import { poll } from '../utils/poll.js'
  import Freshness from './Freshness.svelte'
  import { SVC_ICON } from '../types.js'
  import Icon from './Icon.svelte'

  interface PiholeStatsData {
    queries?: { percent_blocked?: number; total?: number; blocked?: number }
    gravity?: { domains_being_blocked?: number }
    clients?: { total?: number; active?: number }
  }

  const POLL_MS = 30000
  let stats = $state<PiholeStatsData | null>(null)
  let error = $state<string | null>(null)
  let updatedAt = $state<number | null>(null)

  async function fetchStats() {
    try {
      const res = await fetch('/api/pihole/stats')
      if (!res.ok) throw new Error(`${res.status}`)
      stats = await res.json()
      error = null
      updatedAt = Date.now()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error'
    }
  }

  onMount(() => poll(fetchStats, POLL_MS))

  let blockedPercent = $derived(stats?.queries?.percent_blocked ?? 0)
  let totalQueries = $derived(stats?.queries?.total ?? 0)
  let blockedQueries = $derived(stats?.queries?.blocked ?? 0)
  let domainsBlocked = $derived(stats?.gravity?.domains_being_blocked ?? 0)
  let clientsEverSeen = $derived(stats?.clients?.total ?? 0)
  let uniqueClients = $derived(stats?.clients?.active ?? 0)
</script>

<div class="pihole-section">
  <div class="pihole-header">
    <img src="{SVC_ICON}/pi-hole.svg" alt="" class="pihole-icon" width="28" height="28" />
    <div>
      <span class="pihole-title">Pi-hole</span>
      <span class="pihole-subtitle">DNS and ad blocking</span>
    </div>
    <span class="pihole-status">
      {#if stats && !error}
        <span class="pihole-badge online">Active</span>
      {:else if error}
        <span class="pihole-badge offline">Unreachable</span>
      {:else}
        <span class="pihole-badge loading">Loading…</span>
      {/if}
      <Freshness {updatedAt} failing={!!error} interval={POLL_MS} />
    </span>
  </div>

  {#if stats}
    <div class="pihole-stats">
      <div class="pihole-stat-card queries">
        <div class="stat-header">
          <span class="stat-icon queries"><Icon name="chart" size="13px" /></span>
          <span class="stat-label">Queries today</span>
        </div>
        <span class="stat-value">{totalQueries.toLocaleString()}</span>
      </div>
      <div class="pihole-stat-card blocked">
        <div class="stat-header">
          <span class="stat-icon blocked"><Icon name="shield" size="13px" /></span>
          <span class="stat-label">Blocked</span>
        </div>
        <span class="stat-value">{blockedQueries.toLocaleString()}</span>
      </div>
      <div class="pihole-stat-card domains">
        <div class="stat-header">
          <span class="stat-icon domains"><Icon name="database" size="13px" /></span>
          <span class="stat-label">Domains on blocklist</span>
        </div>
        <span class="stat-value">{domainsBlocked.toLocaleString()}</span>
      </div>
      <div class="pihole-stat-card clients">
        <div class="stat-header">
          <span class="stat-icon clients"><Icon name="devices" size="13px" /></span>
          <span class="stat-label">Clients</span>
        </div>
        <span class="stat-value">{uniqueClients}<span class="stat-total">/{clientsEverSeen}</span></span>
      </div>
    </div>

    <div class="bar-section">
      <div class="bar-row">
        <span class="bar-label">Block rate</span>
        <span class="bar-value blocked">{blockedPercent.toFixed(1)}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill blocked" style="width:{Math.min(blockedPercent, 100)}%"></div>
      </div>
    </div>

    <div class="bar-section">
      <div class="bar-row">
        <span class="bar-label">Active clients</span>
        <span class="bar-value clients">{uniqueClients}/{clientsEverSeen}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill clients" style="width:{clientsEverSeen ? Math.min((uniqueClients / clientsEverSeen) * 100, 100) : 0}%"></div>
      </div>
    </div>
  {:else if error}
    <div class="pihole-error">Couldn't reach the Pi-hole API ({error}). Check PIHOLE_URL and PIHOLE_PASSWORD in .env.</div>
  {:else}
    <div class="pihole-error loading-pulse">Loading…</div>
  {/if}
</div>

<style>
  .pihole-section {
    padding: 1.25rem 1.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 1.5rem;
  }

  .pihole-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .pihole-icon { width: 28px; height: 28px; }

  .pihole-title {
    font-size: var(--text-md);
    font-weight: 600;
    display: block;
  }

  .pihole-subtitle {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  .pihole-status {
    margin-left: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .pihole-badge {
    font-size: var(--text-xs);
    padding: 2px 8px;
    border-radius: 9999px;
    font-weight: 500;
  }

  .pihole-badge.online {
    background: color-mix(in oklch, var(--ok) 12%, transparent);
    color: var(--ok);
    border: 1px solid color-mix(in oklch, var(--ok) 25%, transparent);
  }

  .pihole-badge.offline {
    background: color-mix(in oklch, var(--destructive) 12%, transparent);
    color: var(--destructive);
    border: 1px solid color-mix(in oklch, var(--destructive) 25%, transparent);
  }

  .pihole-badge.loading {
    background: var(--muted);
    color: var(--muted-foreground);
    border: 1px solid var(--border);
  }

  .pihole-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .pihole-stat-card {
    padding: 0.75rem 0.85rem;
    border-radius: calc(var(--radius) - 2px);
    background: transparent;
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .stat-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .stat-icon { display: flex; color: var(--muted-foreground); }

  .stat-label {
    font-size: var(--text-xs);
    color: var(--muted-foreground);

    font-weight: 600;
  }

  .stat-value {
    font-size: var(--text-lg);
    font-weight: 700;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
  }


  .stat-total {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--muted-foreground);
  }

  .bar-section {
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
  }

  .bar-section + .bar-section {
    border-top: none;
    padding-top: 0.5rem;
  }

  .bar-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;
  }

  .bar-label {
    font-size: var(--text-xs);
    color: var(--muted-foreground);

    font-weight: 600;
  }

  .bar-value {
    font-size: var(--text-sm);
    font-weight: 600;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .bar-value.blocked { color: var(--series-2); }
  .bar-value.clients { color: var(--series-1); }

  .bar-track {
    height: 6px;
    background: var(--secondary);
    border-radius: 3px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.8s ease;
  }

  .bar-fill.blocked { background: var(--series-2); }
  .bar-fill.clients { background: var(--series-1); }

  .pihole-error {
    font-size: var(--text-sm);
    color: var(--muted-foreground);
    text-align: center;
    padding: 1rem;
  }

  @media (max-width: 640px) {
    .pihole-stats { grid-template-columns: repeat(2, 1fr); }
  }
</style>
