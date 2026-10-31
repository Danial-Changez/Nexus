/* ── Shared chart utilities ──
 * Composable building blocks for canvas-based sparkline charts.
 * Both Sparkline (CPU) and NetSparkline (network) import from here.
 */

interface Pad { l: number; r: number; t: number; b: number }
interface Coord { x: number; y: number }

/** Prepare a canvas for HiDPI rendering. Returns { ctx, W, H } in CSS pixels. */
export function initCanvas(canvasEl: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; W: number; H: number } {
  const ctx = canvasEl.getContext('2d')!
  const dpr = window.devicePixelRatio || 1
  const rect = canvasEl.getBoundingClientRect()
  canvasEl.width = rect.width * dpr
  canvasEl.height = rect.height * dpr
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, rect.width, rect.height)
  return { ctx, W: rect.width, H: rect.height }
}

/** Measure widest y-axis label and return a dynamic left padding value. */
export function dynamicLeftPad(ctx: CanvasRenderingContext2D, maxVal: number, steps: number, formatter: (v: number) => string): number {
  ctx.font = '11px "Geist", system-ui, sans-serif'
  let maxW = 0
  for (let i = 0; i <= steps; i++) {
    const label = formatter((maxVal / steps) * i)
    maxW = Math.max(maxW, ctx.measureText(label).width)
  }
  return Math.ceil(maxW) + 16
}

/** Draw horizontal grid lines with y-axis labels. */
export function drawGrid(ctx: CanvasRenderingContext2D, pad: Pad, w: number, h: number, maxVal: number, steps: number, formatter: (v: number) => string): void {
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.font = '11px "Geist", system-ui, sans-serif'
  for (let i = 0; i <= steps; i++) {
    const val = (maxVal / steps) * i
    const y = pad.t + h - (i / steps) * h
    ctx.strokeStyle = 'oklch(1 0 0 / 6%)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(pad.l, y)
    ctx.lineTo(pad.l + w, y)
    ctx.stroke()
    ctx.fillStyle = 'oklch(0.705 0.015 286.067)'
    ctx.fillText(formatter(val), pad.l - 6, y)
  }
}

/** Draw x-axis time labels evenly spaced. */
export function drawXLabels(ctx: CanvasRenderingContext2D, pad: Pad, w: number, h: number, timestamps: string[]): void {
  if (timestamps.length < 2) return
  ctx.font = '11px "Geist", system-ui, sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'oklch(0.705 0.015 286.067)'
  const n = Math.min(5, timestamps.length)
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i / (n - 1)) * (timestamps.length - 1))
    const ts = timestamps[idx]
    if (!ts) continue
    const d = new Date(ts)
    const label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const x = pad.l + (idx / (timestamps.length - 1)) * w
    ctx.textAlign = i === 0 ? 'left' : i === n - 1 ? 'right' : 'center'
    ctx.fillText(label, x, pad.t + h + 4)
  }
}

/** Trace a Catmull-Rom spline onto the current canvas path. */
function smoothPath(ctx: CanvasRenderingContext2D, points: number[], pad: Pad, w: number, h: number, maxVal: number): void {
  const coords: Coord[] = points.map((v, i) => ({
    x: pad.l + (i / (points.length - 1)) * w,
    y: pad.t + h - (Math.max(0, v || 0) / maxVal) * h,
  }))
  if (coords.length < 2) return
  const yMin = pad.t, yMax = pad.t + h
  ctx.moveTo(coords[0].x, coords[0].y)
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)]
    const p1 = coords[i]
    const p2 = coords[i + 1]
    const p3 = coords[Math.min(coords.length - 1, i + 2)]
    const cp1y = Math.min(yMax, Math.max(yMin, p1.y + (p2.y - p0.y) / 6))
    const cp2y = Math.min(yMax, Math.max(yMin, p2.y - (p3.y - p1.y) / 6))
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6, cp1y,
      p2.x - (p3.x - p1.x) / 6, cp2y,
      p2.x, p2.y
    )
  }
}

/** Draw a filled area + stroke line for a data series. */
export function drawSeries(ctx: CanvasRenderingContext2D, points: number[], pad: Pad, w: number, h: number, maxVal: number, strokeColor: string, fillColor: string): void {
  ctx.beginPath()
  ctx.moveTo(pad.l, pad.t + h)
  smoothPath(ctx, points, pad, w, h, maxVal)
  ctx.lineTo(pad.l + w, pad.t + h)
  ctx.closePath()
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + h)
  grad.addColorStop(0, fillColor)
  grad.addColorStop(1, 'transparent')
  ctx.fillStyle = grad
  ctx.fill()

  ctx.beginPath()
  smoothPath(ctx, points, pad, w, h, maxVal)
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  ctx.stroke()
}

/** Round a max value up to a nice axis ceiling. */
export function niceMax(values: number[], fallback = 1): number {
  const filtered = values.filter(v => v != null && v >= 0)
  let max = Math.max(...filtered, fallback)
  const mag = Math.pow(10, Math.floor(Math.log10(max)))
  max = Math.ceil(max / mag) * mag
  return max || fallback
}

/** Snap mouse X to nearest data index. Returns { idx, snapX } or null. */
export function snapToIndex(mouseX: number, pad: Pad, chartW: number, count: number): { idx: number; snapX: number } | null {
  const relX = mouseX - pad.l
  if (relX < 0 || relX > chartW) return null
  const idx = Math.max(0, Math.min(count - 1, Math.round((relX / chartW) * (count - 1))))
  const snapX = pad.l + (idx / (count - 1)) * chartW
  return { idx, snapX }
}

/** Compute tooltip left (flips when near right edge). */
export function tooltipLeft(snapX: number, wrapWidth: number, ttWidth: number): number {
  let left = snapX + 10
  if (left + ttWidth > wrapWidth) left = snapX - ttWidth - 10
  return left
}

/** Map a data value to a Y pixel coordinate. */
export function valueToY(value: number, pad: Pad, chartH: number, maxVal: number): number {
  return pad.t + chartH - (Math.max(0, value) / maxVal) * chartH
}

/** Index of the first timestamp inside the trailing window of `seconds`. */
export function cutoffIndex(timestamps: string[], seconds: number): number {
  const cutoff = Date.now() - seconds * 1000
  const i = timestamps.findIndex(t => Date.parse(t) >= cutoff)
  return i === -1 ? timestamps.length : i
}
