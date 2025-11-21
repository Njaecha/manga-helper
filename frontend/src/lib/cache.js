/**
 * Frontend Caching System for Manga Helper
 *
 * Provides in-memory and localStorage-backed caching for:
 * - Per-page detection and analysis results
 * - Word info lookups
 * - User interactions and selections
 */

// Cache configuration
const CACHE_VERSION = '1.0.0';
const CACHE_EXPIRY_DAYS = 7;
const MAX_CACHE_SIZE_MB = 5; // localStorage limit consideration
const STORAGE_KEY_PAGE_CACHE = 'manga-page-cache';
const STORAGE_KEY_WORD_CACHE = 'manga-word-cache';
const STORAGE_KEY_CACHE_META = 'manga-cache-meta';

/**
 * Get current timestamp in milliseconds
 */
function now() {
  return Date.now();
}

/**
 * Check if cache entry is expired
 * @param {number} timestamp - Entry timestamp
 * @param {number} expiryDays - Days until expiry
 * @returns {boolean}
 */
function isExpired(timestamp, expiryDays = CACHE_EXPIRY_DAYS) {
  const expiryMs = expiryDays * 24 * 60 * 60 * 1000;
  return now() - timestamp > expiryMs;
}

/**
 * Estimate size of object in bytes (rough approximation)
 * @param {any} obj - Object to measure
 * @returns {number} Size in bytes
 */
function estimateSize(obj) {
  return new Blob([JSON.stringify(obj)]).size;
}

/**
 * Load data from localStorage with error handling
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if load fails
 * @returns {any}
 */
function loadFromStorage(key, defaultValue = {}) {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item);
  } catch (error) {
    console.warn(`[Cache] Failed to load ${key} from localStorage:`, error);
    return defaultValue;
  }
}

/**
 * Save data to localStorage with error handling
 * @param {string} key - Storage key
 * @param {any} data - Data to save
 * @returns {boolean} Success status
 */
function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn(`[Cache] Failed to save ${key} to localStorage:`, error);
    // Handle quota exceeded error
    if (error.name === 'QuotaExceededError') {
      console.warn('[Cache] localStorage quota exceeded, clearing old entries');
      clearExpiredEntries();
      // Try again after cleanup
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (retryError) {
        console.error('[Cache] Still failed after cleanup:', retryError);
        return false;
      }
    }
    return false;
  }
}

/**
 * Create cache metadata
 */
function createCacheMeta() {
  return {
    version: CACHE_VERSION,
    created: now(),
    lastAccessed: now(),
    totalEntries: 0,
    totalSizeBytes: 0
  };
}

/**
 * Load cache metadata
 */
function loadCacheMeta() {
  const meta = loadFromStorage(STORAGE_KEY_CACHE_META, null);
  if (!meta || meta.version !== CACHE_VERSION) {
    return createCacheMeta();
  }
  return meta;
}

/**
 * Save cache metadata
 */
function saveCacheMeta(meta) {
  meta.lastAccessed = now();
  saveToStorage(STORAGE_KEY_CACHE_META, meta);
}

// ============ PAGE CACHE ============

/**
 * Create empty page cache entry
 */
export function createPageCacheEntry() {
  return {
    detectedBoxes: [],
    customBoxes: [],
    analyses: {}, // keyed by box index: { "0": { ocr_tokens, hiragana_tokens, romaji_tokens }, ... }
    streamingTranslations: {}, // keyed by box index: { "0": { thinking, content }, ... }
    revealedTokens: {}, // keyed by token index: { "0": { ocr, hiragana, romaji }, ... }
    selectedBoxIndex: null,
    timestamp: now()
  };
}

/**
 * Load page cache from storage
 * @returns {Object} Page cache object
 */
export function loadPageCache() {
  const cache = loadFromStorage(STORAGE_KEY_PAGE_CACHE, {});

  // Clean expired entries
  const cleaned = {};
  let hasExpired = false;

  for (const [key, entry] of Object.entries(cache)) {
    if (entry.timestamp && !isExpired(entry.timestamp)) {
      cleaned[key] = entry;
    } else {
      hasExpired = true;
      console.log(`[Cache] Removed expired page cache entry: ${key}`);
    }
  }

  // Save cleaned cache if we removed anything
  if (hasExpired) {
    saveToStorage(STORAGE_KEY_PAGE_CACHE, cleaned);
  }

  return cleaned;
}

/**
 * Save page cache to storage
 * @param {Object} cache - Page cache object
 */
export function savePageCache(cache) {
  saveToStorage(STORAGE_KEY_PAGE_CACHE, cache);
}

/**
 * Get cache entry for specific page
 * @param {Object} cache - Page cache object
 * @param {string} imagePath - Full path to image
 * @returns {Object|null} Cache entry or null
 */
export function getPageCacheEntry(cache, imagePath) {
  if (!imagePath || !cache[imagePath]) {
    return null;
  }

  const entry = cache[imagePath];

  // Check if expired
  if (isExpired(entry.timestamp)) {
    console.log(`[Cache] Page cache expired: ${imagePath}`);
    delete cache[imagePath];
    savePageCache(cache);
    return null;
  }

  return entry;
}

/**
 * Set cache entry for specific page
 * @param {Object} cache - Page cache object
 * @param {string} imagePath - Full path to image
 * @param {Object} entry - Cache entry data
 */
export function setPageCacheEntry(cache, imagePath, entry) {
  if (!imagePath) return;

  entry.timestamp = now();
  cache[imagePath] = entry;
  savePageCache(cache);
}

/**
 * Update specific analysis result in page cache
 * @param {Object} cache - Page cache object
 * @param {string} imagePath - Full path to image
 * @param {number} boxIndex - Index of the box
 * @param {Object} analysisData - Analysis result data
 */
export function updatePageAnalysis(cache, imagePath, boxIndex, analysisData) {
  if (!imagePath || boxIndex == null) return;

  let entry = cache[imagePath];
  if (!entry) {
    entry = createPageCacheEntry();
  }

  entry.analyses[boxIndex] = {
    ...analysisData,
    timestamp: now()
  };

  setPageCacheEntry(cache, imagePath, entry);
}

/**
 * Update streaming translation in page cache
 * @param {Object} cache - Page cache object
 * @param {string} imagePath - Full path to image
 * @param {number} boxIndex - Index of the box
 * @param {Object} translationData - Translation data { thinking, content }
 */
export function updatePageTranslation(cache, imagePath, boxIndex, translationData) {
  if (!imagePath || boxIndex == null) return;

  let entry = cache[imagePath];
  if (!entry) {
    entry = createPageCacheEntry();
  }

  entry.streamingTranslations[boxIndex] = {
    ...translationData,
    timestamp: now()
  };

  setPageCacheEntry(cache, imagePath, entry);
}

/**
 * Clear cache for specific page
 * @param {Object} cache - Page cache object
 * @param {string} imagePath - Full path to image
 */
export function clearPageCacheEntry(cache, imagePath) {
  if (cache[imagePath]) {
    delete cache[imagePath];
    savePageCache(cache);
    console.log(`[Cache] Cleared page cache: ${imagePath}`);
  }
}

/**
 * Clear all page cache
 * @param {Object} cache - Page cache object
 */
export function clearAllPageCache(cache) {
  for (const key of Object.keys(cache)) {
    delete cache[key];
  }
  savePageCache(cache);
  console.log('[Cache] Cleared all page cache');
}

// ============ WORD INFO CACHE ============

/**
 * Load word info cache from storage
 * @returns {Object} Word cache object
 */
export function loadWordCache() {
  const cache = loadFromStorage(STORAGE_KEY_WORD_CACHE, {});

  // Clean expired entries
  const cleaned = {};
  let hasExpired = false;

  for (const [word, entry] of Object.entries(cache)) {
    if (entry.timestamp && !isExpired(entry.timestamp)) {
      cleaned[word] = entry;
    } else {
      hasExpired = true;
      console.log(`[Cache] Removed expired word cache entry: ${word}`);
    }
  }

  // Save cleaned cache if we removed anything
  if (hasExpired) {
    saveToStorage(STORAGE_KEY_WORD_CACHE, cleaned);
  }

  return cleaned;
}

/**
 * Save word cache to storage
 * @param {Object} cache - Word cache object
 */
export function saveWordCache(cache) {
  saveToStorage(STORAGE_KEY_WORD_CACHE, cache);
}

/**
 * Get word info from cache
 * @param {Object} cache - Word cache object
 * @param {string} word - The word to look up
 * @returns {Object|null} Cached word info or null
 */
export function getWordCacheEntry(cache, word) {
  if (!word || !cache[word]) {
    return null;
  }

  const entry = cache[word];

  // Check if expired
  if (isExpired(entry.timestamp)) {
    console.log(`[Cache] Word cache expired: ${word}`);
    delete cache[word];
    saveWordCache(cache);
    return null;
  }

  console.log(`[Cache] Word cache hit: ${word}`);
  return entry.data;
}

/**
 * Set word info in cache
 * @param {Object} cache - Word cache object
 * @param {string} word - The word
 * @param {Object} data - Word info data
 */
export function setWordCacheEntry(cache, word, data) {
  if (!word) return;

  cache[word] = {
    data,
    timestamp: now()
  };

  saveWordCache(cache);
  console.log(`[Cache] Word cached: ${word}`);
}

/**
 * Clear word from cache
 * @param {Object} cache - Word cache object
 * @param {string} word - The word to clear
 */
export function clearWordCacheEntry(cache, word) {
  if (cache[word]) {
    delete cache[word];
    saveWordCache(cache);
    console.log(`[Cache] Cleared word cache: ${word}`);
  }
}

/**
 * Clear all word cache
 * @param {Object} cache - Word cache object
 */
export function clearAllWordCache(cache) {
  for (const key of Object.keys(cache)) {
    delete cache[key];
  }
  saveWordCache(cache);
  console.log('[Cache] Cleared all word cache');
}

// ============ CACHE MANAGEMENT ============

/**
 * Clear expired entries from all caches
 */
export function clearExpiredEntries() {
  console.log('[Cache] Clearing expired entries...');

  // Reload caches (this automatically cleans expired entries)
  loadPageCache();
  loadWordCache();

  console.log('[Cache] Expired entries cleared');
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  const pageCache = loadPageCache();
  const wordCache = loadWordCache();

  const pageCacheSize = estimateSize(pageCache);
  const wordCacheSize = estimateSize(wordCache);
  const totalSize = pageCacheSize + wordCacheSize;

  return {
    pages: {
      count: Object.keys(pageCache).length,
      sizeBytes: pageCacheSize,
      sizeMB: (pageCacheSize / 1024 / 1024).toFixed(2)
    },
    words: {
      count: Object.keys(wordCache).length,
      sizeBytes: wordCacheSize,
      sizeMB: (wordCacheSize / 1024 / 1024).toFixed(2)
    },
    total: {
      sizeBytes: totalSize,
      sizeMB: (totalSize / 1024 / 1024).toFixed(2)
    }
  };
}

/**
 * Clear all caches (nuclear option)
 */
export function clearAllCaches() {
  console.log('[Cache] Clearing all caches...');

  localStorage.removeItem(STORAGE_KEY_PAGE_CACHE);
  localStorage.removeItem(STORAGE_KEY_WORD_CACHE);
  localStorage.removeItem(STORAGE_KEY_CACHE_META);

  console.log('[Cache] All caches cleared');
}

/**
 * Build full image path for cache key
 * @param {string} folderPath - Folder path
 * @param {string} imageName - Image filename
 * @returns {string} Full path
 */
export function buildImageCacheKey(folderPath, imageName) {
  if (!folderPath || !imageName) return '';

  // Normalize path separators
  const normalized = folderPath.replace(/\\/g, '/');
  const hasTrailingSlash = normalized.endsWith('/');

  return hasTrailingSlash ? `${normalized}${imageName}` : `${normalized}/${imageName}`;
}

// Initialize cache metadata
let meta = loadCacheMeta();
saveCacheMeta(meta);

console.log('[Cache] Cache system initialized', {
  version: CACHE_VERSION,
  expiryDays: CACHE_EXPIRY_DAYS
});
