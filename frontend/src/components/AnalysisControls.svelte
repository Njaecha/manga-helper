<script>
  import {
    currentImage,
    folderPath,
    selectedBox,
    selectedBoxIndex,
    selectedBoxIndices,
    selectedBoxes,
    allBoxes,
    detectedBoxes,
    isLoading,
    error,
    setAnalysisResult,
    analysisResult,
    startStreaming,
    appendStreamChunk,
    endStreaming,
    setStreamingError,
    updateCacheAnalysis,
    updateCacheTranslation,
    streamingTranslation,
    clearDetectedBoxesCache,
    clearBoxAnalysisCache,
    clearBoxTranslationCache,
    hasDetectedBoxesCache,
    hasBoxAnalysisCache,
    hasBoxTranslationCache
  } from '../lib/store.js';
  import { detectBubbles, analyzeBubble, analyzeMultipleBubbles, streamTranslation, streamTranslationMultiple, getImageUrl } from '../lib/api.js';
  import { formatError } from '../lib/utils.js';

  let isDetecting = false;
  let isAnalyzing = false;
  let isTranslating = false;

  // Subscribe to stores
  $: hasImage = $currentImage !== null;
  $: hasSelection = $selectedBoxIndices.length > 0;
  $: selectionCount = $selectedBoxIndices.length;
  $: hasAnalysisResult = $analysisResult.ocr_tokens && $analysisResult.ocr_tokens.length > 0;
  $: canDetect = hasImage && !isDetecting && !$isLoading;
  $: canAnalyze = hasImage && hasSelection && !isAnalyzing && !$isLoading;
  $: canTranslate = hasImage && hasSelection && hasAnalysisResult && !isTranslating && !$isLoading;

  // Check cache status
  $: hasCachedDetection = hasDetectedBoxesCache();
  $: hasCachedAnalysis = hasBoxAnalysisCache($selectedBoxIndex);
  $: hasCachedTranslation = hasBoxTranslationCache($selectedBoxIndex);

  // Button text based on selection
  $: analyzeButtonText = selectionCount === 1 ? 'Analyze Bubble' : `Analyze ${selectionCount} Bubbles`;
  $: translateButtonText = selectionCount === 1 ? 'Translate' : `Translate ${selectionCount} Bubbles`;

  async function handleDetect() {
    if (!canDetect || !$currentImage) return;

    // Clear cached detection if we're re-detecting
    if (hasCachedDetection) {
      clearDetectedBoxesCache();
    }

    isDetecting = true;
    error.set(null);

    try {
      // Get the image path for the current image
      const imagePath = getImageUrl($folderPath, $currentImage);

      const result = await detectBubbles(imagePath);

      if (result.boxes && result.boxes.length > 0) {
        detectedBoxes.set(result.boxes);
      } else {
        detectedBoxes.set([]);
        error.set('No speech bubbles detected in this image');
      }
    } catch (err) {
      error.set(formatError(err));
    } finally {
      isDetecting = false;
    }
  }

  async function handleAnalyze() {
    if (!canAnalyze || !$currentImage || $selectedBoxIndices.length === 0) return;

    // Clear cached analysis if we're re-analyzing
    if (hasCachedAnalysis && $selectedBoxIndex != null) {
      clearBoxAnalysisCache($selectedBoxIndex);
    }

    isAnalyzing = true;
    error.set(null);

    try {
      // Get the image path for the current image
      const imagePath = getImageUrl($folderPath, $currentImage);

      let result;

      if ($selectedBoxIndices.length === 1) {
        // Single bubble analysis
        result = await analyzeBubble(imagePath, $selectedBoxes[0]);
        console.log('[AnalysisControls] Single analysis result:', result);
      } else {
        // Multi-bubble analysis
        result = await analyzeMultipleBubbles(imagePath, $selectedBoxes);
        console.log('[AnalysisControls] Multi analysis result:', result);
      }

      // Debug: Log the response to see what we're getting
      console.log('[AnalysisControls] OCR Tokens:', result.ocr_tokens);
      console.log('[AnalysisControls] Hiragana Tokens:', result.hiragana_tokens);
      console.log('[AnalysisControls] Romaji Tokens:', result.romaji_tokens);

      setAnalysisResult(result);

      // Save analysis to cache
      updateCacheAnalysis($selectedBoxIndices, result);
    } catch (err) {
      error.set(formatError(err));
    } finally {
      isAnalyzing = false;
    }
  }

  async function handleTranslate() {
    if (!canTranslate || !$currentImage || $selectedBoxIndices.length === 0) return;

    // Clear cached translation if we're re-translating
    if (hasCachedTranslation && $selectedBoxIndex != null) {
      clearBoxTranslationCache($selectedBoxIndex);
    }

    isTranslating = true;
    error.set(null);
    startStreaming();

    try {
      // Get the image path for the current image
      const imagePath = getImageUrl($folderPath, $currentImage);

      if ($selectedBoxIndices.length === 1) {
        // Single bubble translation
        await streamTranslation(
          imagePath,
          $selectedBoxes[0],
          $analysisResult.bubbleBreakdown?.[0]?.ocr_text || $analysisResult.ocr_text,
          (chunk) => {
            appendStreamChunk(chunk);
          },
          (err) => {
            setStreamingError(formatError(err));
          }
        );
      } else {
        // Multi-bubble translation
        const ocrTexts = $analysisResult.bubbleBreakdown.map(b => b.ocr_text);
        await streamTranslationMultiple(
          imagePath,
          $selectedBoxes,
          ocrTexts,
          (chunk) => {
            appendStreamChunk(chunk);
          },
          (err) => {
            setStreamingError(formatError(err));
          }
        );
      }

      // Streaming completed successfully
      endStreaming();

      // Save translation to cache
      updateCacheTranslation($selectedBoxIndices, {
        thinking: $streamingTranslation.thinking,
        content: $streamingTranslation.content
      });
    } catch (err) {
      setStreamingError(formatError(err));
    } finally {
      isTranslating = false;
    }
  }
</script>

<div class="p-2 border-b border-border-primary">
  <h2 class="text-sm font-semibold text-center text-text-primary mb-2">Analysis</h2>

  <div class="flex gap-2 flex-wrap">
    <!-- Detection Button -->
    <button
      on:click={handleDetect}
      disabled={!canDetect}
      class="flex-1 min-w-[110px] px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer border-none shadow-sm text-white flex items-center justify-center bg-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue-dark)] disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-tertiary)] disabled:cursor-not-allowed disabled:opacity-60"
      title={!hasImage ? 'Load an image first' : hasCachedDetection ? 'Re-detect (clears cached boxes)' : 'Detect speech bubbles'}
    >
    {#if isDetecting}
      <span class="flex items-center justify-center gap-2">
        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Detecting...
      </span>
    {:else}
      <span class="flex items-center justify-center gap-2">
        {#if hasCachedDetection}
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
        {/if}
        Detect Speech Bubbles
      </span>
    {/if}
  </button>

    <!-- Analysis Button -->
    <button
      on:click={handleAnalyze}
      disabled={!canAnalyze}
      class="flex-1 min-w-[110px] px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer border-none shadow-sm text-white flex items-center justify-center bg-[var(--color-accent-green)] hover:bg-[var(--color-accent-green-dark)] disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-tertiary)] disabled:cursor-not-allowed disabled:opacity-60"
      title={!hasImage ? 'Load an image first' : !hasSelection ? 'Select a speech bubble first' : hasCachedAnalysis ? 'Re-analyze (clears cached analysis)' : 'Analyze speech bubble'}
    >
    {#if isAnalyzing}
      <span class="flex items-center justify-center gap-2">
        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Analyzing...
      </span>
    {:else}
      <span class="flex items-center justify-center gap-2">
        {#if hasCachedAnalysis}
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
        {/if}
        {analyzeButtonText}
      </span>
    {/if}
  </button>

    <!-- Translation Button -->
    <button
      on:click={handleTranslate}
      disabled={!canTranslate}
      class="flex-1 min-w-[110px] px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer border-none shadow-sm text-white flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-tertiary)] disabled:cursor-not-allowed disabled:opacity-60"
      title={!hasImage ? 'Load an image first' : !hasSelection ? 'Select a speech bubble first' : !hasAnalysisResult ? 'Analyze the bubble first' : hasCachedTranslation ? 'Re-translate (clears cached translation)' : 'Translate'}
    >
    {#if isTranslating}
      <span class="flex items-center justify-center gap-2">
        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Translating...
      </span>
    {:else}
      <span class="flex items-center justify-center gap-2">
        {#if hasCachedTranslation}
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
        {/if}
        {translateButtonText}
      </span>
    {/if}
    </button>
  </div>

  <!-- Helper Text -->
  {#if !hasImage}
    <p class="mt-2 text-xs text-text-tertiary text-center">
      Load a manga folder to begin
    </p>
  {:else if !hasSelection && !isDetecting}
    <p class="mt-2 text-xs text-text-tertiary text-center">
      Click "Detect" or draw a custom box
    </p>
  {/if}
</div>

<style>
  /* Responsive: stack buttons on very small screens */
  @media (max-width: 480px) {
    .flex-wrap {
      flex-direction: column;
    }
    .min-w-\[110px\] {
      min-width: auto;
    }
  }
</style>
