/**
 * Utility functions for the manga helper application
 */

/**
 * Debounce a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle a function call
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Clamp a number between min and max values
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Format a file path for display (truncate if too long)
 * @param {string} path - File path
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Formatted path
 */
export function formatPath(path, maxLength = 50) {
  if (!path || path.length <= maxLength) return path;

  const halfLength = Math.floor(maxLength / 2) - 2;
  return path.slice(0, halfLength) + '...' + path.slice(-halfLength);
}

/**
 * Check if a point is inside a rectangle
 * @param {{x: number, y: number}} point - Point to check
 * @param {{x: number, y: number, w: number, h: number}} rect - Rectangle
 * @returns {boolean} True if point is inside rectangle
 */
export function isPointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

/**
 * Calculate distance between two points
 * @param {{x: number, y: number}} p1 - First point
 * @param {{x: number, y: number}} p2 - Second point
 * @returns {number} Distance
 */
export function distance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Normalize box coordinates (ensure width and height are positive)
 * @param {{x: number, y: number, w: number, h: number}} box - Box to normalize
 * @returns {{x: number, y: number, w: number, h: number}} Normalized box
 */
export function normalizeBox(box) {
  const normalized = { ...box };

  if (normalized.w < 0) {
    normalized.x += normalized.w;
    normalized.w = Math.abs(normalized.w);
  }

  if (normalized.h < 0) {
    normalized.y += normalized.h;
    normalized.h = Math.abs(normalized.h);
  }

  return normalized;
}

/**
 * Check if two boxes overlap
 * @param {{x: number, y: number, w: number, h: number}} box1 - First box
 * @param {{x: number, y: number, w: number, h: number}} box2 - Second box
 * @returns {boolean} True if boxes overlap
 */
export function boxesOverlap(box1, box2) {
  return !(
    box1.x + box1.w < box2.x ||
    box2.x + box2.w < box1.x ||
    box1.y + box1.h < box2.y ||
    box2.y + box2.h < box1.y
  );
}

/**
 * Save data to localStorage with error handling
 * @param {string} key - Storage key
 * @param {any} data - Data to store
 * @returns {boolean} Success status
 */
export function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    return false;
  }
}

/**
 * Load data from localStorage with error handling
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if not found
 * @returns {any} Loaded data or default value
 */
export function loadFromLocalStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return defaultValue;
  }
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format error message for display
 * @param {Error|string} error - Error object or message
 * @returns {string} Formatted error message
 */
export function formatError(error) {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return 'An unexpected error occurred';
}

/**
 * Check if a string is a valid file path
 * @param {string} path - Path to validate
 * @returns {boolean} True if valid
 */
export function isValidPath(path) {
  if (!path || typeof path !== 'string') return false;

  // Basic validation - allow common path formats
  // Windows: C:\path\to\folder or \\network\path
  // Unix: /path/to/folder
  const windowsPath = /^[a-zA-Z]:\\|^\\\\/;
  const unixPath = /^\//;

  return windowsPath.test(path) || unixPath.test(path);
}

/**
 * Extract filename from path
 * @param {string} path - Full path
 * @returns {string} Filename
 */
export function getFilename(path) {
  if (!path) return '';
  return path.split(/[\\/]/).pop();
}

/**
 * Get file extension
 * @param {string} filename - Filename
 * @returns {string} Extension (lowercase, without dot)
 */
export function getFileExtension(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * Check if file is an image based on extension
 * @param {string} filename - Filename to check
 * @returns {boolean} True if image file
 */
export function isImageFile(filename) {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  const ext = getFileExtension(filename);
  return imageExtensions.includes(ext);
}
