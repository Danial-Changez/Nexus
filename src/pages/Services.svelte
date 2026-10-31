<script lang="ts">
  import type { ServiceGroup, ServiceStatus } from '../lib/types.js'
  import ServiceCard from '../lib/components/ServiceCard.svelte'
  import PageHeader from '../lib/components/PageHeader.svelte'

  interface Props {
    services?: ServiceGroup[]
    serviceStatus?: Map<string, ServiceStatus>
  }

  let { services = [], serviceStatus = new Map() }: Props = $props()

  let totalServices = $derived(services.reduce((sum, g) => sum + g.items.length, 0))
  let servicesUp = $derived(
    [...serviceStatus.values()].filter(s => s.status === 'up').length
  )
</script>

<PageHeader title="Services" subtitle="All Local Services with Status Monitoring">
  <div class="page-stat">
    <div class="page-stat-value up">{servicesUp}</div>
    <div class="page-stat-label">Up</div>
  </div>
  <div class="page-divider"></div>
  <div class="page-stat">
    <div class="page-stat-value">{totalServices}</div>
    <div class="page-stat-label">Total</div>
  </div>
</PageHeader>

{#each services as group (group.section)}
  <div class="section-title">{group.section}</div>
  <div class="links-grid">
    {#each group.items as svc (svc.href)}
      {@const svcState = serviceStatus.get(svc.href)}
      <ServiceCard
        service={svc}
        status={svcState?.status ?? 'checking'}
        latency={svcState?.latency}
      />
    {/each}
  </div>
{/each}

<style>
  .page-stat-value.up { color: var(--chart-2); }

  .section-title {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-foreground);
    margin: 1.75rem 0 0.75rem;
    padding-left: 2px;
  }

  .links-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 0.65rem;
  }
</style>
