<script>
  export let title = '';
  export let content = '';
  export let isRevealed = false;
  export let onReveal = () => {};

  function toggleReveal() {
    isRevealed = !isRevealed;
    if (isRevealed) {
      onReveal();
    }
  }
</script>

<div class="collapsible-output">
  <div class="header">
    <h3 class="title">{title}</h3>
    <button
      on:click={toggleReveal}
      class="reveal-btn {isRevealed ? 'revealed' : ''}"
      title={isRevealed ? 'Hide' : 'Reveal'}
    >
      {#if isRevealed}
        <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
        Hide
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Reveal
      {/if}
    </button>
  </div>

  <div class="content {isRevealed ? 'revealed' : 'hidden'}">
    {#if isRevealed}
      {#if content}
        <div class="text">{content}</div>
      {:else}
        <div class="empty-state">No content available</div>
      {/if}
    {:else}
      <div class="spoiler-overlay">
        <svg xmlns="http://www.w3.org/2000/svg" class="lock-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Content hidden - click Reveal to show</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .collapsible-output {
    border: 1px solid var(--color-border-primary);
    border-radius: 8px;
    overflow: hidden;
    background: var(--color-bg-surface);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border-primary);
  }

  .title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .reveal-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: white;
    background: var(--color-btn-secondary);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .reveal-btn:hover {
    background: var(--color-btn-secondary-hover);
  }

  .reveal-btn.revealed {
    background: var(--color-accent-green);
  }

  .reveal-btn.revealed:hover {
    background: var(--color-accent-green-dark);
  }

  .icon {
    width: 1rem;
    height: 1rem;
  }

  .content {
    padding: 1rem;
    min-height: 80px;
    position: relative;
  }

  .content.hidden {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .text {
    font-size: 1rem;
    line-height: 1.6;
    color: var(--color-text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .empty-state {
    text-align: center;
    color: var(--color-text-tertiary);
    font-style: italic;
    font-size: 0.875rem;
  }

  .spoiler-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text-tertiary);
    text-align: center;
    padding: 1rem;
  }

  .lock-icon {
    width: 2rem;
    height: 2rem;
    opacity: 0.5;
  }

  .spoiler-overlay span {
    font-size: 0.875rem;
  }
</style>
