<script lang="ts">
  import {
    initCanvas, dynamicLeftPad, drawGrid, drawXLabels,
    drawSeries, niceMax, snapToIndex, tooltipLeft, valueToY,
  } from '../utils/chart.js'

  // Canvas can't read CSS vars; keep in sync with --series-1 / --series-2 in app.css
  const COLORS = {
    series1: { stroke: 'oklch(0.707 0.165 254.624)', fill: 'oklch(0.707 0.165 254.624 / 0.15)' },
    series2: { stroke: 'oklch(0.702 0.183 293.541)', fill: 'oklch(0.702 0.183 293.541 / 0.12)' },
  }

  interface Series { points: number[]; color: keyof typeof COLORS }
  interface Row { dot: 'series1' | 'series2' | 'muted'; label: string; value: string; divider?: boolean }

  interface Props {
    series: Series[]              // paint order: first is drawn behind
    timestamps?: string[]
    maxVal?: number               // fixed axis ceiling; omit to auto-scale
    fmtAxis: (v: number) => string
    height?: string
    endDot?: boolean              // marker on the last point of series[0]
    rows: (idx: number) => Row[]  // tooltip rows for the hovered index
    label?: string                // text alternative: summarise the chart's message
  }

  let { series, timestamps = [], maxVal, fmtAxis, height = '200px', endDot = false, rows, label }: Props = $props()

  let canvasEl = $state<HTMLCanvasElement | null>(null)
  let hoverIdx = $state<number | null>(null)
  let crosshairStyle = $state('')
  let dotStyles = $state<string[]>([])
  let tooltipStyle = $state('')

  const BASE_PAD = { r: 20, t: 20, b: 44 }
  const STEPS = 4

  let lastPAD = { l: 50, ...BASE_PAD }
  let lastMax = 1024  // draw() sets the real value before any hover

  function draw() {
    if (!canvasEl || !series[0]?.points.length) return
    const { ctx, W, H } = initCanvas(canvasEl)

    const max = maxVal ?? niceMax(series.flatMap(s => s.points), 1024)
    lastMax = max
    const PAD = { ...BASE_PAD, l: dynamicLeftPad(ctx, max, STEPS, fmtAxis) }
    lastPAD = PAD

    const w = W - PAD.l - PAD.r, h = H - PAD.t - PAD.b
    drawGrid(ctx, PAD, w, h, max, STEPS, fmtAxis)
    drawXLabels(ctx, PAD, w, h, timestamps)
    for (const s of series) {
      drawSeries(ctx, s.points, PAD, w, h, max, COLORS[s.color].stroke, COLORS[s.color].fill)
    }

    if (endDot) {
      const pts = series[0].points
      const { stroke } = COLORS[series[0].color]
      const x = PAD.l + w
      const y = valueToY(pts[pts.length - 1], PAD, h, max)
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fillStyle = stroke
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.strokeStyle = stroke.replace(')', ' / 0.3)')
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  function handleMove(e: MouseEvent) {
    if (!canvasEl || !series[0]?.points.length) return
    const PAD = lastPAD
    const rect = canvasEl.getBoundingClientRect()
    const chartW = rect.width - PAD.l - PAD.r
    const chartH = rect.height - PAD.t - PAD.b

    const snap = snapToIndex(e.clientX - rect.left, PAD, chartW, series[0].points.length)
    if (!snap) {
      hoverIdx = null
      return
    }

    hoverIdx = snap.idx
    crosshairStyle = `left:${snap.snapX}px`
    dotStyles = series.map(s => `left:${snap.snapX}px;top:${valueToY(s.points[snap.idx] ?? 0, PAD, chartH, lastMax)}px`)
    const wrapWidth = canvasEl.parentElement?.getBoundingClientRect().width ?? 300
    tooltipStyle = `left:${tooltipLeft(snap.snapX, wrapWidth, 150)}px;top:4px`
  }

  // Redraw only when the data actually changes, not on every parent re-render
  let dataKey = $derived(series.map(s => `${s.points.length}:${s.points[s.points.length - 1] ?? 0}`).join('|'))

  $effect(() => {
    void dataKey
    if (canvasEl && series[0]?.points.length) {
      requestAnimationFrame(() => draw())
    }
  })
</script>

<div class="sparkline-wrap" role="img" aria-label={label}>
  <canvas
    class="sparkline"
    style="height: {height}"
    bind:this={canvasEl}
    aria-hidden="true"
    onmousemove={handleMove}
    onmouseleave={() => hoverIdx = null}
  ></canvas>
  <div class="spark-crosshair" class:visible={hoverIdx !== null} style={crosshairStyle}></div>
  {#each series as s, i (i)}
    <div class="tracking-dot {s.color}" class:visible={hoverIdx !== null} style={dotStyles[i]}></div>
  {/each}
  <div class="spark-tooltip" class:visible={hoverIdx !== null} style={tooltipStyle}>
    {#if hoverIdx !== null}
      {#if timestamps[hoverIdx]}
        <div class="tt-row time">{new Date(timestamps[hoverIdx]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
      {/if}
      {#each rows(hoverIdx) as row (row.label)}
        <div class="tt-row" class:divided={row.divider}>
          <span class="tt-dot {row.dot}"></span>
          <span class="tt-label">{row.label}</span>
          <span class="tt-val">{row.value}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .sparkline-wrap { position: relative; }

  canvas.sparkline {
    display: block;
    width: 100%;
    border-radius: calc(var(--radius) - 2px);
    background: transparent;
    border: 1px solid var(--border);
    cursor: crosshair;
  }

  .spark-crosshair {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--muted-foreground);
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
  }

  .spark-crosshair.visible { opacity: 0.4; }

  .tracking-dot {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    opacity: 0;
    transition: opacity 120ms ease;
    box-shadow: 0 0 6px oklch(0 0 0 / 0.4);
  }

  .tracking-dot.visible { opacity: 1; }
  .tracking-dot.series1 { background: var(--series-1); border: 1.5px solid color-mix(in oklch, var(--series-1) 60%, transparent); }
  .tracking-dot.series2 { background: var(--series-2); border: 1.5px solid color-mix(in oklch, var(--series-2) 60%, transparent); }

  .spark-tooltip {
    position: absolute;
    pointer-events: none;
    z-index: 10;
    background: color-mix(in oklch, var(--bg-surface) 96%, transparent);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    padding: 0.45rem 0.6rem;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
    white-space: nowrap;
    box-shadow: 0 4px 12px oklch(0 0 0 / 0.4);
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .spark-tooltip.visible { opacity: 1; }

  .tt-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    line-height: 1.6;
  }

  .tt-row.time {
    color: var(--muted-foreground);
    margin-bottom: 2px;
  }

  .tt-row.divided {
    border-top: 1px solid var(--border);
    padding-top: 2px;
    margin-top: 2px;
  }

  .tt-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tt-dot.series1 { background: var(--series-1); }
  .tt-dot.series2 { background: var(--series-2); }
  .tt-dot.muted { background: var(--muted-foreground); }

  .tt-label { color: var(--muted-foreground); }
  .tt-val { margin-left: auto; padding-left: 0.75rem; font-weight: 600; }
</style>
