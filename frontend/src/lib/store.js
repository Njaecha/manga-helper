import { writable, derived, get } from 'svelte/store';
import {
  loadPageCache,
  savePageCache,
  loadWordCache,
  saveWordCache,
  getPageCacheEntry,
  setPageCacheEntry,
  createPageCacheEntry,
  buildImageCacheKey
} from './cache.js';

// Folder and image management
export const folderPath = writable('');
export const imageList = writable([]);
export const currentImageIndex = writable(0);

// Derived store for current image
export const currentImage = derived(
  [imageList, currentImageIndex],
  ([$imageList, $currentImageIndex]) => {
    return $imageList[$currentImageIndex] || null;
  }
);

// Speech bubble detection
export const detectedBoxes = writable([]);
export const customBoxes = writable([]);

// Combined boxes (both detected and custom)
export const allBoxes = derived(
  [detectedBoxes, customBoxes],
  ([$detectedBoxes, $customBoxes]) => {
    return [
      ...$detectedBoxes.map(box => ({ ...box, type: 'detected' })),
      ...$customBoxes.map(box => ({ ...box, type: 'custom' }))
    ];
  }
);

// Selection state - now supports multi-selection
export const selectedBoxIndices = writable([]); // Array of indices in selection order

// Derived stores for backward compatibility and convenience
export const selectedBoxes = derived(
  [allBoxes, selectedBoxIndices],
  ([$allBoxes, $selectedBoxIndices]) => {
    return $selectedBoxIndices.map(idx => $allBoxes[idx]).filter(Boolean);
  }
);

// For backward compatibility - returns first selected box
export const selectedBox = derived(selectedBoxes, $selectedBoxes => $selectedBoxes[0] || null);
export const selectedBoxIndex = derived(selectedBoxIndices, $selectedBoxIndices => $selectedBoxIndices[0] ?? null);

// Analysis results for selected bubble(s)
export const analysisResult = writable({
  ocr_text: '',
  ocr_tokens: [],
  hiragana_tokens: [],
  romaji_tokens: [],
  bubbleBreakdown: [] // For multi-bubble analysis: array of per-bubble data
});

// Streaming translation state
export const streamingTranslation = writable({
  thinking: '',   // Accumulates thinking chunks from LLM
  content: '',    // Accumulates content chunks (actual translation)
  isStreaming: false,
  error: null
});

// Revealed tokens tracking (for spoiler functionality)
// Structure: { 0: { ocr: true, hiragana: false, romaji: false }, 1: {...}, ... }
export const revealedTokens = writable({});

// Selected tokens for multi-selection (copy to clipboard, chat context, etc.)
// Structure: Set of token indices
export const selectedTokenIndices = writable(new Set());

// Revealed sections tracking
export const revealedSections = writable({
  translation: false
});

// User translations storage
// Format: { imageName: { boxIndex: { marker: '1', translation: 'text' } } }
export const userTranslations = writable({});

// UI state
export const isLoading = writable(false);
export const isDrawingMode = writable(false);
export const error = writable(null);

// UI visibility toggles
export const showFolderInput = writable(true);
export const showLegend = writable(false);
export const carouselExpanded = writable(true);

// Panel sizing - percentage width for left pane (30-80%)
const storedWidth = localStorage.getItem('leftPaneWidthPercent');
export const leftPaneWidthPercent = writable(storedWidth ? parseFloat(storedWidth) : 66.67);

// Persist panel width to localStorage
leftPaneWidthPercent.subscribe(value => {
  localStorage.setItem('leftPaneWidthPercent', value.toString());
});

// Token grid scale - scale factor for token cards (0.6 to 2.0)
const storedScale = localStorage.getItem('tokenGridScale');
export const tokenGridScale = writable(storedScale ? parseFloat(storedScale) : 1.0);

// Persist token grid scale to localStorage
tokenGridScale.subscribe(value => {
  localStorage.setItem('tokenGridScale', value.toString());
});

// Canvas zoom and pan state
export const canvasScale = writable(1.0);  // Zoom level (0.25 to 4.0)
export const canvasOffset = writable({ x: 0, y: 0 });  // Pan offset

// Cache stores
export const pageCache = writable(loadPageCache());
export const wordCache = writable(loadWordCache());

// Helper functions to update stores
export function setFolder(path, images) {
  folderPath.set(path);
  imageList.set(images);
  currentImageIndex.set(0);
  resetAnalysisState();
}

export function nextImage() {
  // Save current page state before navigating
  saveCurrentPageToCache();

  let maxIndex = 0;
  imageList.subscribe(list => {
    maxIndex = list.length - 1;
  })();

  currentImageIndex.update(n => {
    return n < maxIndex ? n + 1 : n;
  });

  // Try to restore from cache, otherwise reset
  if (!restorePageFromCache()) {
    resetAnalysisState();
  }
}

export function prevImage() {
  // Save current page state before navigating
  saveCurrentPageToCache();

  currentImageIndex.update(n => n > 0 ? n - 1 : 0);

  // Try to restore from cache, otherwise reset
  if (!restorePageFromCache()) {
    resetAnalysisState();
  }
}

export function goToImage(index) {
  // Save current page state before navigating
  saveCurrentPageToCache();

  currentImageIndex.set(index);

  // Try to restore from cache, otherwise reset
  if (!restorePageFromCache()) {
    resetAnalysisState();
  }
}

export function addCustomBox(box) {
  customBoxes.update(boxes => [...boxes, box]);
}

export function removeBox(boxIndex, boxType) {
  if (boxType === 'custom') {
    customBoxes.update(boxes => boxes.filter((_, i) => i !== boxIndex));
  } else if (boxType === 'detected') {
    detectedBoxes.update(boxes => boxes.filter((_, i) => i !== boxIndex));
  }
  // Clear selection if deleted box was selected
  selectedBoxIndices.update(indices => indices.filter(idx => idx !== boxIndex));
}

export function selectBox(box, index, isMultiSelect = false) {
  if (isMultiSelect) {
    // Add to or remove from selection
    selectedBoxIndices.update(indices => {
      if (indices.includes(index)) {
        // Deselect if already selected
        return indices.filter(idx => idx !== index);
      } else {
        // Add to selection in order
        return [...indices, index];
      }
    });
  } else {
    // Single selection - toggle if clicking the same box, otherwise replace
    selectedBoxIndices.update(indices => {
      if (indices.length === 1 && indices[0] === index) {
        // Deselect if clicking the same box again
        return [];
      } else {
        // Replace selection with clicked box
        return [index];
      }
    });
  }

  // Try to restore cached analysis for the selection
  const indices = get(selectedBoxIndices);
  if (indices.length === 1) {
    restoreBoxAnalysisFromCache(indices[0]);
  } else if (indices.length > 1) {
    restoreMultiBoxAnalysisFromCache(indices);
  } else {
    // No selection, clear analysis
    restoreBoxAnalysisFromCache(null);
  }
}

/**
 * Restore analysis for multiple boxes from cache
 * @param {number[]} boxIndices - Array of box indices to restore
 */
function restoreMultiBoxAnalysisFromCache(boxIndices) {
  if (!boxIndices || boxIndices.length === 0) {
    // Clear analysis if no boxes selected
    analysisResult.set({
      ocr_text: '',
      ocr_tokens: [],
      hiragana_tokens: [],
      romaji_tokens: [],
      bubbleBreakdown: []
    });
    clearStreamingTranslation();
    return;
  }

  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage) {
    return;
  }

  const cacheKey = buildImageCacheKey($folderPath, $currentImage);
  const $pageCache = get(pageCache);
  const entry = getPageCacheEntry($pageCache, cacheKey);

  if (!entry) {
    // No cache for this page, clear analysis
    analysisResult.set({
      ocr_text: '',
      ocr_tokens: [],
      hiragana_tokens: [],
      romaji_tokens: [],
      bubbleBreakdown: []
    });
    clearStreamingTranslation();
    return;
  }

  // Build multi-box cache key (sorted for consistency)
  const multiKey = 'multi_' + [...boxIndices].sort((a, b) => a - b).join(',');

  // Try to restore multi-box analysis
  if (entry.analyses && entry.analyses[multiKey]) {
    console.log('[Store] Restoring cached multi-box analysis for indices', boxIndices);
    analysisResult.set(entry.analyses[multiKey]);
  } else {
    // No cached multi-analysis, clear it
    analysisResult.set({
      ocr_text: '',
      ocr_tokens: [],
      hiragana_tokens: [],
      romaji_tokens: [],
      bubbleBreakdown: []
    });
  }

  // Try to restore streaming translation for multi-selection
  if (entry.streamingTranslations && entry.streamingTranslations[multiKey]) {
    console.log('[Store] Restoring cached multi-box translation for indices', boxIndices);
    const translation = entry.streamingTranslations[multiKey];
    streamingTranslation.set({
      thinking: translation.thinking || '',
      content: translation.content || '',
      isStreaming: false,
      error: null
    });
  } else {
    clearStreamingTranslation();
  }
}

/**
 * Restore analysis and translation for a specific box from cache
 * @param {number} boxIndex - Index of the box to restore
 */
function restoreBoxAnalysisFromCache(boxIndex) {
  if (boxIndex == null) {
    // Clear analysis if no box selected
    analysisResult.set({
      ocr_text: '',
      ocr_tokens: [],
      hiragana_tokens: [],
      romaji_tokens: [],
      bubbleBreakdown: []
    });
    clearStreamingTranslation();
    return;
  }

  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage) {
    return;
  }

  const cacheKey = buildImageCacheKey($folderPath, $currentImage);
  const $pageCache = get(pageCache);
  const entry = getPageCacheEntry($pageCache, cacheKey);

  if (!entry) {
    // No cache for this page, clear analysis
    analysisResult.set({
      ocr_text: '',
      ocr_tokens: [],
      hiragana_tokens: [],
      romaji_tokens: [],
      bubbleBreakdown: []
    });
    clearStreamingTranslation();
    return;
  }

  // Restore analysis if cached for this box
  if (entry.analyses && entry.analyses[boxIndex]) {
    console.log('[Store] Restoring cached analysis for box', boxIndex);
    analysisResult.set(entry.analyses[boxIndex]);
  } else {
    // No cached analysis for this box, clear it
    analysisResult.set({
      ocr_text: '',
      ocr_tokens: [],
      hiragana_tokens: [],
      romaji_tokens: [],
      bubbleBreakdown: []
    });
  }

  // Restore streaming translation if cached for this box
  if (entry.streamingTranslations && entry.streamingTranslations[boxIndex]) {
    console.log('[Store] Restoring cached translation for box', boxIndex);
    const translation = entry.streamingTranslations[boxIndex];
    streamingTranslation.set({
      thinking: translation.thinking || '',
      content: translation.content || '',
      isStreaming: false,
      error: null
    });
  } else {
    // No cached translation for this box, clear it
    clearStreamingTranslation();
  }
}

export function clearSelection() {
  selectedBoxIndices.set([]);
}

export function setAnalysisResult(result) {
  analysisResult.set(result);
  // Reset revealed state when new analysis comes in
  revealedTokens.set({});
  revealedSections.set({
    translation: false
  });
}

export function toggleDrawingMode() {
  isDrawingMode.update(mode => !mode);
}

// Canvas zoom and pan functions
export function setCanvasScale(scale) {
  // Clamp scale between 0.25 and 4.0
  const clampedScale = Math.max(0.25, Math.min(4.0, scale));
  canvasScale.set(clampedScale);
}

export function zoomIn() {
  canvasScale.update(scale => Math.min(4.0, scale * 1.25));
}

export function zoomOut() {
  canvasScale.update(scale => Math.max(0.25, scale / 1.25));
}

export function resetCanvasView() {
  canvasScale.set(1.0);
  canvasOffset.set({ x: 0, y: 0 });
}

export function setCanvasOffset(offset) {
  canvasOffset.set(offset);
}

export function updateCanvasOffset(deltaX, deltaY) {
  canvasOffset.update(offset => ({
    x: offset.x + deltaX,
    y: offset.y + deltaY
  }));
}

export function resetAnalysisState() {
  detectedBoxes.set([]);
  customBoxes.set([]);
  selectedBoxIndices.set([]);
  analysisResult.set({
    ocr_text: '',
    ocr_tokens: [],
    hiragana_tokens: [],
    romaji_tokens: [],
    bubbleBreakdown: []
  });
  revealedTokens.set({});
  revealedSections.set({
    translation: false
  });
  clearStreamingTranslation();
}

export function revealToken(index, type) {
  console.log(`[Store] revealToken called - Index: ${index}, Type: ${type}`);
  revealedTokens.update(tokens => {
    console.log('[Store] Current tokens before update:', tokens);
    const newTokens = { ...tokens };
    // Create a new nested object to ensure reactivity
    newTokens[index] = {
      ocr: tokens[index]?.ocr || false,
      hiragana: tokens[index]?.hiragana || false,
      romaji: tokens[index]?.romaji || false,
      [type]: true
    };
    console.log('[Store] New tokens after update:', newTokens);
    return newTokens;
  });
}

export function hideToken(index, type) {
  console.log(`[Store] hideToken called - Index: ${index}, Type: ${type}`);
  revealedTokens.update(tokens => {
    console.log('[Store] Current tokens before update:', tokens);
    const newTokens = { ...tokens };
    if (tokens[index]) {
      // Create a new nested object
      newTokens[index] = {
        ...tokens[index],
        [type]: false
      };
    }
    console.log('[Store] New tokens after update:', newTokens);
    return newTokens;
  });
}

export function revealAllOfType(type, count) {
  revealedTokens.update(tokens => {
    const newTokens = {};
    for (let i = 0; i < count; i++) {
      // Create new nested objects
      newTokens[i] = {
        ocr: tokens[i]?.ocr || false,
        hiragana: tokens[i]?.hiragana || false,
        romaji: tokens[i]?.romaji || false,
        [type]: true
      };
    }
    return newTokens;
  });
}

export function hideAllOfType(type, count) {
  revealedTokens.update(tokens => {
    const newTokens = {};
    for (let i = 0; i < count; i++) {
      // Create new nested objects
      newTokens[i] = {
        ocr: tokens[i]?.ocr || false,
        hiragana: tokens[i]?.hiragana || false,
        romaji: tokens[i]?.romaji || false,
        [type]: false
      };
    }
    return newTokens;
  });
}

export function revealAllTokens(count) {
  revealedTokens.update(() => {
    const newTokens = {};
    for (let i = 0; i < count; i++) {
      newTokens[i] = { ocr: true, hiragana: true, romaji: true };
    }
    return newTokens;
  });
}

export function hideAllTokens() {
  revealedTokens.set({});
}

export function saveUserTranslation(imageName, boxIndex, marker, translation) {
  userTranslations.update(translations => {
    if (!translations[imageName]) {
      translations[imageName] = {};
    }
    translations[imageName][boxIndex] = { marker, translation };
    return translations;
  });
}

export function getUserTranslation(imageName, boxIndex) {
  let result = null;
  userTranslations.subscribe(translations => {
    result = translations[imageName]?.[boxIndex] || null;
  })();
  return result;
}

export function clearError() {
  error.set(null);
}

// Streaming translation functions
export function startStreaming() {
  streamingTranslation.set({
    thinking: '',
    content: '',
    isStreaming: true,
    error: null
  });
}

export function appendStreamChunk(chunk) {
  // chunk is now an object: {type: 'thinking'|'content', text: '...'}
  streamingTranslation.update(state => {
    if (chunk.type === 'thinking') {
      return {
        ...state,
        thinking: state.thinking + chunk.text
      };
    } else if (chunk.type === 'content') {
      return {
        ...state,
        content: state.content + chunk.text
      };
    }
    return state;
  });
}

export function endStreaming() {
  streamingTranslation.update(state => ({
    ...state,
    isStreaming: false
  }));
}

export function setStreamingError(errorMessage) {
  streamingTranslation.update(state => ({
    ...state,
    isStreaming: false,
    error: errorMessage
  }));
}

export function clearStreamingTranslation() {
  streamingTranslation.set({
    thinking: '',
    content: '',
    isStreaming: false,
    error: null
  });
}

// ============ CACHE FUNCTIONS ============

/**
 * Save current page state to cache before navigation
 */
export function saveCurrentPageToCache() {
  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage) {
    console.log('[Store] Cannot save to cache: no folder or image');
    return;
  }

  const cacheKey = buildImageCacheKey($folderPath, $currentImage);
  const $pageCache = get(pageCache);

  // Get current state
  const $selectedBoxIndices = get(selectedBoxIndices);
  const entry = {
    detectedBoxes: get(detectedBoxes),
    customBoxes: get(customBoxes),
    selectedBoxIndices: $selectedBoxIndices,
    revealedTokens: get(revealedTokens),
    analyses: {},
    streamingTranslations: {}
  };

  // Preserve existing analyses if any
  const existingEntry = getPageCacheEntry($pageCache, cacheKey);
  if (existingEntry) {
    entry.analyses = existingEntry.analyses || {};
    entry.streamingTranslations = existingEntry.streamingTranslations || {};
  }

  // Add current analysis if we have one
  const $analysisResult = get(analysisResult);
  if ($analysisResult && $analysisResult.ocr_tokens?.length > 0) {
    if ($selectedBoxIndices.length === 1) {
      // Single box analysis
      entry.analyses[$selectedBoxIndices[0]] = $analysisResult;
    } else if ($selectedBoxIndices.length > 1) {
      // Multi-box analysis - also cache individual boxes
      const multiKey = 'multi_' + [...$selectedBoxIndices].sort((a, b) => a - b).join(',');
      entry.analyses[multiKey] = $analysisResult;

      // Cache individual box analyses from bubbleBreakdown
      if ($analysisResult.bubbleBreakdown) {
        $analysisResult.bubbleBreakdown.forEach((bubbleData, idx) => {
          const boxIndex = $selectedBoxIndices[idx];
          entry.analyses[boxIndex] = {
            ocr_text: bubbleData.ocr_text,
            ocr_tokens: bubbleData.ocr_tokens,
            hiragana_tokens: bubbleData.hiragana_tokens,
            romaji_tokens: bubbleData.romaji_tokens,
            bubbleBreakdown: []
          };
        });
      }
    }
  }

  // Add current streaming translation if we have one
  const $streamingTranslation = get(streamingTranslation);
  if ($streamingTranslation && ($streamingTranslation.thinking || $streamingTranslation.content)) {
    if ($selectedBoxIndices.length === 1) {
      // Single box translation
      entry.streamingTranslations[$selectedBoxIndices[0]] = {
        thinking: $streamingTranslation.thinking,
        content: $streamingTranslation.content
      };
    } else if ($selectedBoxIndices.length > 1) {
      // Multi-box translation
      const multiKey = 'multi_' + [...$selectedBoxIndices].sort((a, b) => a - b).join(',');
      entry.streamingTranslations[multiKey] = {
        thinking: $streamingTranslation.thinking,
        content: $streamingTranslation.content
      };
    }
  }

  setPageCacheEntry($pageCache, cacheKey, entry);
  pageCache.set($pageCache);

  console.log('[Store] Saved page to cache:', cacheKey, entry);
}

/**
 * Restore page state from cache after navigation
 * @returns {boolean} True if cache was restored, false if no cache found
 */
export function restorePageFromCache() {
  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage) {
    console.log('[Store] Cannot restore from cache: no folder or image');
    return false;
  }

  const cacheKey = buildImageCacheKey($folderPath, $currentImage);
  const $pageCache = get(pageCache);
  const entry = getPageCacheEntry($pageCache, cacheKey);

  if (!entry) {
    console.log('[Store] No cache found for:', cacheKey);
    return false;
  }

  console.log('[Store] Restoring page from cache:', cacheKey, entry);

  // Restore state
  detectedBoxes.set(entry.detectedBoxes || []);
  customBoxes.set(entry.customBoxes || []);

  // Restore selection (support both old and new format)
  if (entry.selectedBoxIndices) {
    selectedBoxIndices.set(entry.selectedBoxIndices);
  } else if (entry.selectedBoxIndex != null) {
    // Backward compatibility - old cache format
    selectedBoxIndices.set([entry.selectedBoxIndex]);
  } else {
    selectedBoxIndices.set([]);
  }

  revealedTokens.set(entry.revealedTokens || {});

  // Restore analysis based on selection
  const indices = entry.selectedBoxIndices || (entry.selectedBoxIndex != null ? [entry.selectedBoxIndex] : []);
  if (indices.length === 1) {
    // Single box analysis
    if (entry.analyses && entry.analyses[indices[0]]) {
      analysisResult.set(entry.analyses[indices[0]]);
    } else {
      analysisResult.set({
        ocr_text: '',
        ocr_tokens: [],
        hiragana_tokens: [],
        romaji_tokens: [],
        bubbleBreakdown: []
      });
    }
  } else if (indices.length > 1) {
    // Multi-box analysis
    const multiKey = 'multi_' + [...indices].sort((a, b) => a - b).join(',');
    if (entry.analyses && entry.analyses[multiKey]) {
      analysisResult.set(entry.analyses[multiKey]);
    } else {
      analysisResult.set({
        ocr_text: '',
        ocr_tokens: [],
        hiragana_tokens: [],
        romaji_tokens: [],
        bubbleBreakdown: []
      });
    }
  } else {
    analysisResult.set({
      ocr_text: '',
      ocr_tokens: [],
      hiragana_tokens: [],
      romaji_tokens: [],
      bubbleBreakdown: []
    });
  }

  // Restore streaming translation if available
  if (indices.length === 1) {
    if (entry.streamingTranslations && entry.streamingTranslations[indices[0]]) {
      const translation = entry.streamingTranslations[indices[0]];
      streamingTranslation.set({
        thinking: translation.thinking || '',
        content: translation.content || '',
        isStreaming: false,
        error: null
      });
    } else {
      clearStreamingTranslation();
    }
  } else if (indices.length > 1) {
    const multiKey = 'multi_' + [...indices].sort((a, b) => a - b).join(',');
    if (entry.streamingTranslations && entry.streamingTranslations[multiKey]) {
      const translation = entry.streamingTranslations[multiKey];
      streamingTranslation.set({
        thinking: translation.thinking || '',
        content: translation.content || '',
        isStreaming: false,
        error: null
      });
    } else {
      clearStreamingTranslation();
    }
  } else {
    clearStreamingTranslation();
  }

  return true;
}

/**
 * Update cache with current analysis result
 * @param {number|number[]} boxIndices - Single box index or array of box indices
 * @param {object} analysisData - Analysis result data
 */
export function updateCacheAnalysis(boxIndices, analysisData) {
  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage || boxIndices == null) {
    return;
  }

  const cacheKey = buildImageCacheKey($folderPath, $currentImage);
  const $pageCache = get(pageCache);

  let entry = getPageCacheEntry($pageCache, cacheKey);
  if (!entry) {
    entry = createPageCacheEntry();
  }

  // Handle both single box and multi-box
  if (Array.isArray(boxIndices)) {
    if (boxIndices.length === 1) {
      // Single box
      entry.analyses[boxIndices[0]] = analysisData;
      console.log('[Store] Updated cache analysis for box', boxIndices[0]);
    } else if (boxIndices.length > 1) {
      // Multi-box - cache both multi-key and individual boxes
      const multiKey = 'multi_' + [...boxIndices].sort((a, b) => a - b).join(',');
      entry.analyses[multiKey] = analysisData;

      // Also cache individual box analyses from bubbleBreakdown
      if (analysisData.bubbleBreakdown) {
        analysisData.bubbleBreakdown.forEach((bubbleData, idx) => {
          const boxIndex = boxIndices[idx];
          entry.analyses[boxIndex] = {
            ocr_text: bubbleData.ocr_text,
            ocr_tokens: bubbleData.ocr_tokens,
            hiragana_tokens: bubbleData.hiragana_tokens,
            romaji_tokens: bubbleData.romaji_tokens,
            bubbleBreakdown: []
          };
        });
      }

      console.log('[Store] Updated cache analysis for multi-box', multiKey);
    }
  } else {
    // Backward compatibility - single number
    entry.analyses[boxIndices] = analysisData;
    console.log('[Store] Updated cache analysis for box', boxIndices);
  }

  setPageCacheEntry($pageCache, cacheKey, entry);
  pageCache.set($pageCache);
}

/**
 * Update cache with streaming translation
 * @param {number|number[]} boxIndices - Single box index or array of box indices
 * @param {object} translationData - Translation data {thinking, content}
 */
export function updateCacheTranslation(boxIndices, translationData) {
  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage || boxIndices == null) {
    return;
  }

  const cacheKey = buildImageCacheKey($folderPath, $currentImage);
  const $pageCache = get(pageCache);

  let entry = getPageCacheEntry($pageCache, cacheKey);
  if (!entry) {
    entry = createPageCacheEntry();
  }

  // Handle both single box and multi-box
  if (Array.isArray(boxIndices)) {
    if (boxIndices.length === 1) {
      entry.streamingTranslations[boxIndices[0]] = translationData;
      console.log('[Store] Updated cache translation for box', boxIndices[0]);
    } else if (boxIndices.length > 1) {
      const multiKey = 'multi_' + [...boxIndices].sort((a, b) => a - b).join(',');
      entry.streamingTranslations[multiKey] = translationData;
      console.log('[Store] Updated cache translation for multi-box', multiKey);
    }
  } else {
    // Backward compatibility - single number
    entry.streamingTranslations[boxIndices] = translationData;
    console.log('[Store] Updated cache translation for box', boxIndices);
  }

  setPageCacheEntry($pageCache, cacheKey, entry);
  pageCache.set($pageCache);
}

/**
 * Clear cache for current page
 */
export function clearCurrentPageCache() {
  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage) {
    return;
  }

  const cacheKey = buildImageCacheKey($folderPath, $currentImage);
  const $pageCache = get(pageCache);

  delete $pageCache[cacheKey];
  savePageCache($pageCache);
  pageCache.set($pageCache);

  console.log('[Store] Cleared cache for:', cacheKey);
}

/**
 * Clear all page cache
 */
export function clearAllPageCache() {
  const $pageCache = get(pageCache);

  for (const key of Object.keys($pageCache)) {
    delete $pageCache[key];
  }

  savePageCache($pageCache);
  pageCache.set($pageCache);

  console.log('[Store] Cleared all page cache');
}

/**
 * Clear detected boxes cache for current page
 */
export function clearDetectedBoxesCache() {
  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage) {
    return;
  }

  const cacheKey = buildImageCacheKey($folderPath, $currentImage);
  const $pageCache = get(pageCache);
  const entry = getPageCacheEntry($pageCache, cacheKey);

  if (entry) {
    entry.detectedBoxes = [];
    setPageCacheEntry($pageCache, cacheKey, entry);
    pageCache.set($pageCache);
    console.log('[Store] Cleared detected boxes cache for:', cacheKey);
  }
}

/**
 * Clear analysis cache for specific box on current page
 * @param {number} boxIndex - Index of the box
 */
export function clearBoxAnalysisCache(boxIndex) {
  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage || boxIndex == null) {
    return;
  }

  const cacheKey = buildImageCacheKey($folderPath, $currentImage);
  const $pageCache = get(pageCache);
  const entry = getPageCacheEntry($pageCache, cacheKey);

  if (entry && entry.analyses) {
    delete entry.analyses[boxIndex];
    setPageCacheEntry($pageCache, cacheKey, entry);
    pageCache.set($pageCache);
    console.log('[Store] Cleared analysis cache for box', boxIndex);
  }
}

/**
 * Clear translation cache for specific box on current page
 * @param {number} boxIndex - Index of the box
 */
export function clearBoxTranslationCache(boxIndex) {
  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage || boxIndex == null) {
    return;
  }

  const cacheKey = buildImageCacheKey($folderPath, $currentImage);
  const $pageCache = get(pageCache);
  const entry = getPageCacheEntry($pageCache, cacheKey);

  if (entry && entry.streamingTranslations) {
    delete entry.streamingTranslations[boxIndex];
    setPageCacheEntry($pageCache, cacheKey, entry);
    pageCache.set($pageCache);
    console.log('[Store] Cleared translation cache for box', boxIndex);
  }
}

/**
 * Clear word info from cache
 * @param {string} word - The word to clear
 */
export function clearWordInfoCache(word) {
  const $wordCache = get(wordCache);

  if ($wordCache[word]) {
    delete $wordCache[word];
    saveWordCache($wordCache);
    wordCache.set($wordCache);
    console.log('[Store] Cleared word cache:', word);
  }
}

/**
 * Check if current page has cached detected boxes
 * @returns {boolean}
 */
export function hasDetectedBoxesCache() {
  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage) {
    return false;
  }

  const cacheKey = buildImageCacheKey($folderPath, $currentImage);
  const $pageCache = get(pageCache);
  const entry = getPageCacheEntry($pageCache, cacheKey);

  return !!(entry && entry.detectedBoxes && entry.detectedBoxes.length > 0);
}

/**
 * Check if specific box has cached analysis
 * @param {number} boxIndex - Index of the box
 * @returns {boolean}
 */
export function hasBoxAnalysisCache(boxIndex) {
  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage || boxIndex == null) {
    return false;
  }

  const cacheKey = buildImageCacheKey($folderPath, $currentImage);
  const $pageCache = get(pageCache);
  const entry = getPageCacheEntry($pageCache, cacheKey);

  return !!(entry && entry.analyses && entry.analyses[boxIndex]);
}

/**
 * Check if specific box has cached translation
 * @param {number} boxIndex - Index of the box
 * @returns {boolean}
 */
export function hasBoxTranslationCache(boxIndex) {
  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage || boxIndex == null) {
    return false;
  }

  const cacheKey = buildImageCacheKey($folderPath, $currentImage);
  const $pageCache = get(pageCache);
  const entry = getPageCacheEntry($pageCache, cacheKey);

  return !!(entry && entry.streamingTranslations && entry.streamingTranslations[boxIndex]);
}

// ========== Token Selection Functions ==========

/**
 * Select a single token by index
 * @param {number} index - Token index to select
 */
export function selectToken(index) {
  selectedTokenIndices.update(set => {
    const newSet = new Set(set);
    newSet.add(index);
    return newSet;
  });
}

/**
 * Deselect a single token by index
 * @param {number} index - Token index to deselect
 */
export function deselectToken(index) {
  selectedTokenIndices.update(set => {
    const newSet = new Set(set);
    newSet.delete(index);
    return newSet;
  });
}

/**
 * Toggle token selection (select if unselected, deselect if selected)
 * @param {number} index - Token index to toggle
 */
export function toggleTokenSelection(index) {
  selectedTokenIndices.update(set => {
    const newSet = new Set(set);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    return newSet;
  });
}

/**
 * Clear all token selections
 */
export function clearTokenSelection() {
  selectedTokenIndices.set(new Set());
}

/**
 * Select a range of tokens from startIndex to endIndex (inclusive)
 * @param {number} startIndex - First token index
 * @param {number} endIndex - Last token index
 */
export function selectTokenRange(startIndex, endIndex) {
  selectedTokenIndices.update(set => {
    const newSet = new Set(set);
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    for (let i = start; i <= end; i++) {
      newSet.add(i);
    }
    return newSet;
  });
}
