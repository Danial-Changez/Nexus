<script lang="ts">
  interface Props {
    options: { label: string; key?: string }[]
    value: string
    onselect: (key: string) => void
  }

  let { options, value, onselect }: Props = $props()
</script>

<div class="selector">
  {#each options as o (o.key ?? o.label)}
    {@const k = o.key ?? o.label}
    <button class="btn" class:active={value === k} onclick={() => onselect(k)}>{o.label}</button>
  {/each}
</div>

<style>
  .selector {
    display: flex;
    gap: 2px;
    background: var(--secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 3px;
  }

  .btn {
    padding: 4px 12px;
    font-size: 0.6rem;
    font-weight: 600;
    font-family: 'Geist Mono', monospace;
    color: var(--muted-foreground);
    background: transparent;
    border: none;
    border-radius: calc(var(--radius) - 3px);
    cursor: pointer;
    transition: all 150ms ease;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .btn:hover {
    color: var(--foreground);
    background: var(--muted);
  }

  .btn.active {
    color: var(--foreground);
    background: var(--bg-surface);
    box-shadow: 0 1px 3px oklch(0 0 0 / 0.3);
  }
</style>
