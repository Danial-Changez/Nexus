<script lang="ts">
  import Icon from './Icon.svelte'
  import { PAGES } from '../pages.js'
  import { clock } from '../utils/clock.svelte.js'

  interface Props {
    activePage: string
    collapsed: boolean
    onsearch: () => void
  }

  let { activePage, collapsed = $bindable(false), onsearch }: Props = $props()

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
  const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  let timeStr = $derived(timeFmt.format(clock.now))
  let dateStr = $derived(dateFmt.format(clock.now))

  // Phone tab bar: first four pages as tabs, the rest behind "More"
  const TAB_COUNT = 4
  let moreActive = $derived(PAGES.slice(TAB_COUNT).some(p => p.id === activePage))
  let moreEl = $state<HTMLElement | null>(null)
</script>

<aside class="sidebar" class:collapsed>
  <div class="sidebar-header">
    {#if collapsed}
      <button class="logo-btn" onclick={() => collapsed = false} aria-label="Expand sidebar">
        <img src="/nexus-icon.png" alt="" class="sidebar-logo" width="28" height="28" />
      </button>
    {:else}
      <img src="/nexus-icon.png" alt="" class="sidebar-logo" width="32" height="32" />
      <span class="sidebar-title">Nexus</span>
      <button class="sidebar-toggle" onclick={() => collapsed = true} aria-label="Collapse sidebar">
        <span class="toggle-icon"><Icon name="arrowLeft" size="16px" /></span>
      </button>
    {/if}
  </div>

  <nav class="sidebar-nav" aria-label="Pages">
    <button class="nav-item search-item" onclick={onsearch} aria-label="Search" title={collapsed ? 'Search (⌘K)' : undefined}>
      <span class="nav-icon"><Icon name="magnifier" size="18px" /></span>
      {#if !collapsed}
        <span class="nav-label">Search</span>
        <kbd>⌘K</kbd>
      {/if}
    </button>
    {#each PAGES as item, i (item.id)}
      <a
        href="#{item.id}"
        class="nav-item"
        class:active={activePage === item.id}
        aria-current={activePage === item.id ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? `${item.label} (${i + 1})` : undefined}
      >
        <span class="nav-icon"><Icon name={item.icon} size="18px" /></span>
        {#if !collapsed}
          <span class="nav-label">{item.label}</span>
          <kbd>{i + 1}</kbd>
        {/if}
      </a>
    {/each}
  </nav>

  <div class="sidebar-footer">
    <span class="footer-clock">{timeStr}</span>
    {#if !collapsed}
      <span class="footer-date">{dateStr}</span>
    {/if}
  </div>
</aside>

<nav class="tabbar" aria-label="Pages">
  {#each PAGES.slice(0, TAB_COUNT) as item (item.id)}
    <a href="#{item.id}" class="tab" class:active={activePage === item.id} aria-current={activePage === item.id ? 'page' : undefined}>
      <Icon name={item.icon} size="20px" />
      <span>{item.label}</span>
    </a>
  {/each}
  <button class="tab" class:active={moreActive} popovertarget="tab-more" aria-label="More pages">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="19" cy="12" r="1.75"/></svg>
    <span>More</span>
  </button>
  <div id="tab-more" class="tab-more" popover bind:this={moreEl}>
    {#each PAGES.slice(TAB_COUNT) as item (item.id)}
      <a href="#{item.id}" class="more-item" class:active={activePage === item.id} onclick={() => moreEl?.hidePopover()}>
        <Icon name={item.icon} size="18px" />{item.label}
      </a>
    {/each}
    <button class="more-item" onclick={() => { moreEl?.hidePopover(); onsearch() }}>
      <Icon name="magnifier" size="18px" />Search
    </button>
  </div>
</nav>

<style>
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--sidebar-width);
    background: var(--sidebar-bg);
    border-right: 1px solid var(--sidebar-border);
    display: flex;
    flex-direction: column;
    z-index: 100;
    transition: width 200ms ease;
    overflow: hidden;
  }

  .sidebar.collapsed {
    width: var(--sidebar-collapsed-width);
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border-bottom: 1px solid var(--sidebar-border);
    min-height: 60px;
  }

  .sidebar-logo {
    width: 32px;
    height: 32px;
    border-radius: var(--radius);
    flex-shrink: 0;
    object-fit: contain;
  }

  .logo-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius);
    transition: opacity 150ms ease;
    margin: 0 auto;
  }

  .logo-btn:hover {
    opacity: 0.8;
  }

  .logo-btn .sidebar-logo {
    width: 28px;
    height: 28px;
  }

  .sidebar-title {
    flex: 1;
    font-size: var(--text-md);
    font-weight: 700;
    color: var(--foreground);
    letter-spacing: -0.02em;
  }

  .sidebar-toggle {
    background: none;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 150ms ease;
    flex-shrink: 0;
  }

  .sidebar-toggle:hover {
    background: var(--sidebar-item-hover);
  }

  .toggle-icon {
    display: flex;
    color: var(--muted-foreground);
  }

  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .search-item { margin-bottom: 0.5rem; }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    width: 100%;
    padding: 0.5rem 0.6rem;
    border: none;
    border-radius: var(--radius);
    background: none;
    color: var(--muted-foreground);
    cursor: pointer;
    font-size: var(--text-sm);
    font-family: inherit;
    font-weight: 500;
    text-decoration: none;
    transition: background-color 150ms ease, color 150ms ease;
    position: relative;
    text-align: left;
  }

  .sidebar.collapsed .nav-item {
    justify-content: center;
    padding: 0.5rem;
  }

  .nav-item:hover {
    background: var(--sidebar-item-hover);
    color: var(--foreground);
  }

  .nav-item.active {
    background: var(--sidebar-item-active);
    color: var(--foreground);
  }

  .nav-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 25%;
    bottom: 25%;
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: var(--sidebar-item-active-border);
  }

  .nav-icon {
    display: flex;
    flex-shrink: 0;
  }

  .nav-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  kbd {
    font: 500 var(--text-xs) 'Geist Mono', monospace;
    color: var(--muted-foreground);
    opacity: 0.6;
  }

  .sidebar-footer {
    border-top: 1px solid var(--sidebar-border);
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .footer-clock {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--foreground);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .sidebar.collapsed .sidebar-footer {
    padding: 0.75rem 0.25rem;
  }

  .footer-date {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  /* ── Phone tab bar ── */
  .tabbar { display: none; }

  @media (max-width: 480px) {
    .sidebar { display: none; }

    .tabbar {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 100;
      min-height: var(--tabbar-height);
      padding: 0.35rem env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      background: var(--sidebar-bg);
      border-top: 1px solid var(--sidebar-border);
    }

    .tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      min-height: 44px;
      font-size: var(--text-xs);
      font-weight: 500;
      font-family: inherit;
      color: var(--muted-foreground);
      text-decoration: none;
      background: none;
      border: none;
      cursor: pointer;
    }

    .tab.active { color: var(--primary); }

    .tab-more {
      inset: auto 0.75rem calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px) + 0.5rem) auto;
      margin: 0;
      min-width: 12rem;
      padding: 0.35rem;
      background: var(--bg-surface);
      color: var(--foreground);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 12px 32px oklch(0 0 0 / 0.5);
    }

    .more-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      width: 100%;
      min-height: 44px;
      padding: 0 0.75rem;
      border: none;
      border-radius: calc(var(--radius) - 3px);
      background: none;
      color: var(--foreground);
      font-size: var(--text-sm);
      font-weight: 500;
      font-family: inherit;
      text-decoration: none;
      cursor: pointer;
    }

    .more-item:hover, .more-item.active { background: var(--sidebar-item-hover); }
  }
</style>
