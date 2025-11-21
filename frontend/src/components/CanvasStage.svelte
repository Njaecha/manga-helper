<script>
  import { Stage, Layer, Rect, Image as KonvaImage } from 'svelte-konva';

  export let img = null;
  export let stageWidth;
  export let stageHeight;
  export let imageScale;
  export let zoom;
  export let offset;
  export let boxes = [];
  export let selectedBoxIndex = null;
  export let drawingBox = null;
  export let drawMode = false;
  export let mousePos = null;
  export let onStageMouseDown;
  export let onStageMouseMove;
  export let onStageMouseUp;
  export let onBoxClick;

  function getBoxColor(box, index) {
    const isSelected = index === selectedBoxIndex;

    if (box.type === 'custom') {
      return isSelected ? '#10b981' : '#3b82f6';
    } else {
      return isSelected ? '#f59e0b' : '#ef4444';
    }
  }

  function getBoxOpacity(box, index) {
    return index === selectedBoxIndex ? 0.3 : 0.1;
  }
</script>

{#if img && stageWidth > 0 && stageHeight > 0}
  <Stage
    width={stageWidth}
    height={stageHeight}
    scaleX={zoom}
    scaleY={zoom}
    x={offset.x}
    y={offset.y}
    on:mousedown={onStageMouseDown}
    on:mousemove={onStageMouseMove}
    on:mouseup={onStageMouseUp}
  >
    <Layer>
      <!-- Background Image (scaled to fit) -->
      <KonvaImage
        image={img}
        scaleX={imageScale}
        scaleY={imageScale}
      />

      <!-- Rendered Boxes (detected and custom) - scaled to match image -->
      {#key selectedBoxIndex}
        {#each boxes as box, index}
          <Rect
            x={box.x * imageScale}
            y={box.y * imageScale}
            width={box.w * imageScale}
            height={box.h * imageScale}
            stroke={getBoxColor(box, index)}
            strokeWidth={index === selectedBoxIndex ? 3 : 2}
            fill={getBoxColor(box, index)}
            opacity={getBoxOpacity(box, index)}
            listening={!drawMode}
            on:click={() => onBoxClick(box, index)}
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
          height={(stageHeight - offset.y) / zoom}
          fill="rgba(255, 0, 255, 0.7)"
          listening={false}
        />
        <!-- Horizontal line -->
        <Rect
          x={0}
          y={(mousePos.y - offset.y) / zoom}
          width={(stageWidth - offset.x) / zoom}
          height={1 / zoom}
          fill="rgba(255, 0, 255, 0.7)"
          listening={false}
        />
      {/if}
    </Layer>
  </Stage>
{/if}
