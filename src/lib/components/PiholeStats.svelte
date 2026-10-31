<script lang="ts">
  import { onMount } from 'svelte'
  import { SVC_ICON } from '../types.js'
  import Icon from './Icon.svelte'

  interface PiholeStatsData {
    queries?: { percent_blocked?: number; total?: number; blocked?: number }
    gravity?: { domains_being_blocked?: number }
    clients?: { total?: number; active?: number }
  }

  let stats = $state<PiholeStatsData | null>(null)
  let error = $state<string | null>(null)

  async function fetchStats() {
    try {
      const res = await fetch('/api/pihole/stats')
      if (!res.ok) throw new Error(`${res.status}`)
      stats = await res.json()
      error = null
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error'
    }
  }

  onMount(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  })

  let blockedPercent = $derived(stats?.queries?.percent_blocked ?? 0)
  let totalQueries = $derived(stats?.queries?.total ?? 0)
  let blockedQueries = $derived(stats?.queries?.blocked ?? 0)
  let domainsBlocked = $derived(stats?.gravity?.domains_being_blocked ?? 0)
  let clientsEverSeen = $derived(stats?.clients?.total ?? 0)
  let uniqueClients = $derived(stats?.clients?.active ?? 0)
</script>

<div class="pihole-section">
  <div class="pihole-header">
    <img src="{SVC_ICON}/pi-hole.svg" alt="Pi-hole" class="pihole-icon" />
    <div>
      <span class="pihole-title">Pi-hole</span>
      <span class="pihole-subtitle">DNS & Ad Blocking</span>
    </div>
    {#if stats && !error}
      <span class="pihole-badge online">Active</span>
    {:else if error}
      <span class="pihole-badge offline">Unreachable</span>
    {:else}
      <span class="pihole-badge loading">Loading</span>
    {/if}
  </div>

  {#if stats && !error}
    <div class="pihole-stats">
      <div class="pihole-stat-card queries">
        <div class="stat-header">
          <span class="stat-icon queries"><Icon name="chart" size="13px" /></span>
          <span class="stat-label">Queries Today</span>
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
          <span class="stat-label">Domains on Blocklist</span>
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
        <span class="bar-label">Block Rate</span>
        <span class="bar-value blocked">{blockedPercent.toFixed(1)}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill blocked" style="width:{Math.min(blockedPercent, 100)}%"></div>
      </div>
    </div>

    <div class="bar-section">
      <div class="bar-row">
        <span class="bar-label">Active Clients</span>
        <span class="bar-value clients">{uniqueClients}/{clientsEverSeen}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill clients" style="width:{clientsEverSeen ? Math.min((uniqueClients / clientsEverSeen) * 100, 100) : 0}%"></div>
      </div>
    </div>
  {:else if error}
    <div class="pihole-error">Unable to reach Pi-hole API</div>
  {:else}
    <div class="pihole-error loading-pulse">Loading stats...</div>
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
    font-size: 0.95rem;
    font-weight: 600;
    display: block;
  }

  .pihole-subtitle {
    font-size: 0.65rem;
    color: var(--muted-foreground);
    font-family: 'Geist Mono', monospace;
  }

  .pihole-badge {
    margin-left: auto;
    font-size: 0.6rem;
    padding: 2px 8px;
    border-radius: 9999px;
    font-weight: 500;
  }

  .pihole-badge.online {
    background: color-mix(in oklch, var(--chart-2) 12%, transparent);
    color: var(--chart-2);
    border: 1px solid color-mix(in oklch, var(--chart-2) 25%, transparent);
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

  .stat-icon { display: flex; }
  .stat-icon.queries { color: #8bb3fa; }
  .stat-icon.blocked { color: #ef4444; }
  .stat-icon.domains { color: #e9b74a; }
  .stat-icon.clients { color: #56d4a0; }

  .stat-label {
    font-size: 0.55rem;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .stat-value {
    font-size: 1.1rem;
    font-weight: 700;
    font-family: 'Geist Mono', monospace;
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
  }

  .pihole-stat-card.queries .stat-value { color: var(--chart-1); }
  .pihole-stat-card.blocked .stat-value { color: oklch(0.637 0.237 25.331); }
  .pihole-stat-card.domains .stat-value { color: var(--chart-3); }
  .pihole-stat-card.clients .stat-value { color: var(--chart-2); }

  .stat-total {
    font-size: 0.7rem;
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
    font-size: 0.6rem;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .bar-value {
    font-size: 0.75rem;
    font-weight: 600;
    font-family: 'Geist Mono', monospace;
    font-variant-numeric: tabular-nums;
  }

  .bar-value.blocked { color: oklch(0.637 0.237 25.331); }
  .bar-value.clients { color: var(--chart-2); }

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

  .bar-fill.blocked { background: oklch(0.637 0.237 25.331); }
  .bar-fill.clients { background: var(--chart-2); }

  .pihole-error {
    font-size: 0.8rem;
    color: var(--muted-foreground);
    text-align: center;
    padding: 1rem;
  }

  @media (max-width: 640px) {
    .pihole-stats { grid-template-columns: repeat(2, 1fr); }
  }
</style>
