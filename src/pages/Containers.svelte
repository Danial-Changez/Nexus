<script lang="ts">
  import { untrack } from 'svelte'
  import { poll } from '../lib/utils/poll.js'
  import { getParam, setParam } from '../lib/utils/hash.js'
  import type { Host } from '../lib/types.js'
  import { fmt } from '../lib/utils/format.js'
  import Icon from '../lib/components/Icon.svelte'
  import PageHeader from '../lib/components/PageHeader.svelte'
  import StatusIcon from '../lib/components/StatusIcon.svelte'

  interface Props {
    hosts?: Host[]
  }

  interface ContainerInfo {
    name: string
    image: string
    status: string
    cpu: number | null
    mem: number | null
    memLimit: number | null
    host: string
    hostKey: string
    id: string
  }

  let { hosts = [] }: Props = $props()

  let containers = $state<ContainerInfo[]>([])
  let loading = $state(true)

  async function fetchContainersFromHost(host: Host): Promise<ContainerInfo[]> {
    try {
      const res = await fetch(`/api/glances/${host.key}/api/4/containers`)
      if (!res.ok) return []
      const data = await res.json()
      const list: any[] = Array.isArray(data) ? data : []
      return list.map(c => ({
        name: c.name || 'unknown',
        image: String([c.image ?? ''].flat()[0] ?? '').split(',')[0],  // Glances 4 sends ["repo:tag,repo@sha"]
        status: c.status || '',
        cpu: c.cpu_percent ?? c.cpu?.total ?? null,
        mem: c.memory_usage ?? c.memory?.usage ?? null,
        memLimit: c.memory_limit ?? c.memory?.limit ?? null,
        host: host.name,
        hostKey: host.key,
        id: c.id || c.name,
      }))
    } catch {
      return []
    }
  }

  async function fetchContainers() {
    const allResults = await Promise.all(hosts.map(fetchContainersFromHost))
    containers = allResults.flat().sort((a, b) => {
      const aRunning = isRunning(a) ? 0 : 1
      const bRunning = isRunning(b) ? 0 : 1
      if (aRunning !== bRunning) return aRunning - bRunning
      return a.name.localeCompare(b.name)
    })
    loading = false
  }

  function isRunning(c: ContainerInfo) {
    const s = (c.status || '').toLowerCase()
    return s === 'running' || s === 'healthy' || s.startsWith('up')
  }

  // Hosts arrive with the config; start polling once they're known
  $effect(() => {
    if (hosts.length) return untrack(() => poll(fetchContainers, 30000))
  })

  let search = $state(getParam('q') ?? '')
  let sortBy = $state(getParam('sort') ?? 'name')
  $effect(() => setParam('q', search.trim()))
  $effect(() => setParam('sort', sortBy === 'name' ? null : sortBy))

  const COLUMNS = [
    { key: 'name', label: 'Name' },
    { key: 'cpu',  label: 'CPU' },
    { key: 'mem',  label: 'Memory' },
  ]

  let filtered = $derived.by(() => {
    let list = containers
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.image.toLowerCase().includes(q) ||
        c.host.toLowerCase().includes(q)
      )
    }
    if (sortBy === 'cpu') {
      list = [...list].sort((a, b) => (b.cpu ?? -1) - (a.cpu ?? -1))
    } else if (sortBy === 'mem') {
      list = [...list].sort((a, b) => (b.mem ?? -1) - (a.mem ?? -1))
    }
    return list
  })

  let runningCount = $derived(containers.filter(isRunning).length)
</script>

<PageHeader title="Containers" subtitle="Docker containers reported by Glances on each host">
  <div class="page-stat">
    <div class="page-stat-value">{runningCount} running</div>
    <div class="page-stat-label">of {containers.length} containers</div>
  </div>
</PageHeader>

<div class="controls-bar">
  <div class="search-wrap">
    <span class="search-icon"><Icon name="magnifier" size="14px" /></span>
    <input
      type="search"
      class="search-input"
      name="container-search"
      placeholder="Search by name, image or host…"
      aria-label="Search containers"
      autocomplete="off"
      spellcheck="false"
      bind:value={search}
    />
  </div>
</div>

<svelte:window onhashchange={() => search = getParam('q') ?? ''} />

{#snippet sortHeader(col: { key: string; label: string }, cls: string)}
  <th class={cls} aria-sort={sortBy === col.key ? (col.key === 'name' ? 'ascending' : 'descending') : 'none'}>
    <button class="sort-btn" class:active={sortBy === col.key} onclick={() => sortBy = col.key}>
      {col.label}
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d={col.key === 'name' ? 'M2 6.5 5 3.5l3 3' : 'M2 3.5 5 6.5l3-3'} fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
    </button>
  </th>
{/snippet}

{#if loading && containers.length === 0}
  <div class="list-surface skeleton-table" aria-hidden="true">
    {#each [0, 1, 2, 3, 4] as i (i)}<div class="skeleton" style="width:{70 - i * 8}%"></div>{/each}
  </div>
{:else if containers.length === 0}
  <div class="empty-state">
    <span class="empty-icon"><Icon name="box" size="48px" /></span>
    <p>No containers reported</p>
    <span class="empty-hint">Enable the Glances Docker plugin on your hosts to list their containers here.</span>
  </div>
{:else if filtered.length === 0}
  <div class="empty-state">
    <p>No containers match "{search}"</p>
    <button class="clear-btn" onclick={() => search = ''}>Clear search</button>
  </div>
{:else}
  <div class="table-wrap list-surface">
    <table>
      <thead>
        <tr>
          <th class="col-status"><span class="visually-hidden">Status</span></th>
          {@render sortHeader(COLUMNS[0], 'col-name')}
          {@render sortHeader(COLUMNS[1], 'col-num')}
          {@render sortHeader(COLUMNS[2], 'col-num')}
        </tr>
      </thead>
      {#each hosts as host (host.key)}
        {@const rows = filtered.filter(c => c.hostKey === host.key)}
        {#if rows.length > 0}
          <tbody>
            <tr class="group-row">
              <th colspan="4" scope="rowgroup">
                {host.name}
                <span class="host-count">{rows.filter(isRunning).length} of {rows.length} running</span>
              </th>
            </tr>
            {#each rows as c (c.id)}
              {@const running = isRunning(c)}
              <tr class:dimmed={!running}>
                <td class="col-status"><StatusIcon status={running ? 'up' : 'idle'} /></td>
                <td class="col-name">
                  <span class="c-name">{c.name}</span>
                  <span class="c-image" translate="no">{c.image}</span>
                </td>
                <td class="col-num">{c.cpu != null ? `${c.cpu.toFixed(1)}%` : '–'}</td>
                <td class="col-num">
                  {c.mem != null ? fmt(c.mem) : '–'}
                </td>
              </tr>
            {/each}
          </tbody>
        {/if}
      {/each}
    </table>
  </div>
{/if}

<style>
  .controls-bar { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }

  .search-wrap { position: relative; flex: 1; max-width: 360px; }

  .search-icon {
    position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
    pointer-events: none; display: flex; color: var(--muted-foreground);
  }

  .search-input {
    width: 100%; min-height: 2.25rem; padding: 0 10px 0 32px; font: inherit; font-size: var(--text-sm);
    color: var(--foreground);
    background: color-mix(in oklch, var(--input) 80%, transparent); border: none;
    border-radius: var(--radius); outline: none; transition: box-shadow 150ms ease;
  }
  .search-input::placeholder { color: var(--muted-foreground); }
  .search-input:focus-visible { box-shadow: 0 0 0 2px var(--ring); }

  .table-wrap { overflow-x: auto; }

  table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }

  th, td { padding: 0.5rem 0.9rem; text-align: left; }
  thead th { height: 2.5rem; font-size: var(--text-xs); font-weight: 500; color: var(--muted-foreground); background: var(--table-head); }
  tbody tr + tr td { border-top: 1px solid oklch(1 0 0 / 4%); }

  .col-status { width: 2rem; padding-right: 0; }
  .col-num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; width: 1%; }
  thead .col-num .sort-btn { margin-left: auto; }

  .sort-btn {
    display: inline-flex; align-items: center; gap: 0.3rem;
    background: none; border: none; padding: 0; cursor: pointer;
    font: inherit; color: inherit;
  }
  .sort-btn svg { opacity: 0; }
  .sort-btn.active { color: var(--foreground); }
  .sort-btn.active svg { opacity: 1; }
  .sort-btn:hover { color: var(--foreground); }

  .group-row th {
    font-size: var(--text-sm); font-weight: 600; color: var(--foreground);
    background: oklch(1 0 0 / 3%);
    border-top: 1px solid var(--border);
  }
  tbody:first-of-type .group-row th { border-top: none; }

  .host-count { font-size: var(--text-xs); font-weight: 400; color: var(--muted-foreground); margin-left: 0.5rem; }

  .c-name { display: block; font-weight: 600; }
  .c-image { display: block; font-size: var(--text-xs); color: var(--muted-foreground); overflow-wrap: anywhere; }

  tr.dimmed td { color: var(--muted-foreground); }
  tr.dimmed .c-name { font-weight: 500; }

  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

  .skeleton-table { display: flex; flex-direction: column; gap: 0.9rem; padding: 1rem; }

  .loading-state, .empty-state { text-align: center; padding: 3rem 1rem; color: var(--muted-foreground); }
  .empty-icon { display: inline-flex; margin-bottom: 1rem; opacity: 0.5; color: var(--muted-foreground); }
  .empty-hint { font-size: var(--text-sm); display: block; margin-top: 0.5rem; }

  .clear-btn {
    margin-top: 0.75rem; min-height: 2.25rem; padding: 0 1rem; font: inherit; font-size: var(--text-sm); font-weight: 500;
    color: var(--foreground); background: color-mix(in oklch, var(--card) 70%, transparent);
    border: 1px solid color-mix(in oklch, var(--border) 80%, transparent); border-radius: var(--radius);
    box-shadow: var(--button-shadow); cursor: pointer;
  }
  .clear-btn:hover { background: color-mix(in oklch, var(--muted) 40%, transparent); border-color: var(--border); }

  @media (max-width: 640px) {
    .search-wrap { max-width: none; }
    th, td { padding: 0.5rem 0.6rem; }
  }
</style>
