<script>
  import { showFolderInput } from '../lib/store.js';

  export let drawMode = false;
  export let onToggleDrawMode;
  export let selectedBoxIndex = null;
  export let onDeleteBox;
  export let currentImageIndex = 0;
  export let totalImages = 0;
</script>

<div class="controls-bar">
  <!-- Left: Canvas mode controls -->
  <div class="control-group">
    <!-- Mode Toggle Button -->
    <button
      class="mode-toggle-btn {drawMode ? 'draw-mode' : 'select-mode'}"
      on:click={onToggleDrawMode}
      title="Toggle between Select and Draw mode (D)"
    >
      {#if drawMode}
        <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <span>Draw</span>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <span>Select</span>
      {/if}
    </button>

    <!-- Delete Box Button -->
    {#if selectedBoxIndex !== null}
      <button
        class="control-btn delete-btn"
        on:click={onDeleteBox}
        title="Delete selected box (Backspace)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span>Delete</span>
      </button>
    {/if}
  </div>

  <!-- Center: Page indicator (absolutely positioned) -->
  <div class="controls-center">
    {#if totalImages > 0}
      <span class="page-indicator">
        Page {currentImageIndex + 1} of {totalImages}
      </span>
    {/if}
  </div>

  <!-- Spacer to push folder button to the right -->
  <div style="flex: 1;"></div>

  <!-- Far Right: Folder button -->
  <button
    class="collapse-button"
    on:click={() => showFolderInput.set(!$showFolderInput)}
    title={$showFolderInput ? 'Hide folder input' : 'Show folder input'}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
    <span>{$showFolderInput ? 'Hide' : 'Load Folder'}</span>
  </button>
</div>

<style>
  .controls-bar {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.25rem 1rem;
    background: var(--color-bg-surface);
    border-bottom: 2px solid var(--color-border-primary);
    flex-wrap: wrap;
  }

  .controls-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .page-indicator {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
    padding: 0 0.5rem;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .mode-toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 600;
    border: 2px solid;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mode-toggle-btn.select-mode {
    color: var(--color-text-secondary);
    background: var(--color-bg-surface);
    border-color: var(--color-border-primary);
  }

  .mode-toggle-btn.select-mode:hover {
    background: var(--color-canvas-bg);
  }

  .mode-toggle-btn.draw-mode {
    color: var(--color-accent-blue);
    background: var(--color-accent-blue-light);
    border-color: var(--color-accent-blue);
  }

  .mode-toggle-btn.draw-mode:hover {
    opacity: 0.9;
  }

  .control-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-primary);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--color-text-primary);
  }

  .control-btn:hover:not(:disabled) {
    background: var(--color-canvas-bg);
    border-color: var(--color-accent-blue);
  }

  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .delete-btn {
    color: #dc2626;
    border-color: #dc2626;
  }

  .delete-btn:hover {
    background: #fef2f2;
    border-color: #dc2626;
  }

  .collapse-button {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-primary);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--color-text-primary);
  }

  .collapse-button:hover {
    background: var(--color-canvas-bg);
    border-color: var(--color-accent-blue);
  }

  .icon {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }
</style>
