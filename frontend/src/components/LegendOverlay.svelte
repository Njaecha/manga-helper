<script>
  import { showLegend } from '../lib/store.js';

  $: legendVisible = $showLegend;
</script>

<div class="legend-overlay" class:collapsed={!legendVisible}>
  {#if legendVisible}
    <div style="display: flex; align-items: center; gap: 1.5rem;">
      <div class="legend-item">
        <div class="legend-color detected"></div>
        <span>Detected</span>
      </div>
      <div class="legend-item">
        <div class="legend-color custom"></div>
        <span>Custom</span>
      </div>
      <div class="legend-item">
        <div class="legend-color selected"></div>
        <span>Selected</span>
      </div>
      <button
        class="legend-close-btn"
        on:click={() => showLegend.set(false)}
        title="Hide legend"
      >
        ✕
      </button>
    </div>
  {:else}
    <button
      class="legend-toggle-btn"
      on:click={() => showLegend.set(true)}
      title="Show legend"
    >
      Legend
    </button>
  {/if}
</div>

<style>
  /* Legend Overlay */
  .legend-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    z-index: 10;
    background-color: rgba(36, 36, 36, 0.95);
    border: 1px solid var(--color-border-primary);
    border-bottom: none;
    border-left: none;
    border-radius: 0 8px 0 0;
    padding: 0.75rem 1rem;
    transition: all 200ms ease-in-out;
    font-size: 0.75rem;
    color: var(--color-legend-text);
  }

  .legend-overlay.collapsed {
    padding: 0.5rem 0.75rem;
    cursor: pointer;
  }

  .legend-overlay.collapsed:hover {
    background-color: rgba(36, 36, 36, 1);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .legend-color {
    width: 20px;
    height: 12px;
    border: 2px solid;
    border-radius: 2px;
  }

  .legend-color.detected {
    border-color: var(--color-box-detected);
    background: rgba(239, 68, 68, var(--opacity-box-default));
  }

  .legend-color.custom {
    border-color: var(--color-box-custom);
    background: rgba(59, 130, 246, var(--opacity-box-default));
  }

  .legend-color.selected {
    border-color: var(--color-box-selected);
    background: rgba(245, 158, 11, var(--opacity-box-selected));
  }

  .legend-toggle-btn {
    background: transparent;
    border: none;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    padding: 0;
  }

  .legend-toggle-btn:hover {
    color: var(--color-text-primary);
  }

  .legend-close-btn {
    background: transparent;
    border: none;
    color: var(--color-text-secondary);
    font-size: 1rem;
    cursor: pointer;
    padding: 0 0.25rem;
    margin-left: 0.5rem;
    line-height: 1;
  }

  .legend-close-btn:hover {
    color: var(--color-text-primary);
  }
</style>
