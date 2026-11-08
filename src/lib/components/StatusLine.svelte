<script lang="ts">
  import type { Host, HostData, ServiceItem, ServiceStatus } from '../types.js'
  import { fmtAgo, fmtDuration } from '../utils/format.js'
  import { clock } from '../utils/clock.svelte.js'

  interface Props {
    hosts: Host[]
    hostData: Map<string, HostData>
    services: ServiceItem[]
    serviceStatus: Map<string, ServiceStatus>
    upstreamProblems?: string[]   // Pi-hole / media APIs returning errors
  }

  let { hosts, hostData, services, serviceStatus, upstreamProblems = [] }: Props = $props()

  let downServices = $derived(services.filter(s => serviceStatus.get(s.href)?.status === 'down'))
  let badHosts = $derived(hosts.filter(h => { const d = hostData.get(h.key); return d?.error || d?.stale }))
  let upCount = $derived(services.filter(s => serviceStatus.get(s.href)?.status === 'up').length)
  let checking = $derived(!serviceStatus.size && !hostData.size)
  let problems = $derived(downServices.length + badHosts.length + upstreamProblems.length)

  let lastCheck = $derived(Math.max(0, ...[...serviceStatus.values()].map(s => s.history.at(-1)?.at ?? 0)))

  let headline = $derived.by(() => {
    if (checking) return 'Checking…'
    if (!problems) return 'All systems normal'
    if (problems === 1 && downServices.length) return `${downServices[0].name} is down`
    if (problems === 1 && badHosts.length) return `${badHosts[0].name} is not responding`
    if (problems === 1) return `${upstreamProblems[0]} API isn't responding`
    return `${problems} problems`
  })

  let detail = $derived.by(() => {
    if (checking) return ''
    const counts = `${upCount} of ${services.length} services up`
    if (!problems) return `${hosts.length} hosts, ${services.length} services`
    if (problems === 1 && downServices.length) {
      const since = serviceStatus.get(downServices[0].href)?.downSince
      return since ? `for ${fmtDuration(clock.now - since)} · ${counts}` : counts
    }
    if (problems === 1) return counts
    const parts = []
    if (downServices.length) parts.push(`${downServices.map(s => s.name).join(', ')} down`)
    if (badHosts.length) parts.push(`${badHosts.map(h => h.name).join(', ')} not responding`)
    if (upstreamProblems.length) parts.push(`${upstreamProblems.join(', ')} API errors`)
    return parts.join(' · ')
  })
</script>

<div class="statusline" class:bad={problems > 0} aria-live="polite">
  {#if problems}
    <svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="var(--crit)" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 21 19.5H3z"/><path d="M12 10v4M12 17h.01"/></svg>
  {:else}
    <svg class="glyph" class:loading-pulse={checking} viewBox="0 0 24 24" fill="none" stroke={checking ? 'var(--idle)' : 'var(--ok)'} stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/>{#if !checking}<path d="m8 12.5 2.6 2.5L16 9.5"/>{/if}</svg>
  {/if}
  <div class="text">
    <div class="headline">{headline}</div>
    {#if detail}<div class="detail">{detail}</div>{/if}
  </div>
  {#if lastCheck}
    <span class="when">Checked {fmtAgo(lastCheck, clock.now)}</span>
  {/if}
</div>

<style>
  .statusline {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.9rem 1.1rem;
    margin-bottom: 1.25rem;
    border-radius: var(--radius);
    background: color-mix(in oklch, var(--card) 10%, transparent);
    border: 1px solid var(--card-border);
  }

  .statusline.bad {
    background: color-mix(in oklch, var(--crit) 8%, transparent);
    border-color: color-mix(in oklch, var(--crit) 35%, transparent);
  }

  .glyph { width: 1.6rem; height: 1.6rem; flex-shrink: 0; }

  .text { min-width: 0; }
  .headline { font-size: var(--text-md); font-weight: 600; }
  .detail { font-size: var(--text-sm); color: var(--muted-foreground); }

  .when {
    margin-left: auto;
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 480px) {
    .when { display: none; }
  }
</style>
