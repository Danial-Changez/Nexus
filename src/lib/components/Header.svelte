<script lang="ts">
  import type { WolConfig, WolStatus } from '../types.js'
  import Icon from './Icon.svelte'
  import PageHeader from './PageHeader.svelte'

  interface Props {
    title: string
    subtitle?: string
    wolConfig?: WolConfig | null
    wolStatus?: WolStatus | null
  }

  let { title, subtitle, wolStatus = null, wolConfig = null }: Props = $props()

  const CONFIRM_SECS = 5
  const WAKE_TIMEOUT_MS = 180_000

  let busy = $state(false)
  let feedback = $state('')
  let failed = $state(false)
  let confirmLeft = $state(0)          // >0 while shutdown awaits confirmation
  let wakingSince = $state<number | null>(null)
  let confirmTimer: ReturnType<typeof setInterval> | undefined

  let tokenDialog = $state<HTMLDialogElement | null>(null)
  let tokenInput = $state('')
  let resolveToken: ((t: string | null) => void) | null = null

  let pcOnline = $derived(wolStatus?.online ?? false)
  let name = $derived(wolConfig?.name || wolConfig?.hostname || 'Desktop')

  $effect(() => {
    if (wakingSince && pcOnline) {
      wakingSince = null
      feedback = `${name} is on`
    }
  })

  function askToken(): Promise<string | null> {
    tokenInput = ''
    tokenDialog?.showModal()
    return new Promise(resolve => resolveToken = resolve)
  }

  function closeToken(value: string | null) {
    resolveToken?.(value)
    resolveToken = null
    tokenDialog?.close()
  }

  function postAction(action: string, token: string) {
    return fetch(`/api/wol/${action}`, {
      method: 'POST',
      headers: token ? { 'X-Nexus-Token': token } : {},
    })
  }

  async function sendAction(action: 'wake' | 'shutdown') {
    busy = true
    feedback = ''
    failed = false
    try {
      let res = await postAction(action, localStorage.getItem('nexus-token') || '')
      if (res.status === 401) {
        const entered = await askToken()
        if (!entered) {
          busy = false
          feedback = 'Cancelled. Nothing was sent.'
          return
        }
        localStorage.setItem('nexus-token', entered)
        res = await postAction(action, entered)
      }
      const data = await res.json()
      if (!data.success) throw new Error(data.error || `HTTP ${res.status}`)
      if (action === 'wake') {
        wakingSince = Date.now()
        feedback = `Wake packet sent. Waiting for ${name}…`
        setTimeout(() => {
          if (wakingSince) { wakingSince = null; failed = true; feedback = `${name} didn't come online within 3 minutes. Check that Wake-on-LAN is enabled in its BIOS.` }
        }, WAKE_TIMEOUT_MS)
      } else {
        feedback = `Shutdown sent to ${name}.`
      }
    } catch (err) {
      failed = true
      feedback = `${action === 'wake' ? 'Wake' : 'Shutdown'} failed: ${err instanceof Error ? err.message : 'no response'}.`
    }
    busy = false
  }

  function cancelConfirm() {
    clearInterval(confirmTimer)
    confirmLeft = 0
  }

  function onShutdown() {
    if (confirmLeft > 0) {
      cancelConfirm()
      sendAction('shutdown')
      return
    }
    confirmLeft = CONFIRM_SECS
    feedback = ''
    confirmTimer = setInterval(() => {
      if (--confirmLeft <= 0) cancelConfirm()
    }, 1000)
  }
</script>

<PageHeader {title} {subtitle}>
  {#if wolConfig}
    <div class="wol">
    <div class="wol-section">
      <span class="wol-label">
        <Icon name="monitor" size="16px" />
        <span class="wol-name">{name}</span>
        <span class="wol-badge" class:online={pcOnline && !wakingSince} class:waking={!!wakingSince}>
          {wakingSince ? 'Waking…' : pcOnline ? 'On' : 'Off'}
        </span>
      </span>
      {#if pcOnline}
        <button class="wol-btn danger" class:armed={confirmLeft > 0} onclick={onShutdown} disabled={busy}>
          {#if busy}<span class="wol-spinner" aria-hidden="true"></span>{/if}
          {confirmLeft > 0 ? `Confirm shutdown (${confirmLeft})` : 'Shut down'}
        </button>
        {#if confirmLeft > 0}
          <button class="wol-btn" onclick={cancelConfirm}>Cancel</button>
        {/if}
      {:else}
        <button class="wol-btn" onclick={() => sendAction('wake')} disabled={busy || !!wakingSince}>
          {#if busy}<span class="wol-spinner" aria-hidden="true"></span>{/if}
          Wake
        </button>
      {/if}
    </div>
    <p class="wol-feedback" class:failed aria-live="polite">{feedback}</p>
    </div>
  {/if}
</PageHeader>

<dialog class="token-dialog" bind:this={tokenDialog} onclose={() => closeToken(null)}>
  <form method="dialog" onsubmit={e => { e.preventDefault(); closeToken(tokenInput.trim() || null) }}>
    <h2>Enter your Nexus API token</h2>
    <p>Power actions need the <code>NEXUS_API_TOKEN</code> set on the server. It's saved in this browser after the first use.</p>
    <label for="nexus-token">API token</label>
    <input id="nexus-token" name="nexus-token" type="password" bind:value={tokenInput} autocomplete="current-password" spellcheck="false" required />
    <div class="dialog-actions">
      <button type="button" class="wol-btn" onclick={() => closeToken(null)}>Cancel</button>
      <button type="submit" class="wol-btn primary">Save and continue</button>
    </div>
  </form>
</dialog>

<style>
  .wol {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.35rem;
  }

  .wol-section {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .wol-label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--muted-foreground);
  }

  .wol-name {
    font-size: var(--text-sm);
    font-weight: 500;
    white-space: nowrap;
  }

  .wol-badge {
    font-size: var(--text-xs);
    padding: 1px 8px;
    border-radius: 9999px;
    font-weight: 600;
    background: var(--muted);
    color: var(--muted-foreground);
  }

  .wol-badge.online {
    background: color-mix(in oklch, var(--ok) 14%, transparent);
    color: var(--ok);
  }

  .wol-badge.waking {
    background: color-mix(in oklch, var(--warn) 14%, transparent);
    color: var(--warn);
  }

  .wol-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.25rem;
    padding: 0 0.85rem;
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground);
    background: var(--muted);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: background-color 150ms ease, border-color 150ms ease;
  }

  .wol-btn:hover:not(:disabled) {
    background: var(--sidebar-item-hover);
    border-color: oklch(1 0 0 / 18%);
  }

  .wol-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .wol-btn.danger { color: var(--crit); }
  .wol-btn.danger.armed { background: var(--crit); color: oklch(0.15 0.01 22); border-color: transparent; }
  .wol-btn.primary { background: var(--primary); border-color: transparent; }

  .wol-feedback {
    max-width: 28rem;
    text-align: right;
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    min-height: 1em;
  }
  .wol-feedback:empty { display: none; }
  .wol-feedback.failed { color: var(--crit); }

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

  .token-dialog {
    margin: auto;
    width: min(24rem, calc(100vw - 2rem));
    padding: 1.25rem;
    background: var(--bg-surface);
    color: var(--foreground);
    border: 1px solid var(--border);
    border-radius: 0.85rem;
    box-shadow: 0 24px 60px oklch(0 0 0 / 0.55);
  }

  .token-dialog::backdrop { background: oklch(0 0 0 / 0.5); }
  .token-dialog form { display: flex; flex-direction: column; gap: 0.6rem; }
  .token-dialog h2 { font-size: var(--text-md); font-weight: 600; }
  .token-dialog p { font-size: var(--text-sm); color: var(--muted-foreground); }
  .token-dialog code { font-family: 'Geist Mono', monospace; font-size: var(--text-xs); }
  .token-dialog label { font-size: var(--text-xs); color: var(--muted-foreground); margin-top: 0.25rem; }

  .token-dialog input {
    min-height: 2.25rem;
    padding: 0 0.75rem;
    font: inherit;
    font-size: var(--text-sm);
    color: var(--foreground);
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .token-dialog input:focus-visible { border-color: var(--primary); outline: none; }
  .dialog-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }

  @media (max-width: 480px) {
    .wol-name { display: none; }
  }
</style>
