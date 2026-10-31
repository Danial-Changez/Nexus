<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    subtitle: string
    children?: Snippet
  }

  let { title, subtitle, children }: Props = $props()
</script>

<div class="page-header card">
  <div class="page-header-content">
    <div>
      <div class="page-title">{title}</div>
      <div class="page-subtitle">{subtitle}</div>
    </div>
    {#if children}
      <div class="page-stats">
        {@render children()}
      </div>
    {/if}
  </div>
</div>

<style>
  .page-header {
    padding: 1.5rem 2rem;
    margin-bottom: 1.5rem;
    border: 1px solid var(--border);
  }

  .page-header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .page-title {
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--foreground);
  }

  .page-subtitle {
    font-size: 0.75rem;
    font-family: 'Geist Mono', monospace;
    color: var(--muted-foreground);
    margin-top: 2px;
  }

  .page-stats {
    display: flex;
    gap: 1.5rem;
    align-items: center;
  }

  /* Baseline for slotted stat blocks; deliberately low-specificity so
     page-scoped overrides always win */
  :global(.page-stat) { text-align: center; }

  :global(.page-stat-value) {
    font-size: 1.25rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  :global(.page-stat-label) {
    font-size: 0.65rem;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 500;
  }

  :global(.page-divider) {
    width: 1px;
    height: 32px;
    background: var(--border);
  }
</style>
