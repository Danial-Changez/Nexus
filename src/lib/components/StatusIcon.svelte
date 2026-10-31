<script lang="ts">
  // Shape carries the meaning so status never relies on color alone:
  // filled circle = up, triangle = down/problem, hollow ring = checking/idle.
  interface Props {
    status: 'up' | 'down' | 'checking' | 'idle'
    size?: number
  }

  let { status, size = 12 }: Props = $props()

  const LABELS = { up: 'Up', down: 'Down', checking: 'Checking', idle: 'Stopped' }
</script>

<svg class="status-icon {status}" width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={LABELS[status]}>
  {#if status === 'up'}
    <circle cx="8" cy="8" r="6" fill="var(--ok)" />
  {:else if status === 'down'}
    <path d="M8 1.5 15 14.5H1z" fill="var(--crit)" />
  {:else}
    <circle cx="8" cy="8" r="5" fill="none" stroke="var(--idle)" stroke-width="2" />
  {/if}
</svg>

<style>
  .status-icon { flex-shrink: 0; display: block; }
  .status-icon.checking { animation: pulse 1.5s ease-in-out infinite; }
</style>
