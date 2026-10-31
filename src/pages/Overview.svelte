<script lang="ts">
  import type { Host, ServiceGroup, HostData, ServiceStatus, WolConfig, WolStatus } from '../lib/types.js'
  import { downFirst } from '../lib/utils/services.js'
  import Header from '../lib/components/Header.svelte'
  import HostCard from '../lib/components/HostCard.svelte'
  import ServiceRow from '../lib/components/ServiceRow.svelte'
  import StatusLine from '../lib/components/StatusLine.svelte'

  interface Props {
    hosts?: Host[]
    services?: ServiceGroup[]
    overviewServiceNames?: string[]
    hostData?: Map<string, HostData>
    serviceStatus?: Map<string, ServiceStatus>
    wolConfig?: WolConfig | null
    wolStatus?: WolStatus | null
  }

  let { hosts = [], services = [], overviewServiceNames = [], hostData = new Map(), serviceStatus = new Map(), wolConfig = null, wolStatus = null }: Props = $props()

  let overviewServices = $derived(
    overviewServiceNames.length
      ? services
          .map(g => ({
            section: g.section,
            items: g.items.filter(s => overviewServiceNames.includes(s.name)),
          }))
          .filter(g => g.items.length > 0)
      : services
  )
</script>

<Header title="Overview" {wolConfig} {wolStatus} />

<StatusLine {hosts} {hostData} services={services.flatMap(g => g.items)} {serviceStatus} />

<div class="grid">
  {#each hosts as host (host.key)}
    <HostCard {host} data={hostData.get(host.key) ?? null} compact />
  {/each}
</div>

<div class="services-section">
  {#each overviewServices as group (group.section)}
    <section>
      <h2 class="section-title">{group.section}</h2>
      <div class="list-surface">
        {#each downFirst(group.items, serviceStatus) as svc (svc.href)}
          <ServiceRow service={svc} status={serviceStatus.get(svc.href)} compact />
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }

  .services-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 0 1rem;
    margin-top: 0.5rem;
    align-items: start;
  }

  @media (max-width: 480px) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
