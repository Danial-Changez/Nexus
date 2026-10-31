<script lang="ts">
  import type { Host, HostData } from '../lib/types.js'
  import { cutoffIndex } from '../lib/utils/chart.js'
  import { getParam, setParam } from '../lib/utils/hash.js'
  import PageHeader from '../lib/components/PageHeader.svelte'
  import HostCard from '../lib/components/HostCard.svelte'
  import Selector from '../lib/components/Selector.svelte'

  interface Props {
    hosts?: Host[]
    hostData?: Map<string, HostData>
  }

  let { hosts = [], hostData = new Map() }: Props = $props()

  const RANGES = [
    { label: '1h',  seconds: 3600 },
    { label: '6h',  seconds: 21600 },
    { label: '12h', seconds: 43200 },
    { label: '24h', seconds: 86400 },
  ]
  let activeLabel = $state(getParam('range') ?? '1h')
  $effect(() => setParam('range', activeLabel === '1h' ? null : activeLabel))

  let onlineCount = $derived([...hostData.values()].filter(d => !d.error && !d.stale).length)

  let activeRange = $derived(RANGES.find(r => r.label === activeLabel) ?? RANGES[0])

  let filteredHostData = $derived.by(() => {
    const out = new Map()

    for (const [key, data] of hostData) {
      if (!data || data.error || !data.cpuTimestamps?.length) {
        out.set(key, data)
        continue
      }

      const startIdx = cutoffIndex(data.cpuTimestamps, activeRange.seconds)
      out.set(key, {
        ...data,
        cpuHistory: {
          user: data.cpuHistory?.user.slice(startIdx) ?? [],
          system: data.cpuHistory?.system.slice(startIdx) ?? [],
        },
        cpuTimestamps: data.cpuTimestamps?.slice(startIdx) ?? [],
      })
    }
    return out
  })
</script>

<PageHeader title="Metrics" subtitle="{onlineCount} of {hosts.length} hosts online" />

<div class="controls-bar">
  <Selector options={RANGES} value={activeLabel} onselect={k => activeLabel = k} />
</div>

<div class="grid">
  {#each hosts as host (host.key)}
    <HostCard {host} data={filteredHostData.get(host.key) ?? null} />
  {/each}
</div>

<style>
  .controls-bar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1rem;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
</style>
