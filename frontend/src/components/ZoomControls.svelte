<script>
  export let zoom = 1.0;
  export let showZoomBadge = false;
  export let onZoomIn;
  export let onZoomOut;
  export let onResetView;
</script>

<!-- Zoom Level Badge (top-left, temporary display) -->
<div class="{showZoomBadge ? 'zoom-level-badge': 'zoom-level-badge-hidden'}">
  {Math.round(zoom * 100)}%
</div>

<!-- Zoom Controls Overlay (top-right corner) -->
<div class="zoom-overlay-container">
  <button
    class="zoom-overlay-button"
    on:click={onZoomIn}
    title="Zoom in"
    disabled={zoom >= 4.0}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
    </svg>
  </button>
  <button
    class="zoom-overlay-button"
    on:click={onZoomOut}
    title="Zoom out"
    disabled={zoom <= 0.25}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
    </svg>
  </button>
  <button
    class="zoom-overlay-button"
    on:click={onResetView}
    title="Reset zoom and center image"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  </button>
</div>

<style>
  /* Zoom level badge in top-left corner (temporary display) */
  .zoom-level-badge {
    position: absolute;
    top: 0.75rem;
    left: 0.50rem;
    z-index: 10;
    color: white;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.5rem 0.875rem;
    user-select: none;
    background-color: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    transition: opacity 0.3s, top 0.3s;
    opacity: 0.5;
  }

  .zoom-level-badge-hidden {
    position: absolute;
    top: 0.45rem;
    left: 0.50rem;
    z-index: 10;
    color: white;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.5rem 0.875rem;
    user-select: none;
    background-color: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.3s, top 0.5s;
  }

  /* Zoom overlay controls in top-right corner */
  .zoom-overlay-container {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-end;
  }

  .zoom-overlay-button {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    cursor: pointer;
    opacity: 0.4;
    transition: opacity 200ms ease-in-out, background-color 200ms ease-in-out;
    user-select: none;
    padding: 0;
  }

  .zoom-overlay-button:hover:not(:disabled) {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.8);
  }

  .zoom-overlay-button:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }
</style>
