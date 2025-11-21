<script>
  import { Stage, Layer, Rect, Image as KonvaImage } from 'svelte-konva';
  import { onMount } from 'svelte';
  import {
    currentImage,
    folderPath,
    allBoxes,
    selectedBoxIndex,
    isDrawingMode,
    addCustomBox,
    selectBox,
    toggleDrawingMode,
    canvasScale,
    canvasOffset,
    zoomIn,
    zoomOut,
    detectedBoxes,
    customBoxes,
    showLegend,
    showFolderInput,
    imageList,
    currentImageIndex,
    nextImage,
    prevImage
  } from './store.js';
  import { getImageUrl } from './api.js';
  import { BoxDrawer } from './canvasUtils.js';

  let img = null;
  let stageWidth = 1200;
  let stageHeight = 1600;
  let imageScale = 1;
  let drawer = new BoxDrawer();
  let drawingBox = null;
  let stageContainer;
  let konvaStage = null;
  let listenersSetup = false;

  // Pan state
  let isPanning = false;
  let panStartPos = null;
  let panStartOffset = null;

  // Mouse position for crosshair
  let mousePos = null;

  // Zoom badge visibility
  let showZoomBadge = false;
  let zoomBadgeTimeout = null;

  // Update stage dimensions based on container size
  function updateStageDimensions() {
    if (stageContainer) {
      const rect = stageContainer.getBoundingClientRect();
      // Use full width and height of container
      const newWidth = Math.max(rect.width, 100);
      const newHeight = Math.max(rect.height, 100);

      // Only update if dimensions actually changed
      if (newWidth !== stageWidth || newHeight !== stageHeight) {
        stageWidth = newWidth;
        stageHeight = newHeight;
        console.log('Canvas dimensions updated:', stageWidth, 'x', stageHeight);
      }
    }
  }

  // Ensure stage dimensions are always valid
  $: actualStageWidth = Math.max(stageWidth || 1200, 100);
  $: actualStageHeight = Math.max(stageHeight || 1600, 100);

  // Calculate scale to fit image within stage
  $: if (img) {
    const scaleX = actualStageWidth / img.width;
    const scaleY = actualStageHeight / img.height;
    // Use smaller scale to ensure entire image fits, don't upscale
    imageScale = Math.min(scaleX, scaleY, 1);

    // Auto-center image when it loads
    centerImage();
  } else {
    imageScale = 1;
  }

  // Function to center the image in the stage
  function centerImage() {
    if (!img) return;

    const scaledWidth = img.width * imageScale;
    const scaledHeight = img.height * imageScale;

    // Calculate offset to center the image
    const offsetX = (actualStageWidth - scaledWidth) / 2;
    const offsetY = (actualStageHeight - scaledHeight) / 2;

    canvasOffset.set({ x: offsetX, y: offsetY });
  }

  // Local reset function that centers the image
  function resetView() {
    canvasScale.set(1.0);
    centerImage();
    showZoomBadgeTemporarily();
  }

  // Show zoom badge temporarily
  function showZoomBadgeTemporarily() {
    showZoomBadge = true;

    // Clear existing timeout
    if (zoomBadgeTimeout) {
      clearTimeout(zoomBadgeTimeout);
    }

    // Hide after 1.5 seconds
    zoomBadgeTimeout = setTimeout(() => {
      showZoomBadge = false;
    }, 1500);
  }

  // Wrapped zoom functions that show badge
  function handleZoomIn() {
    zoomIn();
    showZoomBadgeTemporarily();
  }

  function handleZoomOut() {
    zoomOut();
    showZoomBadgeTemporarily();
  }

  // Subscribe to zoom and pan stores
  $: zoom = $canvasScale;
  $: offset = $canvasOffset;

  // Only show stage when we have valid image and dimensions
  $: canRenderStage = img !== null && actualStageWidth > 0 && actualStageHeight > 0;

  // Subscribe to stores
  $: imageName = $currentImage;
  $: imagePath = imageName ? getImageUrl($folderPath, imageName) : null;
  $: boxes = $allBoxes;
  $: drawMode = $isDrawingMode;
  $: selected = $selectedBoxIndex;
  $: legendVisible = $showLegend;
  $: images = $imageList;
  $: currentIndex = $currentImageIndex;

  // Navigation state
  $: canGoPrev = currentIndex > 0;
  $: canGoNext = currentIndex < images.length - 1;

  // Load image when path changes
  $: if (imagePath) {
    loadImage(imagePath);
  }

  // Set up Konva event listeners when stage container is available
  $: if (stageContainer && canRenderStage && !listenersSetup) {
    // Wait for Konva to render, then find the stage
    setTimeout(() => {
      const canvas = stageContainer.querySelector('canvas');
      if (canvas && canvas.getContext && !listenersSetup) {
        // Try to get the Konva stage from the canvas
        // @ts-ignore - Konva is added to window by the library
        if (window.Konva && window.Konva.stages) {
          // @ts-ignore - Konva is added to window by the library
          const stages = window.Konva.stages;
          if (stages && stages.length > 0) {
            konvaStage = stages[stages.length - 1];
            setupKonvaListeners();
            listenersSetup = true;
          }
        }
      }
    }, 100);
  }

  // Reset listeners flag when image changes
  $: if (imageName) {
    listenersSetup = false;
  }

  function setupKonvaListeners() {
    if (!konvaStage) return;

    // Remove any existing listeners first
    konvaStage.off('mousedown touchstart');
    konvaStage.off('mousemove touchmove');
    konvaStage.off('mouseup touchend');
    konvaStage.off('click');

    // Add new listeners
    konvaStage.on('mousedown touchstart', (e) => {
      console.log('Konva mousedown on:', e.target.getClassName());
      handleStageMouseDown({ target: e.target });
    });

    konvaStage.on('mousemove touchmove', (e) => {
      handleStageMouseMove({ target: e.target });
    });

    konvaStage.on('mouseup touchend', (e) => {
      handleStageMouseUp({ target: e.target });
    });

    konvaStage.on('click', (e) => {
      console.log('Konva click event on:', e.target.getClassName());

      // Handle box clicks using Konva's native event system
      if (e.target.getClassName() === 'Rect') {
        // Get the rect's attrs to find which box it is
        const rectAttrs = e.target.attrs;
        console.log('Rect attrs:', rectAttrs);

        // Find which box this rect corresponds to by matching coordinates
        const clickedBoxIndex = boxes.findIndex(box => {
          const scaledX = box.x * imageScale;
          const scaledY = box.y * imageScale;
          const scaledW = box.w * imageScale;
          const scaledH = box.h * imageScale;

          // Check if this box's coordinates match the rect's
          return Math.abs(rectAttrs.x - scaledX) < 1 &&
                 Math.abs(rectAttrs.y - scaledY) < 1 &&
                 Math.abs(rectAttrs.width - scaledW) < 1 &&
                 Math.abs(rectAttrs.height - scaledH) < 1;
        });

        if (clickedBoxIndex !== -1) {
          console.log('Found matching box at index:', clickedBoxIndex);
          handleBoxClick(boxes[clickedBoxIndex], clickedBoxIndex);
        }
      }
    });
  }

  function loadImage(path) {
    const imageObj = new window.Image();
    // Only set crossOrigin for external URLs, not for same-origin requests
    if (!path.includes(window.location.host)) {
      imageObj.crossOrigin = 'Anonymous';
    }
    imageObj.src = path;
    imageObj.onload = () => {
      img = imageObj;
    };
    imageObj.onerror = (e) => {
      console.error('Failed to load image:', path, e);
      img = null;
      imageScale = 1;
    };
  }

  function handleStageMouseDown(e) {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

    // Check if clicking on background (Stage or Image) vs a box
    const targetClass = e.target.getClassName();
    const isBackground = targetClass === 'Stage' || targetClass === 'Image';

    if (drawMode) {
      // In draw mode, start drawing
      // Convert screen coordinates to image coordinates (accounting for zoom and pan)
      const unscaledPos = {
        x: (pos.x - offset.x) / (imageScale * zoom),
        y: (pos.y - offset.y) / (imageScale * zoom)
      };

      drawer.startDrawing(unscaledPos);
      drawingBox = drawer.getCurrentBox();
    } else if (isBackground) {
      // In select mode, clicking background starts panning
      isPanning = true;
      panStartPos = pos;
      panStartOffset = { ...offset };
    }
  }

  function handleStageMouseMove(e) {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

    // Update mouse position for crosshair
    if (drawMode) {
      mousePos = pos;
    }

    // Handle drawing
    if (drawMode && drawer.isDrawing) {
      // Convert screen coordinates to image coordinates (accounting for zoom and pan)
      const unscaledPos = {
        x: (pos.x - offset.x) / (imageScale * zoom),
        y: (pos.y - offset.y) / (imageScale * zoom)
      };

      drawingBox = drawer.updateDrawing(unscaledPos);
    }

    // Handle panning
    if (isPanning && panStartPos && panStartOffset) {
      const deltaX = pos.x - panStartPos.x;
      const deltaY = pos.y - panStartPos.y;

      canvasOffset.set({
        x: panStartOffset.x + deltaX,
        y: panStartOffset.y + deltaY
      });
    }
  }

  function handleStageMouseUp(e) {
    // End panning
    if (isPanning) {
      isPanning = false;
      panStartPos = null;
      panStartOffset = null;
    }

    // End drawing
    if (drawMode && drawer.isDrawing) {
      const box = drawer.finishDrawing();

      if (box) {
        // Box coordinates are already in original image space
        addCustomBox(box);
      }

      drawingBox = null;
    }
  }

  function handleBoxClick(box, index) {
    console.log('Box clicked! Index:', index, 'DrawMode:', drawMode);
    if (drawMode) {
      console.log('In draw mode, ignoring click');
      return; // Don't select in draw mode
    }

    console.log('Calling selectBox with:', box, index);
    selectBox(box, index);
    console.log('Box should now be selected');
  }

  function getBoxColor(box, index) {
    const isSelected = index === selected;

    if (box.type === 'custom') {
      return isSelected ? '#10b981' : '#3b82f6';
    } else {
      return isSelected ? '#f59e0b' : '#ef4444';
    }
  }

  function getBoxOpacity(box, index) {
    return index === selected ? 0.3 : 0.1;
  }

  function handleKeyDown(event) {
    // Don't trigger if user is typing in an input
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return;
    }

    // Toggle drawing mode with 'D' key
    if (event.key === 'd' || event.key === 'D') {
      event.preventDefault();
      toggleDrawingMode();
    }

    // Cancel drawing with Escape
    if (event.key === 'Escape' && drawMode && drawer.isDrawing) {
      drawer.cancelDrawing();
      drawingBox = null;
    }

    // Delete selected box with Backspace
    if (event.key === 'Backspace' && selected !== null) {
      event.preventDefault();
      deleteSelectedBox();
    }
  }

  function handleWheel(event) {
    event.preventDefault();

    // Get mouse position relative to stage
    const stage = konvaStage;
    if (!stage) return;

    const oldScale = zoom;
    const pointer = stage.getPointerPosition();

    // Zoom in or out based on wheel delta
    const zoomDelta = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.25, Math.min(4.0, oldScale * zoomDelta));

    // Calculate new offset to zoom toward mouse position
    const mousePointTo = {
      x: (pointer.x - offset.x) / oldScale,
      y: (pointer.y - offset.y) / oldScale
    };

    const newOffset = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    };

    canvasScale.set(newScale);
    canvasOffset.set(newOffset);
    showZoomBadgeTemporarily();
  }

  function deleteSelectedBox() {
    if (selected === null) return;

    const selectedBoxData = boxes[selected];
    if (!selectedBoxData) return;

    if (selectedBoxData.type === 'custom') {
      // Find index in customBoxes array
      const customIndex = $customBoxes.findIndex(box =>
        box.x === selectedBoxData.x &&
        box.y === selectedBoxData.y &&
        box.w === selectedBoxData.w &&
        box.h === selectedBoxData.h
      );
      if (customIndex !== -1) {
        customBoxes.update(boxes => boxes.filter((_, i) => i !== customIndex));
      }
    } else if (selectedBoxData.type === 'detected') {
      // Find index in detectedBoxes array
      const detectedIndex = $detectedBoxes.findIndex(box =>
        box.x === selectedBoxData.x &&
        box.y === selectedBoxData.y &&
        box.w === selectedBoxData.w &&
        box.h === selectedBoxData.h
      );
      if (detectedIndex !== -1) {
        detectedBoxes.update(boxes => boxes.filter((_, i) => i !== detectedIndex));
      }
    }

    // Clear selection
    selectBox(null, null);
  }

  onMount(() => {
    // Set initial dimensions with a slight delay to ensure DOM is ready
    setTimeout(updateStageDimensions, 50);

    // Use ResizeObserver for more accurate container size tracking
    let resizeObserver;
    if (stageContainer && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        updateStageDimensions();
      });
      resizeObserver.observe(stageContainer);
    }

    // Also listen to window resize as fallback
    const handleResize = () => {
      updateStageDimensions();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      img = null;
      if (konvaStage) {
        konvaStage.off('mousedown touchstart');
        konvaStage.off('mousemove touchmove');
        konvaStage.off('mouseup touchend');
        konvaStage.off('click');
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', handleResize);
    };
  });
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="canvas-container">
  <!-- Controls Bar (mode controls on left, page indicator in center, zoom + folder button on right) -->
  <div class="controls-bar">
    <!-- Left: Canvas mode controls -->
    <div class="control-group">
      <!-- Mode Toggle Button -->
      <button
        class="mode-toggle-btn {drawMode ? 'draw-mode' : 'select-mode'}"
        on:click={toggleDrawingMode}
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
      {#if selected !== null}
        <button
          class="control-btn delete-btn"
          on:click={deleteSelectedBox}
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
      {#if images.length > 0}
        <span class="page-indicator">
          Page {currentIndex + 1} of {images.length}
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

  <div class="stage-wrapper" on:wheel={handleWheel}>
    <!-- Separate container for stage dimensions (overlays won't affect this) -->
    <div class="stage-container" bind:this={stageContainer}>
      {#if canRenderStage}
        {#key imageName}
          <Stage
            width={actualStageWidth}
            height={actualStageHeight}
            scaleX={zoom}
            scaleY={zoom}
            x={offset.x}
            y={offset.y}
            on:mousedown={handleStageMouseDown}
            on:mousemove={handleStageMouseMove}
            on:mouseup={handleStageMouseUp}
            on:click={() => console.log('Stage clicked!')}
          >
          <Layer>
            <!-- Background Image (scaled to fit) -->
            <KonvaImage
              image={img}
              scaleX={imageScale}
              scaleY={imageScale}
            />

          <!-- Rendered Boxes (detected and custom) - scaled to match image -->
          {#key selected}
            {#each boxes as box, index}
              <Rect
                x={box.x * imageScale}
                y={box.y * imageScale}
                width={box.w * imageScale}
                height={box.h * imageScale}
                stroke={getBoxColor(box, index)}
                strokeWidth={index === selected ? 3 : 2}
                fill={getBoxColor(box, index)}
                opacity={getBoxOpacity(box, index)}
                listening={!drawMode}
                on:click={() => handleBoxClick(box, index)}
              />
            {/each}
          {/key}

          <!-- Drawing Preview Box - scaled to match image -->
          {#if drawingBox && drawMode}
            <Rect
              x={drawingBox.x * imageScale}
              y={drawingBox.y * imageScale}
              width={drawingBox.w * imageScale}
              height={drawingBox.h * imageScale}
              stroke="#3b82f6"
              strokeWidth={2}
              dash={[5, 5]}
              fill="#3b82f6"
              opacity={0.2}
              listening={false}
            />
          {/if}

          <!-- Crosshair lines in draw mode -->
          {#if drawMode && mousePos}
            <!-- Vertical line -->
            <Rect
              x={(mousePos.x - offset.x) / zoom}
              y={0}
              width={1 / zoom}
              height={(actualStageHeight - offset.y) / zoom}
              fill="rgba(255, 0, 255, 0.7)"
              listening={false}
            />
            <!-- Horizontal line -->
            <Rect
              x={0}
              y={(mousePos.y - offset.y) / zoom}
              width={(actualStageWidth - offset.x) / zoom}
              height={1 / zoom}
              fill="rgba(255, 0, 255, 0.7)"
              listening={false}
            />
          {/if}
        </Layer>
      </Stage>
      {/key}
      {/if}
    </div>

    <!-- Navigation Overlay Buttons (outside stage-container, positioned absolutely within stage-wrapper) -->
    {#if canRenderStage}
      <button
        class="nav-overlay-button left"
        class:disabled={!canGoPrev}
        disabled={!canGoPrev}
        on:click={prevImage}
        title="Previous page (←)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        class="nav-overlay-button right"
        class:disabled={!canGoNext}
        disabled={!canGoNext}
        on:click={nextImage}
        title="Next page (→)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <!-- Zoom Level Badge (top-left, temporary display) -->
      <div class="{showZoomBadge ? 'zoom-level-badge': 'zoom-level-badge-hidden'}">
          {Math.round(zoom * 100)}%
      </div>

      <!-- Zoom Controls Overlay (top-right corner) -->
      <div class="zoom-overlay-container">
        <button
          class="zoom-overlay-button"
          on:click={handleZoomIn}
          title="Zoom in"
          disabled={zoom >= 4.0}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </button>
        <button
          class="zoom-overlay-button"
          on:click={handleZoomOut}
          title="Zoom out"
          disabled={zoom <= 0.25}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>
        <button
          class="zoom-overlay-button"
          on:click={resetView}
          title="Reset zoom and center image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <!-- Collapsible Legend Overlay -->
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
    {/if}
  </div>

  {#if imageName && !canRenderStage}
    <div class="loading-state">
      <svg class="animate-spin spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p>Loading image...</p>
    </div>
  {/if}

  {#if !imageName}
    <div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p>No image loaded</p>
      <p class="hint">Load a manga folder to begin</p>
    </div>
  {/if}
</div>

<style>
  .canvas-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-canvas-bg);
  }

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

  .icon {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }

  .stage-wrapper {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  /* Stage container - takes full dimensions for proper centering calculation */
  .stage-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Note: pointer-events must remain auto for canvas interaction */
  }

  /* Legend Overlay (replaces bottom legend bar) */
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

  /* Navigation Overlay Buttons */
  .nav-overlay-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.3);
    padding: 1rem 0.75rem;
    cursor: pointer;
    opacity: 0.4;
    transition: opacity 200ms ease-in-out, background-color 200ms ease-in-out;
    user-select: none;
  }

  .nav-overlay-button:hover:not(:disabled) {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.8);
  }

  .nav-overlay-button:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }

  .nav-overlay-button.left {
    left: 0;
    border-radius: 0 4px 4px 0;
    border-left: none;
  }

  .nav-overlay-button.right {
    right: 0;
    border-radius: 4px 0 0 4px;
    border-right: none;
  }

  .loading-state,
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--color-canvas-empty);
  }

  .spinner {
    width: 3rem;
    height: 3rem;
    color: var(--color-accent-blue);
  }

  .empty-icon {
    width: 4rem;
    height: 4rem;
    opacity: 0.5;
  }

  .loading-state p,
  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  .hint {
    color: var(--color-text-hint);
    font-size: 0.75rem;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>
