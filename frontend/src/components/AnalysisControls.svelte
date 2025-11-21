<script>
  import {
    currentImage,
    folderPath,
    selectedBox,
    selectedBoxIndex,
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
  import { detectBubbles, analyzeBubble, streamTranslation, getImageUrl } from '../lib/api.js';
  import { formatError } from '../lib/utils.js';

  let isDetecting = false;
  let isAnalyzing = false;
  let isTranslating = false;

  // Subscribe to stores
  $: hasImage = $currentImage !== null;
  $: hasSelection = $selectedBox !== null;
  $: hasAnalysisResult = $analysisResult.ocr_text && $analysisResult.ocr_text.length > 0;
  $: canDetect = hasImage && !isDetecting && !$isLoading;
  $: canAnalyze = hasImage && hasSelection && !isAnalyzing && !$isLoading;
  $: canTranslate = hasImage && hasSelection && hasAnalysisResult && !isTranslating && !$isLoading;

  // Check cache status
  $: hasCachedDetection = hasDetectedBoxesCache();
  $: hasCachedAnalysis = hasBoxAnalysisCache($selectedBoxIndex);
  $: hasCachedTranslation = hasBoxTranslationCache($selectedBoxIndex);

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
    if (!canAnalyze || !$currentImage || !$selectedBox) return;

    // Clear cached analysis if we're re-analyzing
    if (hasCachedAnalysis && $selectedBoxIndex != null) {
      clearBoxAnalysisCache($selectedBoxIndex);
    }

    isAnalyzing = true;
    error.set(null);

    try {
      // Get the image path for the current image
      const imagePath = getImageUrl($folderPath, $currentImage);

      const result = await analyzeBubble(imagePath, $selectedBox);

      // Debug: Log the response to see what we're getting
      console.log('[AnalysisControls] Analysis result:', result);
      console.log('[AnalysisControls] OCR Tokens:', result.ocr_tokens);
      console.log('[AnalysisControls] Hiragana Tokens:', result.hiragana_tokens);
      console.log('[AnalysisControls] Romaji Tokens:', result.romaji_tokens);

      setAnalysisResult(result);

      // Save analysis to cache
      if ($selectedBoxIndex != null) {
        updateCacheAnalysis($selectedBoxIndex, result);
      }
    } catch (err) {
      error.set(formatError(err));
    } finally {
      isAnalyzing = false;
    }
  }

  async function handleTranslate() {
    if (!canTranslate || !$currentImage || !$selectedBox || !$analysisResult.ocr_text) return;

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

      // Stream the translation
      await streamTranslation(
        imagePath,
        $selectedBox,
        $analysisResult.ocr_text,
        (chunk) => {
          // Callback for each chunk
          appendStreamChunk(chunk);
        },
        (err) => {
          // Error callback
          setStreamingError(formatError(err));
        }
      );

      // Streaming completed successfully
      endStreaming();

      // Save translation to cache
      if ($selectedBoxIndex != null) {
        updateCacheTranslation($selectedBoxIndex, {
          thinking: $streamingTranslation.thinking,
          content: $streamingTranslation.content
        });
      }
    } catch (err) {
      setStreamingError(formatError(err));
    } finally {
      isTranslating = false;
    }
  }
</script>

<div class="analysis-controls">
  <h2 class="text-sm font-semibold text-center">Analysis</h2>

  <div class="button-group">
    <!-- Detection Button -->
    <button
      on:click={handleDetect}
      disabled={!canDetect}
      class="action-button detect-button"
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
      class="action-button analyze-button"
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
        Analyze Selected Bubble
      </span>
    {/if}
  </button>

    <!-- Translation Button -->
    <button
      on:click={handleTranslate}
      disabled={!canTranslate}
      class="action-button translate-button"
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
        Translate
      </span>
    {/if}
    </button>
  </div>

  <!-- Helper Text -->
  {#if !hasImage}
    <p class="helper-text">
      Load a manga folder to begin
    </p>
  {:else if !hasSelection && !isDetecting}
    <p class="helper-text">
      Click "Detect" or draw a custom box
    </p>
  {/if}
</div>

<style>
  .analysis-controls {
    padding: 0.5rem;
    border-bottom: 1px solid var(--color-border-primary);
  }

  .analysis-controls h2 {
    margin-bottom: 0.5rem;
    color: var(--color-text-primary);
  }

  .button-group {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .action-button {
    flex: 1;
    min-width: 110px;
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.5rem;
    transition: all 0.2s;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-button:disabled {
    background: var(--color-bg-tertiary);
    color: var(--color-text-tertiary);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .detect-button {
    background: #3b82f6;
  }

  .detect-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .analyze-button {
    background: #10b981;
  }

  .analyze-button:hover:not(:disabled) {
    background: #059669;
  }

  .translate-button {
    background: #8b5cf6;
  }

  .translate-button:hover:not(:disabled) {
    background: #7c3aed;
  }

  .helper-text {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    text-align: center;
  }

  /* Responsive: stack buttons on very small screens */
  @media (max-width: 480px) {
    .button-group {
      flex-direction: column;
    }

    .action-button {
      min-width: auto;
    }
  }
</style>
