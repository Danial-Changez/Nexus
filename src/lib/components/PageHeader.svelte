<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    subtitle?: string
    children?: Snippet
  }

  let { title, subtitle, children }: Props = $props()
</script>

<header class="page-header">
  <div>
    <h1 class="page-title">{title}</h1>
    {#if subtitle}<p class="page-subtitle">{subtitle}</p>{/if}
  </div>
  {#if children}
    <div class="page-stats">
      {@render children()}
    </div>
  {/if}
</header>

<style>
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    margin-bottom: 1.25rem;
    min-height: 2.5rem;
  }

  .page-title {
    font-size: var(--text-xl);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.2;
    color: var(--foreground);
  }

  .page-subtitle {
    font-size: var(--text-sm);
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
  :global(.page-stat) { text-align: right; }

  :global(.page-stat-value) {
    font-size: var(--text-lg);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  :global(.page-stat-label) {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    font-weight: 500;
  }

  :global(.page-divider) {
    width: 1px;
    height: 32px;
    background: var(--border);
  }
</style>
