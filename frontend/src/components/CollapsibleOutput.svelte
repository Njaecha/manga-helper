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

<div class="border border-border-primary rounded-lg overflow-hidden bg-bg-surface">
  <div class="flex items-center justify-between px-4 py-3 bg-bg-tertiary border-b border-border-primary">
    <h3 class="text-sm font-semibold text-text-secondary m-0">{title}</h3>
    <button
      on:click={toggleReveal}
      class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white border-none rounded cursor-pointer transition-colors duration-200 {isRevealed ? 'bg-[var(--color-accent-green)] hover:bg-[var(--color-accent-green-dark)]' : 'bg-button-secondary hover:bg-button-secondary-hover'}"
      title={isRevealed ? 'Hide' : 'Reveal'}
    >
      {#if isRevealed}
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
        Hide
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Reveal
      {/if}
    </button>
  </div>

  <div class="p-4 min-h-[80px] relative {isRevealed ? '' : 'flex items-center justify-center'}">
    {#if isRevealed}
      {#if content}
        <div class="text-base leading-relaxed text-text-primary whitespace-pre-wrap break-words">{content}</div>
      {:else}
        <div class="text-center text-text-tertiary italic text-sm">No content available</div>
      {/if}
    {:else}
      <div class="flex flex-col items-center gap-2 text-text-tertiary text-center p-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span class="text-sm">Content hidden - click Reveal to show</span>
      </div>
    {/if}
  </div>
</div>
