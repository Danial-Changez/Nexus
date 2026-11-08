<script lang="ts">
  interface Props {
    options: { label: string; key?: string }[]
    value: string
    onselect: (key: string) => void
  }

  let { options, value, onselect }: Props = $props()
</script>

<div class="selector" role="group">
  {#each options as o (o.key ?? o.label)}
    {@const k = o.key ?? o.label}
    <button class="btn" class:active={value === k} aria-pressed={value === k} onclick={() => onselect(k)}>{o.label}</button>
  {/each}
</div>

<style>
  /* Arcane segment toggle */
  .selector {
    display: flex;
    gap: 2px;
    background: var(--muted);
    border-radius: var(--radius);
    padding: 2px;
  }

  .btn {
    padding: 4px 10px;
    min-height: 28px;
    font-size: var(--text-xs);
    font-weight: 500;
    font-family: inherit;
    color: var(--muted-foreground);
    background: transparent;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    transition: color 150ms ease, background-color 150ms ease;
  }

  .btn:hover { color: var(--primary-text); }

  .btn.active {
    color: var(--primary-text);
    background: color-mix(in oklch, var(--primary) 15%, transparent);
  }
</style>
