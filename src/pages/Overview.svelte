<script lang="ts">
  import type { Host, ServiceGroup, HostData, ServiceStatus, WolConfig, WolStatus } from '../lib/types.js'
  import Header from '../lib/components/Header.svelte'
  import HostCard from '../lib/components/HostCard.svelte'
  import ServiceCard from '../lib/components/ServiceCard.svelte'

  interface Props {
    hosts?: Host[]
    services?: ServiceGroup[]
    overviewServiceNames?: string[]
    hostData?: Map<string, HostData | null>
    onlineCount?: number
    serviceStatus?: Map<string, ServiceStatus>
    wolConfig?: WolConfig | null
    wolStatus?: WolStatus | null
  }

  let { hosts = [], services = [], overviewServiceNames = [], hostData = new Map(), onlineCount = 0, serviceStatus = new Map(), wolConfig = null, wolStatus = null }: Props = $props()

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

<Header
  title="Overview"
  subtitle="Resource Telemetry across all Hosts"
  {onlineCount}
  totalHosts={hosts.length}
  {wolConfig}
  {wolStatus}
/>

<div class="grid">
  {#each hosts as host (host.key)}
    <HostCard {host} data={hostData.get(host.key) ?? null} compact />
  {/each}
</div>

<div class="services-section">
  {#each overviewServices as group (group.section)}
    <div class="services-column">
      <div class="section-title">{group.section}</div>
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
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 1rem;
  }

  .services-section {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-top: 1.75rem;
  }

  .services-column {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-title {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted-foreground);
    margin-bottom: 0.25rem;
    padding-left: 2px;
  }

  @media (max-width: 640px) {
    .services-section { grid-template-columns: 1fr; }
  }

  @media (max-width: 480px) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
