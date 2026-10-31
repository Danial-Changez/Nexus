<script lang="ts">
  import { fmtAgo } from '../utils/format.js'
  import { clock } from '../utils/clock.svelte.js'

  interface Props {
    updatedAt: number | null
    failing?: boolean
    interval: number   // poll interval in ms; data older than 3 intervals counts as stale
  }

  let { updatedAt, failing = false, interval }: Props = $props()

  let stale = $derived(!!updatedAt && (failing || clock.now - updatedAt > interval * 3))
</script>

{#if updatedAt}
  <span class="stale-note" class:warn={stale} aria-live={stale ? 'polite' : 'off'}>
    {stale ? `Not updating · last update ${fmtAgo(updatedAt, clock.now)}` : `Updated ${fmtAgo(updatedAt, clock.now)}`}
  </span>
{/if}
