<script lang="ts">
  // Word-sized trend line (Tufte): no axes, endpoint marked.
  interface Props {
    points: number[]
    color?: string
    width?: number
    height?: number
    max?: number       // fixed ceiling (e.g. 100 for %); omit to fit the data
    label?: string
  }

  let { points, color = 'var(--series-1)', width = 120, height = 20, max, label }: Props = $props()

  let coords = $derived.by(() => {
    const vals = points.filter(v => Number.isFinite(v))
    if (vals.length < 2) return []
    const top = max ?? Math.max(...vals, 1e-9)
    const pad = 2
    return vals.map((v, i) => [
      (i / (vals.length - 1)) * (width - pad * 2) + pad,
      height - pad - (Math.min(v, top) / top) * (height - pad * 2),
    ])
  })
  let last = $derived(coords.at(-1))
</script>

{#if coords.length}
  <svg class="mini-spark" viewBox="0 0 {width} {height}" {width} {height} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'} preserveAspectRatio="none">
    <polyline points={coords.map(c => c.join(',')).join(' ')} fill="none" stroke={color} stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    {#if last}<circle cx={last[0]} cy={last[1]} r="2" fill={color} />{/if}
  </svg>
{/if}

<style>
  .mini-spark { display: block; max-width: 100%; overflow: visible; }
</style>
