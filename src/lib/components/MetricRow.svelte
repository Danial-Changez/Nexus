<script lang="ts">
  import { barClass, WARN_AT, CRIT_AT } from '../utils/format.js'
  import Icon from './Icon.svelte'

  interface Props {
    icon: string
    label: string
    value: number
    detail: string
    avg?: number   // reference tick, e.g. the 24h average
  }

  let { icon, label, value, detail, avg }: Props = $props()
  let cls = $derived(barClass(value))
  let pct = $derived(Math.min(100, Math.max(0, value)))
</script>

<div class="metric">
  <div class="metric-top">
    <span class="metric-label"><Icon name={icon} size="13px" />{label}</span>
    <span class="metric-value" class:warn={cls === 'warn'} class:crit={cls === 'crit'}>{Math.round(value)}%</span>
  </div>
  <div class="metric-detail">{detail}</div>
  <!-- Bullet graph: bands mark the warn/crit thresholds; the bar only takes color past them -->
  <div
    class="bullet"
    style="--warn-at:{WARN_AT}%;--crit-at:{CRIT_AT}%"
    role="meter"
    aria-label="{label} usage"
    aria-valuenow={Math.round(value)}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <div class="bar {cls}" style="transform:scaleX({pct / 100})"></div>
    {#if avg != null}
      <div class="tick" style="left:{Math.min(100, avg)}%" title="Average {Math.round(avg)}%"></div>
    {/if}
  </div>
</div>

<style>
  .metric {
    flex: 1;
    min-width: 0;
  }

  .metric-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .metric-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    font-weight: 600;
  }

  .metric-value {
    font-size: var(--text-lg);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
  }

  .metric-value.warn { color: var(--warn); }
  .metric-value.crit { color: var(--crit); }

  .metric-detail {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    margin-bottom: 6px;
    font-variant-numeric: tabular-nums;
  }

  .bullet {
    position: relative;
    height: 12px;
    border-radius: 3px;
    overflow: hidden;
    background: linear-gradient(to right,
      oklch(1 0 0 / 5%) 0 var(--warn-at),
      oklch(1 0 0 / 9%) var(--warn-at) var(--crit-at),
      oklch(1 0 0 / 14%) var(--crit-at));
  }

  .bar {
    position: absolute;
    inset: 3px 0;
    border-radius: 2px;
    transform-origin: left;
    transition: transform 200ms ease;
  }

  .bar.ok { background: oklch(0.985 0 0 / 0.8); }
  .bar.warn { background: var(--warn); }
  .bar.crit { background: var(--crit); }

  .tick {
    position: absolute;
    top: 1px;
    bottom: 1px;
    width: 2px;
    margin-left: -1px;
    background: var(--foreground);
    opacity: 0.55;
  }
</style>
