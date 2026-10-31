<script lang="ts">
  import { barClass } from '../utils/format.js'
  import Icon from './Icon.svelte'

  interface Props {
    icon: string
    label: string
    value: number
    detail: string
  }

  let { icon, label, value, detail }: Props = $props()
  let cls = $derived(barClass(value))
</script>

<div class="metric">
  <div class="metric-top">
    <div class="metric-label-group">
      <span class="metric-icon"><Icon name={icon} size="13px" /></span>
      <span class="metric-label">{label} USAGE</span>
    </div>
    <span class="metric-value">{value.toFixed(1)}%</span>
  </div>
  <div class="metric-detail">{detail}</div>
  <div class="bar-track">
    <div class="bar-fill" class:low={cls === 'low'} class:mid={cls === 'mid'} class:high={cls === 'high'} class:critical={cls === 'critical'} style="width:{value}%"></div>
  </div>
</div>

<style>
  .metric {
    flex: 1;
    min-width: 0;
  }

  .metric-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .metric-label-group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .metric-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--muted-foreground);
    opacity: 0.6;
  }

  .metric-label {
    font-size: 0.6rem;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .metric-value {
    font-size: 1.05rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    font-family: 'Geist Mono', monospace;
    color: var(--foreground);
  }

  .metric-detail {
    font-size: 0.6rem;
    color: var(--muted-foreground);
    margin-bottom: 6px;
    font-variant-numeric: tabular-nums;
    font-family: 'Geist Mono', monospace;
  }

  .bar-track {
    height: 6px;
    background: var(--secondary);
    border-radius: 3px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.8s ease;
  }

  .bar-fill.low { background: var(--chart-2); }
  .bar-fill.mid { background: var(--chart-3); }
  .bar-fill.high { background: var(--chart-5); }
  .bar-fill.critical { background: var(--destructive); }
</style>
