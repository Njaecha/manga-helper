<script>
  // Props
  export let word = '';
  export let position = { x: 0, y: 0 }; // Position relative to viewport
  export let loading = false;
  export let data = null; // Word info data from API
  export let error = null;
  export let onClose = () => {};
  export let onReload = null; // Optional reload callback

  let tooltipElement;
  let justOpened = true;

  // Reset justOpened flag after a short delay
  $: if (tooltipElement) {
    justOpened = true;
    setTimeout(() => {
      justOpened = false;
    }, 100);
  }

  // Adjust position if tooltip would overflow viewport
  $: adjustedPosition = adjustPosition(position, tooltipElement);

  function adjustPosition(pos, element) {
    if (!element) return pos;

    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = pos;

    // Adjust horizontal position if overflowing right
    if (x + rect.width > viewportWidth - 20) {
      x = viewportWidth - rect.width - 20;
    }

    // Adjust horizontal position if overflowing left
    if (x < 20) {
      x = 20;
    }

    // Adjust vertical position if overflowing bottom
    if (y + rect.height > viewportHeight - 20) {
      y = viewportHeight - rect.height - 20;
    }

    // Adjust vertical position if overflowing top
    if (y < 20) {
      y = 20;
    }

    return { x, y };
  }

  // Handle click outside to close
  function handleClickOutside(event) {
    // Don't close if tooltip just opened (prevents immediate close on opening click)
    if (justOpened) {
      return;
    }

    if (tooltipElement && !tooltipElement.contains(event.target)) {
      onClose();
    }
  }

  // Handle escape key to close
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleKeydown} />

<div
  bind:this={tooltipElement}
  class="tooltip-overlay"
  style="left: {adjustedPosition.x}px; top: {adjustedPosition.y}px;"
  role="dialog"
  aria-modal="true"
  aria-labelledby="tooltip-title"
>
  <div class="tooltip-header">
    <h3 id="tooltip-title" class="tooltip-word">{word}</h3>
    <div class="header-buttons">
      {#if onReload}
        <button class="reload-button" on:click={onReload} aria-label="Reload" title="Reload word information">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
        </button>
      {/if}
      <button class="close-button" on:click={onClose} aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>

  <div class="tooltip-content">
    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading word information...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <p class="error-message">⚠️ {error}</p>
      </div>
    {:else if data && data.info}
      <div class="word-info">
        <div class="info-section">
          <div class="info-text">{data.info}</div>
        </div>
      </div>
    {:else if data}
      <div class="word-info">
        <p class="no-data">No information available for this word.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .tooltip-overlay {
    position: fixed;
    z-index: 1000;
    background: var(--color-bg-surface, white);
    border: 2px solid var(--color-border-primary, #e5e7eb);
    border-radius: 8px;
    box-shadow: var(--shadow-lg, 0 10px 25px rgba(0, 0, 0, 0.2));
    min-width: 300px;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .tooltip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-bottom: 1px solid var(--color-border-secondary, #e5e7eb);
    background: var(--color-bg-tertiary, #f9fafb);
    border-radius: 6px 6px 0 0;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .tooltip-word {
    font-size: 1.5rem;
    font-weight: bold;
    margin: 0;
    color: var(--color-text-primary, #1f2937);
  }

  .header-buttons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .reload-button,
  .close-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    color: var(--color-text-secondary, #6b7280);
    transition: color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .reload-button:hover {
    color: var(--color-accent-blue, #3b82f6);
  }

  .close-button:hover {
    color: var(--color-text-primary, #1f2937);
  }

  .tooltip-content {
    padding: 0.25rem;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
  }

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--color-border-primary, #e5e7eb);
    border-top-color: var(--color-accent-blue, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-state p {
    color: var(--color-text-secondary, #6b7280);
    margin: 0;
  }

  .error-state {
    padding: 1rem;
  }

  .error-message {
    color: var(--color-error, #ef4444);
    margin: 0;
  }

  .word-info {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .info-section {
    margin: 0;
  }

  .info-text {
    padding: 0.25rem;
    background: var(--color-bg-tertiary, #f9fafb);
    border-radius: 6px;
    color: var(--color-text-primary, #1f2937);
    line-height: 1.6;
    font-size: 0.9375rem;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .no-data {
    color: var(--color-text-secondary, #6b7280);
    font-style: italic;
    margin: 0;
    text-align: center;
    padding: 2rem;
  }
</style>
