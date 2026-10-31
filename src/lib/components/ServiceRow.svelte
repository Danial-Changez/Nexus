<script lang="ts">
  import type { ServiceItem, ServiceStatus } from '../types.js'
  import { fmtDuration } from '../utils/format.js'
  import { clock } from '../utils/clock.svelte.js'
  import StatusIcon from './StatusIcon.svelte'
  import MiniSpark from './MiniSpark.svelte'

  interface Props {
    service: ServiceItem
    status?: ServiceStatus
    compact?: boolean   // Overview columns: no heartbeat strip
  }

  let { service, status, compact = false }: Props = $props()

  let state = $derived(status?.status ?? 'checking')
  let latencies = $derived((status?.history ?? []).map(c => c.latency ?? 0))
  let failures = $derived((status?.history ?? []).filter(c => !c.up).length)
</script>

<a href={service.href} target="_blank" rel="noopener" class="svc-row" class:down={state === 'down'}>
  <StatusIcon status={state} />
  <img class="svc-icon" src={service.icon} alt="" width="20" height="20" loading="lazy" />
  <span class="svc-info">
    <span class="svc-name">{service.name}</span>
    <span class="svc-desc">{service.desc}</span>
  </span>
  {#if !compact && status?.history.length}
    <span class="beats" role="img" aria-label="{status.history.length - failures} of {status.history.length} recent checks up">
      {#each status.history as c (c.at)}
        <i class:fail={!c.up} title="{new Date(c.at).toLocaleTimeString()} · {c.up ? `${c.latency}ms` : c.code ? `HTTP ${c.code}` : 'no response'}"></i>
      {/each}
    </span>
  {/if}
  <span class="svc-stat">
    {#if state === 'down'}
      <span class="down-for">{status?.downSince ? `down ${fmtDuration(clock.now - status.downSince)}` : 'down'}</span>
    {:else if status?.latency != null}
      {#if !compact}<MiniSpark points={latencies} width={36} height={14} />{/if}
      <span class="lat">{status.latency}ms</span>
    {/if}
  </span>
</a>

<style>
  .svc-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.9rem;
    min-height: 44px;
    text-decoration: none;
    color: var(--foreground);
    transition: background-color 150ms ease;
  }

  .svc-row + :global(.svc-row) { border-top: 1px solid var(--border); }
  .svc-row:hover { background: oklch(1 0 0 / 4%); }
  .svc-row.down { background: color-mix(in oklch, var(--crit) 7%, transparent); }

  .svc-icon { width: 20px; height: 20px; flex-shrink: 0; }

  .svc-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }

  .svc-name,
  .svc-desc {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .svc-name { font-size: var(--text-sm); font-weight: 600; }
  .svc-desc { font-size: var(--text-xs); color: var(--muted-foreground); }

  .beats { display: flex; gap: 2px; flex-shrink: 0; }
  .beats i { width: 4px; height: 16px; border-radius: 1px; background: var(--ok); opacity: 0.75; }
  .beats i.fail { background: var(--crit); opacity: 1; }

  .svc-stat {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
    min-width: 3.5rem;
    justify-content: flex-end;
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--muted-foreground);
  }

  .down-for { color: var(--crit); font-weight: 600; }

  @media (max-width: 640px) {
    .beats { display: none; }
  }
</style>
