<script>
  import { onDestroy, onMount } from 'svelte';
  import {
    revealedTokens,
    revealToken,
    hideToken,
    revealAllOfType,
    hideAllOfType,
    revealAllTokens,
    hideAllTokens,
    folderPath,
    currentImage,
    clearWordInfoCache,
    tokenGridScale,
    selectedTokenIndices,
    selectToken,
    deselectToken,
    toggleTokenSelection,
    clearTokenSelection,
    selectTokenRange
  } from '../lib/store.js';
  import { wordInfo } from '../lib/api.js';
  import Tooltip from './Tooltip.svelte';

  export let ocrTokens = [];
  export let hiraganaTokens = [];
  export let romajiTokens = [];

  let cardWidths = [];

  // Word info tooltip state
  let activeWordTooltip = null; // { index, word, position, loading, data, error }

  // Hover preview state
  let hoverPreview = null; // { index, word, position }
  let hoverTimeout = null;

  // Token selection state
  $: selectedTokens = $selectedTokenIndices;
  let selectionStartIndex = null;
  let isSelecting = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let hasDragged = false;
  const DRAG_THRESHOLD = 5; // Minimum pixels to consider it a drag
  let copyButtonCopied = false;

  // Subscribe to store
  $: revealed = $revealedTokens;

  // Check if we have tokens
  $: hasTokens = ocrTokens.length > 0;
  $: tokenCount = ocrTokens.length;

  // Color palette for different bubbles (cycling) - using dark colors
  const bubbleColors = [
    { bg: '#1e3a8a', border: '#3b82f6', name: 'blue' },    // blue-900 / blue-500
    { bg: '#14532d', border: '#10b981', name: 'green' },   // green-900 / green-500
    { bg: '#78350f', border: '#f59e0b', name: 'yellow' },  // yellow-900 / yellow-600
    { bg: '#581c87', border: '#a855f7', name: 'purple' },  // purple-900 / purple-500
    { bg: '#831843', border: '#ec4899', name: 'pink' }     // pink-900 / pink-500
  ];

  // Get color for a bubble index
  function getBubbleColor(bubbleIndex) {
    if (bubbleIndex == null) return bubbleColors[0];
    return bubbleColors[bubbleIndex % bubbleColors.length];
  }

  // Check if token is a separator
  function isSeparator(token) {
    return token && typeof token === 'object' && token.type === 'separator';
  }

  // Get text from token (handle both string and object formats)
  function getTokenText(token) {
    if (typeof token === 'string') return token;
    if (token && typeof token === 'object' && token.text) return token.text;
    return '';
  }

  // Get bubble index from token
  function getBubbleIndex(token) {
    if (token && typeof token === 'object' && token.bubbleIndex != null) {
      return token.bubbleIndex;
    }
    return 0; // Default to first bubble for string tokens (backward compatibility)
  }

  // Auto-reveal all OCR tokens when tokens change (OCR always visible)
  $: if (ocrTokens.length > 0) {
    revealAllOfType('ocr', ocrTokens.length);
  }

  // Calculate progress for each type (OCR doesn't count since always revealed)
  $: hiraganaRevealed = Object.values(revealed).filter(t => t?.hiragana).length;
  $: romajiRevealed = Object.values(revealed).filter(t => t?.romaji).length;
  $: totalRevealed = hiraganaRevealed + romajiRevealed;
  $: totalPossible = tokenCount * 2; // Only hiragana and romaji

  // Check if all of each type is revealed
  $: allHiraganaRevealed = tokenCount > 0 && hiraganaRevealed === tokenCount;
  $: allRomajiRevealed = tokenCount > 0 && romajiRevealed === tokenCount;
  $: allRevealed = tokenCount > 0 && totalRevealed === totalPossible;

  function handleTokenClick(index, type) {
    console.log(`[TokenReveal] Box clicked - Index: ${index}, Type: ${type}`);
    console.log(`[TokenReveal] Current revealed state:`, revealed);
    console.log(`[TokenReveal] isRevealed(${index}, ${type}):`, isRevealed(index, type));

    // Toggle reveal state
    if (isRevealed(index, type)) {
      console.log(`[TokenReveal] Calling hideToken(${index}, ${type})`);
      hideToken(index, type);
    } else {
      console.log(`[TokenReveal] Calling revealToken(${index}, ${type})`);
      revealToken(index, type);
    }
  }

  function isRevealed(index, type) {
    // OCR is always revealed
    if (type === 'ocr') return true;
    return revealed[index]?.[type] || false;
  }

  // Debug: Log revealed state changes
  $: if (revealed) {
    console.log('[TokenReveal] Revealed state updated:', revealed);
  }

  function handleRevealAllType(type) {
    const isAllRevealed = type === 'hiragana' ? allHiraganaRevealed : allRomajiRevealed;

    if (isAllRevealed) {
      hideAllOfType(type, tokenCount);
    } else {
      revealAllOfType(type, tokenCount);
    }
  }

  function handleRevealAll() {
    if (allRevealed) {
      // Hide hiragana and romaji (OCR stays visible)
      hideAllOfType('hiragana', tokenCount);
      hideAllOfType('romaji', tokenCount);
    } else {
      // Reveal hiragana and romaji
      revealAllOfType('hiragana', tokenCount);
      revealAllOfType('romaji', tokenCount);
    }
  }

  // Scale control functions
  function increaseScale() {
    tokenGridScale.update(scale => Math.min(2.0, scale + 0.1));
  }

  function decreaseScale() {
    tokenGridScale.update(scale => Math.max(0.6, scale - 0.1));
  }

  function resetScale() {
    tokenGridScale.set(1.0);
  }

  // Calculate card width based on the widest of all three token types
  function calculateCardWidth(ocrText, hiraganaText, romajiText, scale) {
    const span = document.createElement('span');
    // Use em-based font size and padding to match actual rendering, then apply scale
    const baseFontSize = 0.875; // 0.875em
    const basePadding = 0.5; // 0.5em horizontal padding (0.25em left + 0.25em right = 0.5em total)
    const actualFontSize = baseFontSize * scale;
    const actualPadding = basePadding * scale;

    // Calculate in rems (assuming 1rem = 16px)
    const fontSizeRem = actualFontSize;
    const paddingRem = actualPadding;

    span.style.cssText = `position:absolute;visibility:hidden;font-size:${fontSizeRem}rem;font-weight:500;white-space:nowrap;padding:0 ${paddingRem}rem;`;

    // Measure all three texts and find the widest
    const texts = [ocrText, hiraganaText, romajiText].filter(Boolean);
    let maxWidth = 60 * scale; // minimum width scaled

    for (const text of texts) {
      span.textContent = text;
      document.body.appendChild(span);
      const width = span.offsetWidth + 8; // Add border width
      maxWidth = Math.max(maxWidth, width);
      document.body.removeChild(span);
    }

    return maxWidth;
  }

  // Recalculate card widths when tokens OR scale changes
  $: if (ocrTokens.length > 0) {
    cardWidths = ocrTokens.map((ocrToken, index) => {
      // Skip width calculation for separators
      if (isSeparator(ocrToken)) return 0;

      return calculateCardWidth(
        getTokenText(ocrToken),
        getTokenText(hiraganaTokens[index]),
        getTokenText(romajiTokens[index]),
        $tokenGridScale
      );
    });
  }

  // Handle OCR token click - fetch word info
  async function handleOcrClick(event, index, word) {
    // Check if this is a selection action (Ctrl/Cmd for toggle, Shift for range)
    if (event.ctrlKey || event.metaKey) {
      // Toggle selection
      event.preventDefault();
      event.stopPropagation();
      toggleTokenSelection(index);
      selectionStartIndex = index;
      return;
    }

    if (event.shiftKey && selectionStartIndex !== null) {
      // Range selection
      event.preventDefault();
      event.stopPropagation();
      selectTokenRange(selectionStartIndex, index);
      return;
    }

    // If clicking without modifiers and there's a selection, clear it
    if (selectedTokens.size > 0 && !selectedTokens.has(index)) {
      clearTokenSelection();
      selectionStartIndex = null;
    }

    // Stop propagation to prevent click-outside handler from firing immediately
    event.stopPropagation();

    // Hide hover preview when clicking
    hoverPreview = null;
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }

    // Close any existing tooltip
    if (activeWordTooltip) {
      activeWordTooltip = null;
      // Small delay to allow component to unmount before creating new one
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Get position relative to viewport
    const rect = event.target.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2 - 150, // Center tooltip (assuming ~300px width)
      y: rect.bottom + 10 // Position below the token
    };

    // Show tooltip in loading state
    activeWordTooltip = {
      index,
      word,
      position,
      loading: true,
      data: null,
      error: null
    };

    console.log('[TokenReveal] Created tooltip:', activeWordTooltip);

    try {
      // Get current image path
      const imagePath = `${$folderPath}\\${$currentImage}`;

      console.log('[TokenReveal] Fetching word info for:', word, 'image:', imagePath);

      // Fetch word info from API
      const data = await wordInfo(imagePath, word);

      console.log('[TokenReveal] Received word info:', data);

      // Update tooltip with data
      if (activeWordTooltip && activeWordTooltip.index === index) {
        activeWordTooltip = {
          ...activeWordTooltip,
          loading: false,
          data
        };
        console.log('[TokenReveal] Updated tooltip with data:', activeWordTooltip);
      }
    } catch (error) {
      console.error('[TokenReveal] Error fetching word info:', error);

      // Update tooltip with error
      if (activeWordTooltip && activeWordTooltip.index === index) {
        activeWordTooltip = {
          ...activeWordTooltip,
          loading: false,
          error: error.message || 'Failed to load word information'
        };
        console.log('[TokenReveal] Updated tooltip with error:', activeWordTooltip);
      }
    }
  }

  // Close word info tooltip
  function closeWordTooltip() {
    activeWordTooltip = null;
  }

  // Reload word info tooltip - clears cache and refetches
  async function reloadWordTooltip() {
    if (!activeWordTooltip) return;

    const { index, word } = activeWordTooltip;

    // Clear the cache for this word
    clearWordInfoCache(word);

    // Set loading state
    activeWordTooltip = {
      ...activeWordTooltip,
      loading: true,
      data: null,
      error: null
    };

    try {
      // Get current image path
      const imagePath = `${$folderPath}\\${$currentImage}`;

      console.log('[TokenReveal] Reloading word info for:', word);

      // Fetch word info from API (cache is now cleared, so it will fetch fresh)
      const data = await wordInfo(imagePath, word);

      console.log('[TokenReveal] Reloaded word info:', data);

      // Update tooltip with new data
      if (activeWordTooltip && activeWordTooltip.index === index) {
        activeWordTooltip = {
          ...activeWordTooltip,
          loading: false,
          data
        };
      }
    } catch (error) {
      console.error('[TokenReveal] Error reloading word info:', error);

      // Update tooltip with error
      if (activeWordTooltip && activeWordTooltip.index === index) {
        activeWordTooltip = {
          ...activeWordTooltip,
          loading: false,
          error: error.message || 'Failed to reload word information'
        };
      }
    }
  }

  // Handle hover on OCR token - show large preview
  function handleOcrHover(event, index, word) {
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }

    // Set timeout to show preview after short delay (300ms)
    hoverTimeout = setTimeout(() => {
      const rect = event.target.getBoundingClientRect();
      const position = {
        x: rect.left + rect.width / 2,
        y: rect.bottom + 5
      };

      hoverPreview = { index, word, position };
    }, 300);
  }

  // Handle mouse leave - hide preview
  function handleOcrLeave() {
    // Clear timeout if mouse leaves before preview shows
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }

    // Hide preview
    hoverPreview = null;
  }

  // Handle token mouse down for drag selection
  function handleTokenMouseDown(event, index) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      return; // Let click handler manage modified clicks
    }

    // Track starting position for drag detection
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    hasDragged = false;

    isSelecting = true;
    selectionStartIndex = index;
  }

  // Handle token mouse enter for drag selection
  function handleTokenMouseEnter(event, index) {
    if (isSelecting && selectionStartIndex !== null) {
      // Check if we've actually dragged (moved mouse enough)
      const deltaX = Math.abs(event.clientX - dragStartX);
      const deltaY = Math.abs(event.clientY - dragStartY);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance >= DRAG_THRESHOLD) {
        if (!hasDragged) {
          // First time crossing threshold, start selection
          hasDragged = true;
          clearTokenSelection();
          selectToken(selectionStartIndex);
        }
        // Continue selection
        selectTokenRange(selectionStartIndex, index);
      }
    }
  }

  // Handle token mouse up
  function handleTokenMouseUp() {
    isSelecting = false;
  }

  // Copy selected tokens to clipboard
  async function copySelectedToClipboard() {
    if (selectedTokens.size === 0) return;

    // Get selected tokens in order
    const indices = Array.from(selectedTokens).sort((a, b) => a - b);
    const selectedText = indices
      .map(idx => getTokenText(ocrTokens[idx]))
      .join('');

    try {
      await navigator.clipboard.writeText(selectedText);
      console.log('[TokenReveal] Copied to clipboard:', selectedText);

      // Show success feedback
      copyButtonCopied = true;
      setTimeout(() => {
        copyButtonCopied = false;
      }, 2000);
    } catch (error) {
      console.error('[TokenReveal] Failed to copy:', error);
      // Fallback to old method
      const textArea = document.createElement('textarea');
      textArea.value = selectedText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);

      // Show success feedback even for fallback
      copyButtonCopied = true;
      setTimeout(() => {
        copyButtonCopied = false;
      }, 2000);
    }
  }

  // Add global mouseup listener
  onMount(() => {
    const handleGlobalMouseUp = () => {
      isSelecting = false;
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  });

  // Clean up on component destroy
  onDestroy(() => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
  });
</script>

<div class="token-reveal">
  <div class="header">
    <h3 class="title">Token Analysis</h3>
    <div class="controls">
      <!-- Selection toolbar (shown when tokens selected) -->
      {#if selectedTokens.size > 0}
        <div class="selection-toolbar">
          <span class="selection-count">{selectedTokens.size} selected</span>
          <button
            on:click={copySelectedToClipboard}
            class="btn btn-copy"
            class:copied={copyButtonCopied}
            title={copyButtonCopied ? 'Copied!' : 'Copy selected tokens to clipboard'}
          >
            {#if copyButtonCopied}
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            {:else}
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            {/if}
          </button>
          <button
            on:click={() => clearTokenSelection()}
            class="btn btn-clear"
            title="Clear selection"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      {/if}

      {#if hasTokens}
        <!-- Type-specific reveal buttons -->
        <button
          on:click={() => handleRevealAllType('hiragana')}
          class="btn type-btn hiragana-btn {allHiraganaRevealed ? 'active' : ''}"
          title="{allHiraganaRevealed ? 'Hide' : 'Reveal'} all Hiragana"
        >
          Hiragana
        </button>
        <button
          on:click={() => handleRevealAllType('romaji')}
          class="btn type-btn romaji-btn {allRomajiRevealed ? 'active' : ''}"
          title="{allRomajiRevealed ? 'Hide' : 'Reveal'} all Romaji"
        >
          Romaji
        </button>

        <!-- Reveal/Hide All button -->
        {#if !allRevealed}
          <button on:click={handleRevealAll} class="btn btn-reveal-all" title="Reveal everything">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Reveal All
          </button>
        {:else}
          <button on:click={handleRevealAll} class="btn btn-hide-all" title="Hide everything">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
            Hide All
          </button>
        {/if}
      {/if}

      <!-- Scale controls -->
      <div class="scale-controls">
        <button
          on:click={decreaseScale}
          class="btn scale-btn"
          title="Decrease size"
          disabled={$tokenGridScale <= 0.6}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
          </svg>
        </button>
        <span class="scale-label">{Math.round($tokenGridScale * 100)}%</span>
        <button
          on:click={increaseScale}
          class="btn scale-btn"
          title="Increase size"
          disabled={$tokenGridScale >= 2.0}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          on:click={resetScale}
          class="btn scale-btn scale-reset"
          title="Reset to 100%"
        >
          ↻
        </button>
      </div>
    </div>
  </div>

  <div class="content">
    {#if hasTokens}

      <!-- Token cards -->
      <div class="token-grid" style="font-size: {$tokenGridScale}em;">
        {#each ocrTokens as ocrToken, index}
          {#if !isSeparator(ocrToken)}
            <!-- Token card -->
            {@const bubbleIndex = getBubbleIndex(ocrToken)}
            {@const bubbleColor = getBubbleColor(bubbleIndex)}
            {@const ocrText = getTokenText(ocrToken)}
            {@const hiraganaText = getTokenText(hiraganaTokens[index])}
            {@const romajiText = getTokenText(romajiTokens[index])}

            {#key revealed[index]}
              <div class="token-card" style="width: {cardWidths[index]}px; background-color: {bubbleColor.bg}; border: 2px solid {bubbleColor.border}20; border-radius: 6px; padding: 2px;">
                <!-- OCR Box (always visible, clickable for word info) -->
                <button
                  class="token-box ocr revealed"
                  class:selected={selectedTokens.has(index)}
                  title="{selectedTokens.has(index) ? 'Selected - ' : ''}Click for word info, Ctrl+Click to select, Shift+Click for range, drag to select multiple"
                  on:click={(e) => handleOcrClick(e, index, ocrText)}
                  on:mousedown={(e) => handleTokenMouseDown(e, index)}
                  on:mouseenter={(e) => { handleTokenMouseEnter(e, index); handleOcrHover(e, index, ocrText); }}
                  on:mouseleave={handleOcrLeave}
                  on:mouseup={handleTokenMouseUp}
                >
                  {ocrText}
                </button>

                <!-- Hiragana Box -->
                <button
                  class="token-box hiragana"
                  on:click={() => handleTokenClick(index, 'hiragana')}
                  title="{isRevealed(index, 'hiragana') ? hiraganaText : 'Click to reveal Hiragana'}"
                >
                  {#if isRevealed(index, 'hiragana')}
                    {hiraganaText}
                  {:else}
                    <span class="spoiler">???</span>
                  {/if}
                </button>

                <!-- Romaji Box -->
                <button
                  class="token-box romaji"
                  on:click={() => handleTokenClick(index, 'romaji')}
                  title="{isRevealed(index, 'romaji') ? romajiText : 'Click to reveal Romaji'}"
                >
                  {#if isRevealed(index, 'romaji')}
                    {romajiText}
                  {:else}
                    <span class="spoiler">???</span>
                  {/if}
                </button>
              </div>
            {/key}
          {/if}
        {/each}
      </div>
    {:else}
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>No tokens available. Analyze a speech bubble to see tokens here.</p>
      </div>
    {/if}
  </div>

  <!-- Word Info Tooltip (on click) -->
  {#if activeWordTooltip}
    {#key `${activeWordTooltip.index}-${activeWordTooltip.loading}`}
      <Tooltip
        word={activeWordTooltip.word}
        position={activeWordTooltip.position}
        loading={activeWordTooltip.loading}
        data={activeWordTooltip.data}
        error={activeWordTooltip.error}
        onClose={closeWordTooltip}
        onReload={reloadWordTooltip}
      />
    {/key}
  {/if}

  <!-- Hover Preview Tooltip (large font) -->
  {#if hoverPreview}
    <div
      class="hover-preview"
      style="left: {hoverPreview.position.x}px; top: {hoverPreview.position.y}px;"
    >
      {hoverPreview.word}
    </div>
  {/if}
</div>

<style>
  .token-reveal {
    border: 1px solid var(--color-border-primary);
    border-radius: 8px;
    background: var(--color-bg-surface);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0.50rem;
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border-primary);
  }

  .title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .controls {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.50rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-reveal-all {
    background: var(--color-accent-blue);
    color: white;
  }

  .btn-reveal-all:hover {
    background: var(--color-accent-blue-dark);
  }

  .btn-hide-all {
    background: var(--color-btn-secondary);
    color: white;
  }

  .btn-hide-all:hover {
    background: var(--color-btn-secondary-hover);
  }

  .icon {
    width: 0.875rem;
    height: 0.875rem;
  }

  .content {
    padding: 0.5rem;
    min-height: 120px;
    max-height: 500px;
    overflow-y: auto;
  }

  .type-btn {
    font-size: 0.75rem;
    font-weight: 600;
    border: 2px solid;
    border-radius: 4px;
  }

  .hiragana-btn {
    border-color: #8b5cf6;
    color: white;
    background: #8b5cf6;
  }

  .hiragana-btn:hover {
    background: #7c3aed;
    border-color: #7c3aed;
  }

  .hiragana-btn.active {
    background: #6d28d9;
    border-color: #6d28d9;
  }

  .romaji-btn {
    border-color: #3b82f6;
    color: white;
    background: #3b82f6;
  }

  .romaji-btn:hover {
    background: #2563eb;
    border-color: #2563eb;
  }

  .romaji-btn.active {
    background: #1d4ed8;
    border-color: #1d4ed8;
  }

  .scale-controls {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: 0.5rem;
    padding-left: 0.5rem;
    border-left: 1px solid var(--color-border-secondary);
  }

  .scale-btn {
    padding: 0.25rem 0.375rem;
    font-size: 0.75rem;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border-primary);
  }

  .scale-btn:hover:not(:disabled) {
    background: var(--color-hover);
    border-color: var(--color-accent-blue);
  }

  .scale-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .scale-btn .icon {
    width: 0.75rem;
    height: 0.75rem;
  }

  .scale-reset {
    font-size: 0.875rem;
    line-height: 1;
  }

  .scale-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    min-width: 2.5rem;
    text-align: center;
  }

  .token-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.125rem;
    margin-bottom: 0.75rem;
  }

  .token-card {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 60px;
  }

  .token-box {
    width: 100%;
    padding: 0.25em 0.25em;
    font-size: 0.875em;
    font-weight: 500;
    text-align: center;
    border: 1px solid;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--color-bg-surface);
    white-space: nowrap;
  }

  .token-box.ocr {
    border-color: lightslategray;
    cursor: pointer;
  }

  .token-box.ocr.revealed {
    border-color: lightslategray;
    background-color: var(--color-bg-tertiary);
  }

  .token-box.ocr:hover {
    border-color: lightskyblue;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Selected token styling */
  .token-box.selected {
    background-color: rgba(255, 255, 255, 0.236) !important;
    border-color: #3b82f6 !important;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important;
  }

  /* Selection toolbar */
  .selection-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: var(--color-accent-blue);
    border-radius: 4px;
    color: white;
  }

  .selection-count {
    font-size: 0.75rem;
    font-weight: 600;
  }

  .btn-copy {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    border-radius: 3px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-copy:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .btn-copy.copied {
    background: rgba(34, 197, 94, 0.9);
    transform: scale(1.05);
  }

  .btn-copy.copied:hover {
    background: rgba(34, 197, 94, 1);
  }

  .btn-clear {
    display: flex;
    align-items: center;
    padding: 0.25rem 0.375rem;
    background: rgba(239, 68, 68, 0.8);
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-clear:hover {
    background: rgba(220, 38, 38, 0.9);
  }

  .btn-copy .icon,
  .btn-clear .icon {
    width: 0.875rem;
    height: 0.875rem;
  }

  .token-box.hiragana {
    border-color: #8b5cf6;
  }


  .token-box.romaji {
    border-color: #3b82f6;
  }

  .spoiler {
    font-size: 0.75em;
    color: var(--color-text-tertiary);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    min-height: 120px;
    color: var(--color-text-tertiary);
    text-align: center;
  }

  .empty-icon {
    width: 3rem;
    height: 3rem;
    opacity: 0.5;
  }

  .empty-state p {
    font-size: 0.875rem;
    margin: 0;
    max-width: 300px;
  }

  /* Hover Preview Tooltip */
  .hover-preview {
    position: fixed;
    z-index: 999;
    background: var(--color-bg-surface, white);
    border: 2px solid var(--color-border-primary, #e5e7eb);
    border-radius: 6px;
    padding: 0.75rem 1rem;
    font-size: 2.5rem;
    font-weight: 600;
    color: var(--color-text-primary, #1f2937);
    box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
    pointer-events: none;
    transform: translateX(-50%);
    white-space: nowrap;
    animation: fadeInPreview 0.2s ease-out;
  }

  @keyframes fadeInPreview {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
