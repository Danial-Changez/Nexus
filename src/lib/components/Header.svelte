<script lang="ts">
  import type { WolConfig, WolStatus } from '../types.js'
  import Icon from './Icon.svelte'
  import PageHeader from './PageHeader.svelte'

  interface Props {
    title: string
    subtitle: string
    onlineCount?: number
    totalHosts?: number
    wolConfig?: WolConfig | null
    wolStatus?: WolStatus | null
  }

  let { title, subtitle, onlineCount = 0, totalHosts = 0, wolStatus = null, wolConfig = null }: Props = $props()

  let busy = $state(false)
  let feedback = $state('')

  function postAction(action: string, token: string) {
    return fetch(`/api/wol/${action}`, {
      method: 'POST',
      headers: token ? { 'X-Nexus-Token': token } : {},
    })
  }

  async function sendAction(action: string) {
    busy = true
    feedback = ''
    try {
      let res = await postAction(action, localStorage.getItem('nexus-token') || '')
      if (res.status === 401) {
        const entered = prompt('Nexus API token:')
        if (entered) {
          localStorage.setItem('nexus-token', entered)
          res = await postAction(action, entered)
        }
      }
      const data = await res.json()
      feedback = data.success ? 'Sent' : (data.error || 'Failed')
    } catch {
      feedback = 'Failed'
    }
    busy = false
    setTimeout(() => feedback = '', 4000)
  }

  let pcOnline = $derived(wolStatus?.online ?? false)
</script>

<PageHeader {title} {subtitle}>
  {#if wolConfig}
    <div class="wol-section">
      <div class="wol-label">
        <span class="wol-icon"><Icon name="monitor" size="16px" /></span>
        <span class="wol-name">{wolConfig.name || wolConfig.hostname}</span>
        <span class="wol-badge" class:online={pcOnline} class:offline={!pcOnline}>
          {pcOnline ? 'On' : 'Off'}
        </span>
      </div>
      <div class="wol-btn-wrap">
        {#if pcOnline}
          <button class="wol-btn" onclick={() => sendAction('shutdown')} disabled={busy} title="Shutdown via SSH">
            {#if busy}
              <span class="wol-spinner"></span>
            {:else}
              <span class="wol-btn-icon shutdown"><Icon name="power" size="14px" /></span>
            {/if}
          </button>
        {:else}
          <button class="wol-btn" onclick={() => sendAction('wake')} disabled={busy} title="Wake-on-LAN">
            {#if busy}
              <span class="wol-spinner"></span>
            {:else}
              <span class="wol-btn-icon"><Icon name="power" size="14px" /></span>
            {/if}
          </button>
        {/if}
        {#if feedback}
          <span class="wol-feedback">{feedback}</span>
        {/if}
      </div>
    </div>
    <div class="page-divider"></div>
  {/if}
  <div class="page-stat">
    <div class="page-stat-value online">{onlineCount}</div>
    <div class="page-stat-label">Online</div>
  </div>
  <div class="page-divider"></div>
  <div class="page-stat">
    <div class="page-stat-value">{totalHosts}</div>
    <div class="page-stat-label">Hosts</div>
  </div>
</PageHeader>

<style>
  .page-stat-value.online { color: var(--chart-2); }

  /* ── WoL ── */
  .wol-section {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .wol-label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .wol-icon {
    display: flex;
    color: var(--muted-foreground);
    opacity: 0.7;
  }

  .wol-name {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--muted-foreground);
    white-space: nowrap;
  }

  .wol-badge {
    font-size: 0.55rem;
    padding: 1px 6px;
    border-radius: 9999px;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .wol-badge.online {
    background: color-mix(in oklch, var(--chart-2) 12%, transparent);
    color: var(--chart-2);
    border: 1px solid color-mix(in oklch, var(--chart-2) 25%, transparent);
  }

  .wol-badge.offline {
    background: color-mix(in oklch, var(--destructive) 12%, transparent);
    color: var(--destructive);
    border: 1px solid color-mix(in oklch, var(--destructive) 25%, transparent);
  }

  .wol-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--muted);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
    padding: 0;
  }

  .wol-btn:hover:not(:disabled) {
    background: var(--sidebar-item-hover);
    border-color: var(--muted-foreground);
  }

  .wol-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .wol-btn-icon {
    display: flex;
    color: var(--muted-foreground);
  }

  .wol-btn-icon.shutdown {
    color: var(--destructive);
  }

  .wol-btn-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
  }

  .wol-feedback {
    font-size: 0.5rem;
    font-weight: 500;
    color: var(--chart-2);
    font-family: 'Geist Mono', monospace;
    animation: fadeInOut 4s ease forwards;
  }

  @keyframes fadeInOut {
    0% { opacity: 0; }
    10% { opacity: 1; }
    75% { opacity: 1; }
    100% { opacity: 0; }
  }

  .wol-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--muted-foreground);
    border-top-color: var(--foreground);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 480px) {
    .wol-name { display: none; }
  }
</style>
