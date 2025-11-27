<script>
// @ts-nocheck

  import { Stage, Layer, Rect, Image as KonvaImage, Text } from 'svelte-konva';

  export let img = null;
  export let stageWidth;
  export let stageHeight;
  export let imageScale;
  export let zoom;
  export let offset;
  export let boxes = [];
  export let selectedBoxIndex = null;
  export let selectedIndices = [];
  export let drawingBox = null;
  export let drawMode = false;
  export let mousePos = null;
  export let onStageMouseDown;
  export let onStageMouseMove;
  export let onStageMouseUp;
  export let onBoxClick;

  function getBoxColor(box, index) {
    const isSelected = selectedIndices.includes(index);

    if (box.type === 'custom') {
      return isSelected ? '#10b981' : '#3b82f6';
    } else {
      return isSelected ? '#f59e0b' : '#ef4444';
    }
  }

  function darkenHex(hex, amount = 0.5) {
  // Strip "#" if present
  hex = hex.replace(/^#/, "");

  // Parse the R, G, B values
  const num = parseInt(hex, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;

  // Lerp toward black (0)
  r = Math.round(r * (1 - amount));
  g = Math.round(g * (1 - amount));
  b = Math.round(b * (1 - amount));

  // Rebuild hex with leading zeros
  return (
    "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
}


  function getBoxOpacity(box, index) {
    return selectedIndices.includes(index) ? 0.3 : 0.1;
  }

  function getStrokeWidth(index) {
    return selectedIndices.includes(index) ? 3 : 2;
  }

  function getSelectionOrder(index) {
    return selectedIndices.indexOf(index);
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
      {#key selectedIndices}
        {#each boxes as box, index}
          <Rect
            x={box.x * imageScale}
            y={box.y * imageScale}
            width={box.w * imageScale}
            height={box.h * imageScale}
            stroke={getBoxColor(box, index)}
            strokeWidth={getStrokeWidth(index)}
            fill={getBoxColor(box, index)}
            opacity={getBoxOpacity(box, index)}
            listening={!drawMode}
            on:click={() => onBoxClick(box, index)}
          />

          <!-- Selection order badge for selected boxes -->
          {#if selectedIndices.includes(index)}
            {@const orderIndex = getSelectionOrder(index)}
            {@const badgeSize = 20}
            {@const badgePadding = 4}

            <!--
              <Rect
              x={box.x * imageScale + 2 }
              y={box.y * imageScale + 2 }
              width={badgeSize}
              height={badgeSize}
              fill={getBoxColor(box, index)}
              opacity={0.5}
              />
            -->
              
            <!-- Badge number -->
            <Text
              text={String(orderIndex + 1)}
              x={box.x * imageScale + 2 + badgeSize / 2}
              y={box.y * imageScale + 2 + badgeSize / 2}
              fontSize={12}
              fontStyle="bold"
              fill={getBoxColor(box, index)}
              opacity={1}
              align="center"
              verticalAlign="middle"
              offsetX={9}
              offsetY={9}
              listening={false}
              stroke={darkenHex(getBoxColor(box, index))}
              strokeWidth={0.5}
            />
          {/if}
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
