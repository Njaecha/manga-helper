<script>
  import { leftPaneWidthPercent } from '../lib/store.js';
  import { onMount, onDestroy } from 'svelte';

  let isDragging = false;
  let startX = 0;
  let startWidth = 0;
  let windowWidth = 0;

  // Get current width percentage
  $: currentWidth = $leftPaneWidthPercent;

  // Update window width on mount and resize
  onMount(() => {
    windowWidth = window.innerWidth;
    window.addEventListener('resize', handleWindowResize);
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleWindowResize);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  });

  function handleWindowResize() {
    windowWidth = window.innerWidth;
  }

  function handleMouseDown(e) {
    isDragging = true;
    startX = e.clientX;
    startWidth = currentWidth;

    // Add global listeners for drag
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection during drag
    e.preventDefault();
  }

  function handleMouseMove(e) {
    if (!isDragging) return;

    // Calculate delta in pixels
    const deltaX = e.clientX - startX;

    // Convert delta to percentage change
    const deltaPercent = (deltaX / windowWidth) * 100;

    // Calculate new width percentage
    let newWidth = startWidth + deltaPercent;

    // Constrain between 30% and 80%
    newWidth = Math.max(30, Math.min(80, newWidth));

    // Update store
    leftPaneWidthPercent.set(newWidth);
  }

  function handleMouseUp(e) {
    if (!isDragging) return;

    isDragging = false;

    // Remove global listeners
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }

  function handleDoubleClick() {
    // Reset to default width (66.67%)
    leftPaneWidthPercent.set(66.67);
  }
</script>

<div
  class="panel-separator"
  class:dragging={isDragging}
  on:mousedown={handleMouseDown}
  on:dblclick={handleDoubleClick}
  role="separator"
  aria-orientation="vertical"
  aria-label="Resize panels"
  title="Drag to resize panels (double-click to reset)"
>
  <div class="separator-handle">
    <div class="handle-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  </div>
</div>

<style>
  .panel-separator {
    width: 6px;
    background: var(--color-border-primary);
    cursor: col-resize;
    position: relative;
    flex-shrink: 0;
    transition: background-color 0.2s;
    user-select: none;
    z-index: 100;
  }

  .panel-separator:hover {
    background: var(--color-accent-blue);
  }

  .panel-separator.dragging {
    background: var(--color-accent-blue);
  }

  .separator-handle {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .handle-dots {
    display: flex;
    flex-direction: column;
    gap: 3px;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .panel-separator:hover .handle-dots,
  .panel-separator.dragging .handle-dots {
    opacity: 1;
  }

  .handle-dots span {
    width: 2px;
    height: 2px;
    background: white;
    border-radius: 50%;
    display: block;
  }

  /* Increase hit area for easier dragging */
  .panel-separator::before {
    content: '';
    position: absolute;
    top: 0;
    left: -4px;
    right: -4px;
    bottom: 0;
    cursor: col-resize;
  }

  /* Prevent text selection during drag */
  .panel-separator.dragging {
    cursor: col-resize !important;
  }

  :global(body.dragging) {
    cursor: col-resize !important;
    user-select: none !important;
  }
</style>
