<script>
  import { onMount } from 'svelte';
  import {
    currentImage,
    folderPath,
    allBoxes,
    selectedBoxIndex,
    selectedBoxIndices,
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
    imageList,
    currentImageIndex,
    nextImage,
    prevImage
  } from '../lib/store.js';
  import { getImageUrl } from '../lib/api.js';
  import { BoxDrawer } from '../lib/canvasUtils.js';
  import CanvasControls from './CanvasControls.svelte';
  import CanvasStage from './CanvasStage.svelte';
  import NavigationOverlay from './NavigationOverlay.svelte';
  import ZoomControls from './ZoomControls.svelte';
  import LegendOverlay from './LegendOverlay.svelte';

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
  $: selectedIndices = $selectedBoxIndices;
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
          // Check if Shift key is held for multi-selection
          const isMultiSelect = e.evt.shiftKey;
          handleBoxClick(boxes[clickedBoxIndex], clickedBoxIndex, isMultiSelect);
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

  function handleBoxClick(box, index, isMultiSelect = false) {
    console.log('Box clicked! Index:', index, 'DrawMode:', drawMode, 'Multi:', isMultiSelect);
    if (drawMode) {
      console.log('In draw mode, ignoring click');
      return; // Don't select in draw mode
    }

    console.log('Calling selectBox with:', box, index, isMultiSelect);
    selectBox(box, index, isMultiSelect);
    console.log('Selection updated');
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
  <!-- Controls Bar -->
  <CanvasControls
    drawMode={drawMode}
    onToggleDrawMode={toggleDrawingMode}
    selectedBoxIndex={selected}
    onDeleteBox={deleteSelectedBox}
    currentImageIndex={currentIndex}
    totalImages={images.length}
  />

  <div class="stage-wrapper" on:wheel={handleWheel}>
    <!-- Separate container for stage dimensions (overlays won't affect this) -->
    <div class="stage-container" bind:this={stageContainer}>
      {#if canRenderStage}
        {#key imageName}
          <CanvasStage
            {img}
            stageWidth={actualStageWidth}
            stageHeight={actualStageHeight}
            {imageScale}
            {zoom}
            {offset}
            {boxes}
            selectedBoxIndex={selected}
            {selectedIndices}
            {drawingBox}
            {drawMode}
            {mousePos}
            onStageMouseDown={handleStageMouseDown}
            onStageMouseMove={handleStageMouseMove}
            onStageMouseUp={handleStageMouseUp}
            onBoxClick={handleBoxClick}
          />
        {/key}
      {/if}
    </div>

    <!-- Navigation Overlay Buttons -->
    {#if canRenderStage}
      <NavigationOverlay
        {canGoPrev}
        {canGoNext}
        onPrevious={prevImage}
        onNext={nextImage}
      />

      <!-- Zoom Controls -->
      <ZoomControls
        {zoom}
        {showZoomBadge}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={resetView}
      />

      <!-- Legend -->
      <LegendOverlay />
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
