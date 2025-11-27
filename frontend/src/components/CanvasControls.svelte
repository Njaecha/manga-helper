<script>
  import { showFolderInput } from '../lib/store.js';

  export let drawMode = false;
  export let onToggleDrawMode;
  export let selectedBoxIndex = null;
  export let onDeleteBox;
  export let currentImageIndex = 0;
  export let totalImages = 0;
</script>

<div class="relative flex items-center gap-3 py-1 px-4 bg-bg-surface border-b-2 border-border-primary flex-wrap">
  <!-- Left: Canvas mode controls -->
  <div class="flex items-center gap-2">
    <!-- Mode Toggle Button -->
    <button
      class="flex items-center gap-2 px-3 py-2 text-sm font-semibold border-2 rounded-md cursor-pointer transition-all duration-200 {drawMode ? 'text-[var(--color-accent-blue)] bg-[var(--color-accent-blue-light)] border-[var(--color-accent-blue)] hover:opacity-90' : 'text-text-secondary bg-bg-surface border-border-primary hover:bg-canvas-bg'}"
      on:click={onToggleDrawMode}
      title="Toggle between Select and Draw mode (D)"
    >
      {#if drawMode}
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <span>Draw</span>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <span>Select</span>
      {/if}
    </button>

    <!-- Delete Box Button -->
    {#if selectedBoxIndex !== null}
      <button
        class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-bg-surface border border-border-primary rounded-md cursor-pointer transition-all duration-200 text-red-600 border-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={onDeleteBox}
        title="Delete selected box (Backspace)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span>Delete</span>
      </button>
    {/if}
  </div>

  <!-- Center: Page indicator (absolutely positioned) -->
  <div class="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
    {#if totalImages > 0}
      <span class="text-sm font-semibold text-text-primary px-2">
        Page {currentImageIndex + 1} of {totalImages}
      </span>
    {/if}
  </div>

  <!-- Spacer to push folder button to the right -->
  <div class="flex-1"></div>

  <!-- Far Right: Folder button -->
  <button
    class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-bg-surface border border-border-primary rounded-md cursor-pointer transition-all duration-200 text-text-primary hover:bg-canvas-bg hover:border-[var(--color-accent-blue)]"
    on:click={() => showFolderInput.set(!$showFolderInput)}
    title={$showFolderInput ? 'Hide folder input' : 'Show folder input'}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
    <span>{$showFolderInput ? 'Hide' : 'Load Folder'}</span>
  </button>
</div>
