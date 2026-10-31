<script lang="ts">
  import type { ServiceGroup, ServiceStatus } from '../lib/types.js'
  import { downFirst } from '../lib/utils/services.js'
  import ServiceRow from '../lib/components/ServiceRow.svelte'
  import PageHeader from '../lib/components/PageHeader.svelte'

  interface Props {
    services?: ServiceGroup[]
    serviceStatus?: Map<string, ServiceStatus>
  }

  let { services = [], serviceStatus = new Map() }: Props = $props()

  let totalServices = $derived(services.reduce((sum, g) => sum + g.items.length, 0))
  let down = $derived([...serviceStatus.values()].filter(s => s.status === 'down').length)
  let up = $derived([...serviceStatus.values()].filter(s => s.status === 'up').length)
</script>

<PageHeader title="Services" subtitle="Checked every 30 seconds from the Nexus server">
  <div class="page-stat">
    {#if down}
      <div class="page-stat-value down">{down} down</div>
    {:else}
      <div class="page-stat-value up">{up} up</div>
    {/if}
    <div class="page-stat-label">of {totalServices} services</div>
  </div>
</PageHeader>

{#each services as group (group.section)}
  <h2 class="section-title">{group.section}</h2>
  <div class="list-surface">
    {#each downFirst(group.items, serviceStatus) as svc (svc.href)}
      <ServiceRow service={svc} status={serviceStatus.get(svc.href)} />
    {/each}
  </div>
{/each}

<style>
  .page-stat-value.up { color: var(--ok); }
  .page-stat-value.down { color: var(--crit); }
</style>
