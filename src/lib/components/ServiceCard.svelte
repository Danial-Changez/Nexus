<script lang="ts">
  import type { ServiceItem } from '../types.js'

  interface Props {
    service: ServiceItem
    status?: string
    latency?: number | null
  }

  let { service, status = 'checking', latency = null }: Props = $props()
</script>

<a href={service.href} target="_blank" rel="noopener" class="link-card card">
  <div class="link-icon">
    <img src={service.icon} alt={service.name} />
  </div>
  <div class="link-info">
    <div class="link-name">{service.name}</div>
    <div class="link-desc">{service.desc}</div>
  </div>
  {#if latency}
    <div class="link-stat-pills">
      <span class="link-stat-pill">{latency}ms</span>
    </div>
  {/if}
  <div class="link-status {status}"></div>
</a>

<style>
  .link-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    text-decoration: none;
    color: var(--foreground);
  }

  .link-card:hover {
    border-color: oklch(1 0 0 / 14%);
  }

  .link-icon {
    width: 34px;
    height: 34px;
    border-radius: var(--radius);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--secondary);
    border: 1px solid var(--border);
  }
  .link-icon img { width: 20px; height: 20px; }

  .link-info { flex: 1; min-width: 0; }

  .link-name {
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .link-desc {
    font-size: 0.65rem;
    color: var(--muted-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .link-stat-pills {
    display: flex;
    gap: 0.35rem;
    margin-left: auto;
    flex-shrink: 0;
  }

  .link-stat-pill {
    font-size: 0.6rem;
    font-family: 'Geist Mono', monospace;
    font-variant-numeric: tabular-nums;
    padding: 2px 6px;
    border-radius: 6px;
    background: var(--secondary);
    border: 1px solid var(--border);
    color: var(--muted-foreground);
    white-space: nowrap;
  }

  .link-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--muted);
  }

  .link-status.up {
    background: var(--chart-2);
    box-shadow: 0 0 6px color-mix(in oklch, var(--chart-2) 40%, transparent);
  }

  .link-status.down {
    background: var(--destructive);
    box-shadow: 0 0 6px oklch(0.704 0.191 22.216 / 0.4);
  }

  .link-status.checking {
    animation: pulse 1.5s ease-in-out infinite;
    background: var(--muted-foreground);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>
