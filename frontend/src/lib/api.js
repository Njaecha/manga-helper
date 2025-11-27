import axios from 'axios';
import { get } from 'svelte/store';
import { wordCache } from './store.js';
import { getWordCacheEntry, setWordCacheEntry } from './cache.js';

// Get base URL from environment variable or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds for OCR/analysis operations
  headers: {
    'Content-Type': 'application/json'
  }
});

// Error handler
function handleError(error, context = '') {
  console.error(`API Error ${context}:`, error);
  const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
  throw new Error(message);
}

// ========== REAL API ENDPOINTS ==========

/**
 * Detect speech bubbles in an image
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<{boxes: Array<{x: number, y: number, w: number, h: number}>}>}
 */
export async function detectBubbles(imagePath) {
  try {
    const response = await api.post('/detect', { image: imagePath });
    return response.data;
  } catch (error) {
    handleError(error, 'detectBubbles');
  }
}

/**
 * Analyze a speech bubble (OCR + tokenization)
 * @param {string} imagePath - Path to the image file
 * @param {{x: number, y: number, w: number, h: number}} box - Bounding box coordinates
 * @returns {Promise<{ocr_text: string, ocr_tokens: string[], hiragana_tokens: string[], romaji_tokens: string[]}>}
 */
export async function analyzeBubble(imagePath, box) {
  try {
    const response = await api.post('/analyze', { image: imagePath, box });
    return response.data;
  } catch (error) {
    handleError(error, 'analyzeBubble');
  }
}

/**
 * Analyze multiple speech bubbles in order (OCR + tokenization)
 * @param {string} imagePath - Path to the image file
 * @param {Array<{x: number, y: number, w: number, h: number}>} boxes - Array of bounding boxes in selection order
 * @returns {Promise<{ocr_tokens: Array, hiragana_tokens: Array, romaji_tokens: Array, bubbleBreakdown: Array}>}
 */
export async function analyzeMultipleBubbles(imagePath, boxes) {
  try {
    const response = await api.post('/analyze-multiple', { image: imagePath, boxes });
    return response.data;
  } catch (error) {
    handleError(error, 'analyzeMultipleBubbles');
  }
}

/**
 * Get info for a given word in context of the image
 * @param {string} imagePath - Path to the image file
 * @param {string} word - Word
 * @returns {Promise<{info: string}>}
 */
export async function wordInfo(imagePath, word) {
  try {
    // Check cache first
    const $wordCache = get(wordCache);
    const cached = getWordCacheEntry($wordCache, word);

    if (cached) {
      console.log('[API] Word info cache hit:', word);
      return cached;
    }

    console.log('[API] Word info cache miss, fetching:', word);
    const response = await api.post('/word', { image: imagePath, word: word });

    // Cache the result
    setWordCacheEntry($wordCache, word, response.data);
    wordCache.set($wordCache);

    return response.data;
  } catch (error) {
    handleError(error, 'wordInfo');
  }
}

/**
 * Stream translation from LLM (with thinking enabled)
 * @param {string} imagePath - Path to the image file
 * @param {{x: number, y: number, w: number, h: number}} box - Bounding box coordinates
 * @param {string} ocrText - OCR'd Japanese text to translate
 * @param {function(string): void} onChunk - Callback for each chunk of streamed text
 * @param {function(Error): void} onError - Error callback
 * @returns {Promise<void>}
 */
export async function streamTranslation(imagePath, box, ocrText, onChunk, onError) {
  try {
    const response = await fetch(`${API_BASE_URL}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: imagePath,
        box: box,
        ocr_text: ocrText
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get the reader from the response body
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ''; // Buffer for incomplete lines

    // Read the stream
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (SSE format: lines ending with \n\n)
      const lines = buffer.split('\n\n');

      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      // Process complete lines
      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          try {
            const jsonStr = line.trim().substring(6); // Remove 'data: ' prefix
            const data = JSON.parse(jsonStr);

            // Pass parsed object {type, text} to callback
            onChunk(data);
          } catch (parseError) {
            console.warn('Failed to parse chunk:', line, parseError);
          }
        }
      }
    }
  } catch (error) {
    console.error('Stream translation error:', error);
    if (onError) {
      onError(error);
    } else {
      throw error;
    }
  }
}

/**
 * Stream translation from LLM for multiple bubbles (with thinking enabled)
 * @param {string} imagePath - Path to the image file
 * @param {Array<{x: number, y: number, w: number, h: number}>} boxes - Array of bounding boxes in selection order
 * @param {string[]} ocrTexts - Array of OCR'd Japanese texts to translate
 * @param {function(string): void} onChunk - Callback for each chunk of streamed text
 * @param {function(Error): void} onError - Error callback
 * @returns {Promise<void>}
 */
export async function streamTranslationMultiple(imagePath, boxes, ocrTexts, onChunk, onError) {
  try {
    const response = await fetch(`${API_BASE_URL}/translate-multiple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: imagePath,
        boxes: boxes,
        ocr_texts: ocrTexts
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get the reader from the response body
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ''; // Buffer for incomplete lines

    // Read the stream
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (SSE format: lines ending with \n\n)
      const lines = buffer.split('\n\n');

      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      // Process complete lines
      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          try {
            const jsonStr = line.trim().substring(6); // Remove 'data: ' prefix
            const data = JSON.parse(jsonStr);

            // Pass parsed object {type, text} to callback
            onChunk(data);
          } catch (parseError) {
            console.warn('Failed to parse chunk:', line, parseError);
          }
        }
      }
    }
  } catch (error) {
    console.error('Stream translation multiple error:', error);
    if (onError) {
      onError(error);
    } else {
      throw error;
    }
  }
}

// ========== REAL API ENDPOINTS (NEWLY IMPLEMENTED) ==========

/**
 * Load images from a folder path
 * @param {string} folderPath - Path to the folder containing images
 * @returns {Promise<{images: string[]}>}
 */
export async function loadFolder(folderPath) {
  try {
    const response = await api.post('/api/load-folder', { folder_path: folderPath });
    return response.data;
  } catch (error) {
    handleError(error, 'loadFolder');
  }
}

/**
 * Get image URL/path for display
 * @param {string} folderPath - Folder containing the image
 * @param {string} filename - Image filename
 * @returns {string} URL or path to the image
 */
export function getImageUrl(folderPath, filename) {
  // Return placeholder if no real path
  if (!folderPath || folderPath === '') {
    return `/page1.jpg`; // Default placeholder in public folder
  }

  // Construct full path to image file
  const fullPath = `${folderPath}${folderPath.endsWith('/') || folderPath.endsWith('\\') ? '' : '/'}${filename}`;

  // Backend endpoint serves the image
  return `${API_BASE_URL}/api/image?path=${encodeURIComponent(fullPath)}`;
}

/**
 * Get thumbnail URL for image preview (carousel display)
 * @param {string} folderPath - Folder containing the image
 * @param {string} filename - Image filename
 * @param {number} width - Maximum width for thumbnail (default: 120)
 * @param {number} height - Maximum height for thumbnail (default: 160)
 * @returns {string} URL to the thumbnail
 */
export function getThumbnailUrl(folderPath, filename, width = 120, height = 160) {
  // Return placeholder if no real path
  if (!folderPath || folderPath === '') {
    return `/page1.jpg`; // Default placeholder in public folder
  }

  // Construct full path to image file
  const fullPath = `${folderPath}${folderPath.endsWith('/') || folderPath.endsWith('\\') ? '' : '/'}${filename}`;

  // Backend endpoint generates and serves the thumbnail
  return `${API_BASE_URL}/api/thumbnail?path=${encodeURIComponent(fullPath)}&width=${width}&height=${height}`;
}

/**
 * Save user translation to backend
 * @param {string} imageName - Name of the image file
 * @param {number} boxIndex - Index of the speech bubble
 * @param {string} marker - User-defined marker/number for the bubble
 * @param {string} translation - User's translation text
 * @param {string} originalText - OCR'd text
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function saveTranslation(imageName, boxIndex, marker, translation, originalText) {
  try {
    const response = await api.post('/api/translations', {
      image_name: imageName,
      box_index: boxIndex,
      marker: marker || '',
      translation: translation,
      original_text: originalText
    });
    return response.data;
  } catch (error) {
    handleError(error, 'saveTranslation');
  }
}

/**
 * Get saved translations for an image
 * @param {string} imageName - Name of the image file
 * @returns {Promise<Object>} Translations object {boxIndex: {marker, translation}}
 */
export async function getTranslations(imageName) {
  try {
    const response = await api.get(`/api/translations/${encodeURIComponent(imageName)}`);
    return response.data;
  } catch (error) {
    // If no translations found, return empty object instead of throwing
    if (error.response?.status === 404) {
      return {};
    }
    handleError(error, 'getTranslations');
  }
}

// ========== EXPORT/IMPORT FUNCTIONALITY ==========

/**
 * Export translations to JSON file
 * @param {Object} translations - All translations data
 */
export function exportTranslations(translations) {
  const dataStr = JSON.stringify(translations, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `manga-translations-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import translations from JSON file
 * @param {File} file - JSON file to import
 * @returns {Promise<Object>} Parsed translations object
 */
export async function importTranslations(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const translations = JSON.parse(e.target.result);
        resolve(translations);
      } catch (error) {
        reject(new Error('Invalid JSON file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

// ========== HEALTH CHECK ==========

/**
 * Check if backend is available
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth() {
  try {
    await api.get('/health', { timeout: 5000 });
    return true;
  } catch (error) {
    console.warn('Backend health check failed:', error.message);
    return false;
  }
}

export default api;
