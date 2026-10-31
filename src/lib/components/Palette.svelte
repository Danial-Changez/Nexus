<script lang="ts">
  import type { Host, ServiceGroup, ServiceStatus, WolConfig, WolStatus } from '../types.js'
  import { PAGES } from '../pages.js'
  import { power } from '../utils/power.svelte.js'
  import Icon from './Icon.svelte'
  import StatusIcon from './StatusIcon.svelte'

  interface Props {
    open: boolean
    hosts: Host[]
    services: ServiceGroup[]
    serviceStatus: Map<string, ServiceStatus>
    wolConfig: WolConfig | null
    wolStatus: WolStatus | null
  }

  let { open = $bindable(false), hosts, services, serviceStatus, wolConfig, wolStatus }: Props = $props()

  interface Item { group: string; label: string; detail: string; href: string; external: boolean; icon?: string; img?: string; action?: () => void }

  // Container names are fetched each time the palette opens, not polled
  let containers = $state<{ name: string; host: string; running: boolean }[]>([])

  async function loadContainers() {
    const lists = await Promise.all(hosts.map(async h => {
      try {
        const res = await fetch(`/api/glances/${h.key}/api/4/containers`)
        const data = res.ok ? await res.json() : []
        return (Array.isArray(data) ? data : []).map((c: any) => ({
          name: c.name || 'unknown',
          host: h.name,
          running: /^(running|healthy|up)/i.test(c.status || ''),
        }))
      } catch {
        return []
      }
    }))
    containers = lists.flat().sort((a, b) => a.name.localeCompare(b.name))
  }

  function requestPower(req: 'wake' | 'shutdown') {
    power.request = req
    location.hash = 'overview'
  }

  let powerItems = $derived<Item[]>(!wolConfig ? [] : [
    wolStatus?.online
      ? { group: 'Actions', label: `Shut down ${wolConfig.name || wolConfig.hostname}…`, detail: 'Asks for confirmation on the Overview', href: 'action:shutdown', external: false, icon: 'power', action: () => requestPower('shutdown') }
      : { group: 'Actions', label: `Wake ${wolConfig.name || wolConfig.hostname}`, detail: 'Sends a Wake-on-LAN packet', href: 'action:wake', external: false, icon: 'power', action: () => requestPower('wake') },
  ])

  let dialogEl = $state<HTMLDialogElement | null>(null)
  let query = $state('')
  let selected = $state(0)

  let items = $derived<Item[]>([
    ...PAGES.map(p => ({ group: 'Pages', label: p.label, detail: '', href: `#${p.id}`, external: false, icon: p.icon })),
    ...powerItems,
    ...services.flatMap(g => g.items.map(s => ({ group: 'Services', label: s.name, detail: s.desc, href: s.href, external: true, img: s.icon }))),
    ...containers.map(c => ({ group: 'Containers', label: c.name, detail: `${c.host}${c.running ? '' : ' · stopped'}`, href: `#containers?q=${encodeURIComponent(c.name)}`, external: false, icon: 'container' })),
  ])

  let results = $derived.by(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items
      .filter(i => i.label.toLowerCase().includes(q) || i.detail.toLowerCase().includes(q))
      .sort((a, b) => +!a.label.toLowerCase().startsWith(q) - +!b.label.toLowerCase().startsWith(q))
  })

  $effect(() => {
    if (!dialogEl) return
    if (open && !dialogEl.open) {
      query = ''
      selected = 0
      dialogEl.showModal()
      loadContainers()
    } else if (!open && dialogEl.open) {
      dialogEl.close()
    }
  })

  $effect(() => {
    void query
    selected = 0
  })

  function go(item: Item | undefined) {
    if (!item) return
    open = false
    if (item.action) item.action()
    else if (item.external) window.open(item.href, '_blank', 'noopener')
    else location.hash = item.href
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = results.length
      if (n) selected = (selected + (e.key === 'ArrowDown' ? 1 : n - 1)) % n
      dialogEl?.querySelector(`[data-idx="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[selected])
    }
  }
</script>

<dialog
  class="palette"
  bind:this={dialogEl}
  onclose={() => open = false}
  onclick={e => { if (e.target === dialogEl) open = false }}
  aria-label="Search pages, services and containers"
>
  <div class="search-row">
    <Icon name="magnifier" size="16px" />
    <input
      type="text"
      bind:value={query}
      onkeydown={onKeydown}
      placeholder="Search pages, services, containers…"
      aria-label="Search"
      aria-controls="palette-results"
      aria-activedescendant={results.length ? `palette-opt-${selected}` : undefined}
      autocomplete="off"
      spellcheck="false"
    />
    <kbd>esc</kbd>
  </div>
  <ul id="palette-results" role="listbox">
    {#each results as item, i (item.group + item.href)}
      {#if i === 0 || results[i - 1].group !== item.group}
        <li class="group" role="presentation">{item.group}</li>
      {/if}
      <!-- Keyboard selection is handled by the input via aria-activedescendant -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li
        id="palette-opt-{i}"
        data-idx={i}
        role="option"
        aria-selected={i === selected}
        class="option"
        class:selected={i === selected}
        onclick={() => go(item)}
        onmousemove={() => selected = i}
      >
        {#if item.img}
          <img src={item.img} alt="" width="16" height="16" />
        {:else if item.icon}
          <span class="opt-icon"><Icon name={item.icon} size="16px" /></span>
        {/if}
        <span class="opt-label">{item.label}</span>
        <span class="opt-detail">{item.detail}</span>
        {#if item.external}
          <StatusIcon status={serviceStatus.get(item.href)?.status ?? 'checking'} size={10} />
        {/if}
      </li>
    {:else}
      <li class="empty">Nothing matches "{query}"</li>
    {/each}
  </ul>
</dialog>

<style>
  .palette {
    margin: 12vh auto auto;
    width: min(32rem, calc(100vw - 2rem));
    max-height: 70vh;
    padding: 0;
    background: var(--bg-surface);
    color: var(--foreground);
    border: 1px solid var(--border);
    border-radius: 0.85rem;
    box-shadow: 0 24px 60px oklch(0 0 0 / 0.55);
    overflow: hidden;
    overscroll-behavior: contain;
  }

  .palette[open] { display: flex; flex-direction: column; }

  .palette::backdrop { background: oklch(0 0 0 / 0.5); }

  .search-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.8rem 1rem;
    border-bottom: 1px solid var(--border);
    color: var(--muted-foreground);
  }

  input {
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    outline: none;
    color: var(--foreground);
    font: inherit;
    font-size: var(--text-md);
  }

  input::placeholder { color: var(--muted-foreground); }

  kbd {
    font: 500 var(--text-xs) 'Geist Mono', monospace;
    color: var(--muted-foreground);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0 0.3rem;
  }

  ul {
    list-style: none;
    overflow-y: auto;
    padding: 0.35rem;
  }

  .group {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    padding: 0.6rem 0.65rem 0.25rem;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.65rem;
    border-radius: calc(var(--radius) - 3px);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .option.selected { background: var(--sidebar-item-active); }

  .opt-icon { display: flex; color: var(--muted-foreground); }
  .opt-label { font-weight: 500; white-space: nowrap; }
  .opt-detail {
    flex: 1;
    min-width: 0;
    color: var(--muted-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty {
    padding: 1.5rem 1rem;
    text-align: center;
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }
</style>
