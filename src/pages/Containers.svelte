<script lang="ts">
  import { onMount } from 'svelte'
  import type { Host } from '../lib/types.js'
  import { fmt } from '../lib/utils/format.js'
  import Icon from '../lib/components/Icon.svelte'
  import PageHeader from '../lib/components/PageHeader.svelte'
  import Selector from '../lib/components/Selector.svelte'

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
        image: c.image || '',
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
    loading = true
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

  function isHealthy(c: ContainerInfo) {
    return (c.status || '').toLowerCase() === 'healthy'
  }

  onMount(() => {
    fetchContainers()
    const interval = setInterval(fetchContainers, 30000)
    return () => clearInterval(interval)
  })

  let search = $state('')
  let sortBy = $state('name')

  const SORTS = [
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

<!-- Extracted: reusable container card snippet -->
{#snippet containerCard(container: ContainerInfo, showHost: boolean)}
  {@const running = isRunning(container)}
  <div class="container-card card" class:dimmed={!running}>
    <div class="container-header">
      <div class="container-icon" class:running>
        <span style="color:{running ? '#56d4a0' : 'var(--muted-foreground)'}"><Icon name="container" size="15px" /></span>
      </div>
      <div class="container-info">
        <div class="container-name">{container.name}</div>
        <div class="container-image">{container.image}</div>
      </div>
      <span class="container-badge" class:running class:healthy={isHealthy(container)} class:stopped={!running}>
        {isHealthy(container) ? 'Healthy' : running ? 'Running' : container.status || 'Stopped'}
      </span>
    </div>
    <div class="container-meta">
      {#if showHost}
        <span class="meta-tag host-tag">{container.host}</span>
      {/if}
      {#if container.cpu != null}
        <span class="meta-tag">
          <span class="meta-icon"><Icon name="cpu" size="10px" /></span>
          {container.cpu.toFixed(1)}%
        </span>
      {/if}
      {#if container.mem != null}
        <span class="meta-tag meta-mem">
          <span class="meta-icon"><Icon name="memory" size="10px" /></span>
          {fmt(container.mem)}
          {#if container.memLimit}/ {fmt(container.memLimit)}{/if}
        </span>
      {/if}
    </div>
  </div>
{/snippet}

<PageHeader title="Containers" subtitle="Docker Containers across all Hosts">
  <div class="page-stat">
    <div class="page-stat-value running">{runningCount}</div>
    <div class="page-stat-label">Running</div>
  </div>
  <div class="page-divider"></div>
  <div class="page-stat">
    <div class="page-stat-value">{containers.length}</div>
    <div class="page-stat-label">Total</div>
  </div>
</PageHeader>

<div class="controls-bar">
  <div class="search-wrap">
    <span class="search-icon"><Icon name="magnifier" size="14px" /></span>
    <input
      type="text"
      class="search-input"
      placeholder="Search containers..."
      bind:value={search}
    />
    {#if search}
      <button class="search-clear" onclick={() => search = ''}>×</button>
    {/if}
  </div>
  <div class="sort-wrap">
    <Selector options={SORTS} value={sortBy} onselect={k => sortBy = k} />
  </div>
</div>

{#if loading && containers.length === 0}
  <div class="loading-state">
    <div class="loading-pulse">Loading containers...</div>
  </div>
{:else if containers.length === 0}
  <div class="empty-state">
    <span class="empty-icon"><Icon name="box" size="48px" /></span>
    <p>No container data available</p>
    <span class="empty-hint">Ensure the Glances Docker plugin is enabled on your hosts</span>
  </div>
{:else}
  {@const list = filtered}
  {#if list.length === 0}
    <div class="empty-state">
      <p>No containers match "{search}"</p>
    </div>
  {:else if sortBy !== 'name'}
    <div class="container-grid">
      {#each list as container (container.id)}
        {@render containerCard(container, true)}
      {/each}
    </div>
  {:else}
    {#each hosts as host (host.key)}
      {@const hostContainers = list.filter(c => c.hostKey === host.key)}
      {#if hostContainers.length > 0}
      <div class="host-label">
        <span style="color:var(--muted-foreground)"><Icon name="container" size="14px" /></span>
        {host.name}
        <span class="host-count">{hostContainers.filter(isRunning).length}/{hostContainers.length}</span>
      </div>
      <div class="container-grid">
        {#each hostContainers as container (container.id)}
          {@render containerCard(container, false)}
        {/each}
      </div>
    {/if}
  {/each}
  {/if}
{/if}

<style>
  .controls-bar { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }

  .search-wrap { position: relative; flex: 1; max-width: 320px; }

  .search-icon {
    position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
    pointer-events: none; opacity: 0.5; display: flex; color: var(--muted-foreground);
  }

  .search-input {
    width: 100%; padding: 6px 28px 6px 30px; font-size: 0.7rem;
    font-family: 'Geist Mono', monospace; color: var(--foreground);
    background: var(--secondary); border: 1px solid var(--border);
    border-radius: var(--radius); outline: none; transition: border-color 150ms ease;
  }
  .search-input::placeholder { color: var(--muted-foreground); }
  .search-input:focus { border-color: var(--primary); }

  .search-clear {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    background: none; border: none; color: var(--muted-foreground);
    cursor: pointer; font-size: 0.9rem; line-height: 1; padding: 2px 4px;
  }
  .search-clear:hover { color: var(--foreground); }

  .sort-wrap { margin-left: auto; }

  .host-tag { font-weight: 600; color: var(--foreground); }

  .page-stat-value.running { color: var(--chart-2); }

  .host-label {
    display: flex; align-items: center; gap: 0.5rem;
    font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted-foreground);
    margin: 1.5rem 0 0.75rem; padding-left: 2px;
  }

  .host-count {
    font-family: 'Geist Mono', monospace; font-size: 0.6rem;
    padding: 1px 6px; border-radius: 4px; background: var(--secondary); border: 1px solid var(--border);
  }

  .container-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.65rem; }
  .container-card { padding: 0.85rem 1rem; }
  .container-card.dimmed { opacity: 0.55; }
  .container-card.dimmed:hover { opacity: 0.8; }

  .container-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; }

  .container-icon {
    width: 30px; height: 30px; border-radius: calc(var(--radius) - 2px);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    background: var(--secondary); border: 1px solid var(--border);
  }
  .container-icon.running {
    background: color-mix(in oklch, var(--chart-2) 12%, transparent);
    border-color: color-mix(in oklch, var(--chart-2) 25%, transparent);
  }

  .container-info { flex: 1; min-width: 0; }
  .container-name { font-size: 0.78rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .container-image { font-size: 0.58rem; color: var(--muted-foreground); font-family: 'Geist Mono', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }

  .container-badge { font-size: 0.58rem; padding: 2px 7px; border-radius: 9999px; font-weight: 500; flex-shrink: 0; white-space: nowrap; }
  .container-badge.running { background: color-mix(in oklch, var(--chart-2) 12%, transparent); color: var(--chart-2); border: 1px solid color-mix(in oklch, var(--chart-2) 25%, transparent); }
  .container-badge.healthy { background: color-mix(in oklch, var(--chart-2) 18%, transparent); color: var(--chart-2); border: 1px solid color-mix(in oklch, var(--chart-2) 30%, transparent); }
  .container-badge.stopped { background: var(--muted); color: var(--muted-foreground); border: 1px solid var(--border); }

  .container-meta { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .meta-mem { margin-left: auto; }
  .meta-tag {
    display: flex; align-items: center; gap: 0.3rem;
    font-size: 0.6rem; font-family: 'Geist Mono', monospace; font-variant-numeric: tabular-nums;
    padding: 2px 6px; border-radius: 4px; background: var(--secondary);
    border: 1px solid var(--border); color: var(--muted-foreground);
  }
  .meta-icon { display: flex; color: var(--muted-foreground); }

  @media (max-width: 640px) {
    .controls-bar { flex-direction: column; align-items: stretch; }
    .search-wrap { max-width: none; }
    .sort-wrap { align-self: flex-end; }
    .container-grid { grid-template-columns: 1fr; }
  }

  .loading-state, .empty-state { text-align: center; padding: 3rem 1rem; color: var(--muted-foreground); }
  .empty-icon { display: inline-flex; margin-bottom: 1rem; opacity: 0.5; color: var(--muted-foreground); }
  .empty-hint { font-size: 0.7rem; opacity: 0.6; display: block; margin-top: 0.5rem; }
</style>
