<script lang="ts">
  import type { ServiceGroup, ServiceStatus } from '../types.js'
  import { PAGES } from '../pages.js'
  import Icon from './Icon.svelte'
  import StatusIcon from './StatusIcon.svelte'

  interface Props {
    open: boolean
    services: ServiceGroup[]
    serviceStatus: Map<string, ServiceStatus>
  }

  let { open = $bindable(false), services, serviceStatus }: Props = $props()

  interface Item { group: string; label: string; detail: string; href: string; external: boolean; icon?: string; img?: string }

  let dialogEl = $state<HTMLDialogElement | null>(null)
  let query = $state('')
  let selected = $state(0)

  let items = $derived<Item[]>([
    ...PAGES.map(p => ({ group: 'Pages', label: p.label, detail: '', href: `#${p.id}`, external: false, icon: p.icon })),
    ...services.flatMap(g => g.items.map(s => ({ group: 'Services', label: s.name, detail: s.desc, href: s.href, external: true, img: s.icon }))),
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
    if (item.external) window.open(item.href, '_blank', 'noopener')
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
  aria-label="Search pages and services"
>
  <div class="search-row">
    <Icon name="magnifier" size="16px" />
    <input
      type="text"
      bind:value={query}
      onkeydown={onKeydown}
      placeholder="Search pages and services…"
      aria-label="Search"
      aria-controls="palette-results"
      aria-activedescendant={results.length ? `palette-opt-${selected}` : undefined}
      autocomplete="off"
      spellcheck="false"
    />
    <kbd>esc</kbd>
  </div>
  <ul id="palette-results" role="listbox">
    {#each results as item, i (item.href)}
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
      <li class="empty">No pages or services match "{query}"</li>
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
