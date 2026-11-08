<script lang="ts">
  import type { NetData } from '../types.js'
  import Icon from './Icon.svelte'
  import { fmtRate } from '../utils/format.js'

  interface Props {
    net?: NetData | null
  }

  let { net = null }: Props = $props()
</script>

{#if net}
  <div class="net-stats">
    <div class="net-stat">
      <span class="net-icon rx"><Icon name="arrowDown" size="13px" /></span>
      <div class="net-stat-info">
        <span class="net-stat-label">Download</span>
        <span class="net-stat-value">{fmtRate(net.rx)}</span>
      </div>
    </div>
    <div class="net-stat">
      <span class="net-icon tx"><Icon name="arrowUp" size="13px" /></span>
      <div class="net-stat-info">
        <span class="net-stat-label">Upload</span>
        <span class="net-stat-value">{fmtRate(net.tx)}</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .net-stats {
    display: flex;
    gap: 1rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
  }

  .net-stat {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    border-radius: calc(var(--radius) - 2px);
    border: 1px solid var(--border);
  }

  .net-icon { display: flex; }
  .net-icon.rx { color: var(--series-1); }
  .net-icon.tx { color: var(--series-2); }

  .net-stat-info { display: flex; flex-direction: column; }

  .net-stat-label {
    font-size: var(--text-xs);
    color: var(--muted-foreground);

    font-weight: 500;
  }

  .net-stat-value {
    font-size: var(--text-sm);
    font-weight: 600;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    color: var(--foreground);
  }
</style>
