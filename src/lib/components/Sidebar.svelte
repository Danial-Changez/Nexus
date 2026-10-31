<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from './Icon.svelte'

  interface Props {
    activePage: string
    collapsed: boolean
    mobileOpen: boolean
  }

  let { activePage = $bindable('overview'), collapsed = $bindable(false), mobileOpen = $bindable(false) }: Props = $props()

  let now = $state(new Date())
  onMount(() => {
    const id = setInterval(() => now = new Date(), 1000)
    return () => clearInterval(id)
  })
  let timeStr = $derived(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
  let dateStr = $derived(now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))

  const navSections = [
    {
      label: 'Dashboard',
      items: [
        { id: 'overview', label: 'Overview', icon: 'home' },
      ],
    },
    {
      label: 'Resources',
      items: [
        { id: 'metrics', label: 'Metrics', icon: 'chart' },
        { id: 'services', label: 'Services', icon: 'link' },
        { id: 'containers', label: 'Containers', icon: 'container' },
      ],
    },
    {
      label: 'Monitoring',
      items: [
        { id: 'network', label: 'Network', icon: 'global' },
        { id: 'media', label: 'Media', icon: 'clapperboard' },
      ],
    },
  ]

  function navigate(id: string) {
    activePage = id
    mobileOpen = false
  }
</script>

{#if mobileOpen}
  <button class="sidebar-overlay" onclick={() => mobileOpen = false} aria-label="Close menu"></button>
{/if}
<aside class="sidebar" class:collapsed class:mobile-open={mobileOpen}>
  <div class="sidebar-header">
    {#if collapsed}
      <button class="logo-btn" onclick={() => collapsed = false} title="Expand sidebar">
        <img src="/nexus-icon.png" alt="Nexus" class="sidebar-logo" />
      </button>
    {:else}
      <img src="/nexus-icon.png" alt="Nexus" class="sidebar-logo" />
      <div class="sidebar-brand">
        <span class="sidebar-title">Nexus</span>
        <span class="sidebar-subtitle">Home</span>
      </div>
      <button class="sidebar-toggle" onclick={() => window.matchMedia('(max-width: 480px)').matches ? mobileOpen = false : collapsed = true} title="Collapse">
        <span class="toggle-icon"><Icon name="arrowLeft" size="16px" /></span>
      </button>
    {/if}
  </div>

  <nav class="sidebar-nav">
    {#each navSections as section (section.label)}
      {#if !collapsed}
        <div class="nav-section-label">{section.label}</div>
      {/if}
      {#each section.items as item (item.id)}
        <button
          class="nav-item"
          class:active={activePage === item.id}
          onclick={() => navigate(item.id)}
          title={collapsed ? item.label : undefined}
        >
          <span class="nav-icon"><Icon name={item.icon} size="18px" /></span>
          {#if !collapsed}
            <span class="nav-label">{item.label}</span>
          {/if}
        </button>
      {/each}
    {/each}
  </nav>

  <div class="sidebar-footer">
    {#if collapsed}
      <div class="sidebar-footer-info">
        <span class="footer-clock">{timeStr}</span>
      </div>
    {:else}
      <div class="sidebar-footer-info">
        <span class="footer-clock">{timeStr}</span>
        <span class="footer-date">{dateStr}</span>
      </div>
    {/if}
  </div>
</aside>

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

  .sidebar-brand {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .sidebar-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--foreground);
    letter-spacing: -0.02em;
  }

  .sidebar-subtitle {
    font-size: 0.65rem;
    color: var(--muted-foreground);
    font-family: 'Geist Mono', monospace;
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
    transition: background 150ms ease;
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
  }

  .nav-section-label {
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-foreground);
    padding: 0.75rem 0.5rem 0.35rem;
    opacity: 0.7;
  }

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
    font-size: 0.8rem;
    font-family: inherit;
    font-weight: 500;
    transition: background 150ms ease, color 150ms ease;
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

  .nav-item.active .nav-icon {
    filter: brightness(1.3);
  }

  .nav-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-footer {
    border-top: 1px solid var(--sidebar-border);
    padding: 0.75rem 1rem;
  }

  .sidebar-footer-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .footer-clock {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--foreground);
    font-family: 'Geist Mono', monospace;
    font-variant-numeric: tabular-nums;
  }

  .sidebar.collapsed .sidebar-footer {
    padding: 0.75rem 0.25rem;
  }

  .sidebar.collapsed .footer-clock {
    font-size: 0.6rem;
    white-space: nowrap;
  }

  .footer-date {
    font-size: 0.6rem;
    color: var(--muted-foreground);
    font-family: 'Geist Mono', monospace;
  }

  .sidebar-overlay {
    display: none;
  }

  @media (max-width: 480px) {
    .sidebar {
      transform: translateX(-100%);
      transition: transform 200ms ease;
    }

    .sidebar.mobile-open {
      transform: translateX(0);
      width: var(--sidebar-width);
      z-index: 200;
    }

    .sidebar-overlay {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 199;
      background: oklch(0 0 0 / 0.5);
      border: none;
      cursor: default;
    }
  }
</style>
