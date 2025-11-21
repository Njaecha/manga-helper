/**
 * Canvas utilities for drawing and manipulating boxes
 */

import { normalizeBox } from './utils.js';

/**
 * Drawing state manager for custom box creation
 */
export class BoxDrawer {
  constructor() {
    this.isDrawing = false;
    this.startPoint = null;
    this.currentBox = null;
  }

  /**
   * Start drawing a new box
   * @param {{x: number, y: number}} point - Starting point
   */
  startDrawing(point) {
    this.isDrawing = true;
    this.startPoint = { ...point };
    this.currentBox = {
      x: point.x,
      y: point.y,
      w: 0,
      h: 0
    };
  }

  /**
   * Update box dimensions while drawing
   * @param {{x: number, y: number}} point - Current mouse position
   * @returns {{x: number, y: number, w: number, h: number}|null} Current box or null
   */
  updateDrawing(point) {
    if (!this.isDrawing || !this.startPoint) return null;

    this.currentBox = {
      x: this.startPoint.x,
      y: this.startPoint.y,
      w: point.x - this.startPoint.x,
      h: point.y - this.startPoint.y
    };

    return this.currentBox;
  }

  /**
   * Finish drawing and return the normalized box
   * @param {number} minSize - Minimum box size to be valid (default: 10)
   * @returns {{x: number, y: number, w: number, h: number}|null} Completed box or null if too small
   */
  finishDrawing(minSize = 10) {
    if (!this.isDrawing || !this.currentBox) return null;

    this.isDrawing = false;

    // Normalize box (handle negative dimensions)
    const box = normalizeBox(this.currentBox);

    // Check if box is large enough
    if (box.w < minSize || box.h < minSize) {
      this.reset();
      return null;
    }

    this.reset();
    return box;
  }

  /**
   * Cancel current drawing
   */
  cancelDrawing() {
    this.reset();
  }

  /**
   * Reset drawer state
   */
  reset() {
    this.isDrawing = false;
    this.startPoint = null;
    this.currentBox = null;
  }

  /**
   * Get current drawing box (for preview)
   * @returns {{x: number, y: number, w: number, h: number}|null}
   */
  getCurrentBox() {
    return this.currentBox;
  }
}

/**
 * Box manipulation helper
 */
export class BoxManipulator {
  constructor() {
    this.selectedBox = null;
    this.dragOffset = null;
    this.resizeHandle = null;
  }

  /**
   * Check if point is near a box edge (for resizing)
   * @param {{x: number, y: number}} point - Point to check
   * @param {{x: number, y: number, w: number, h: number}} box - Box to check
   * @param {number} threshold - Distance threshold (default: 8)
   * @returns {string|null} Handle position ('nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w') or null
   */
  getResizeHandle(point, box, threshold = 8) {
    const handles = {
      nw: { x: box.x, y: box.y },
      ne: { x: box.x + box.w, y: box.y },
      sw: { x: box.x, y: box.y + box.h },
      se: { x: box.x + box.w, y: box.y + box.h },
      n: { x: box.x + box.w / 2, y: box.y },
      s: { x: box.x + box.w / 2, y: box.y + box.h },
      e: { x: box.x + box.w, y: box.y + box.h / 2 },
      w: { x: box.x, y: box.y + box.h / 2 }
    };

    for (const [handle, pos] of Object.entries(handles)) {
      const dist = Math.sqrt(
        Math.pow(point.x - pos.x, 2) + Math.pow(point.y - pos.y, 2)
      );
      if (dist <= threshold) {
        return handle;
      }
    }

    return null;
  }

  /**
   * Check if point is inside box (for dragging)
   * @param {{x: number, y: number}} point - Point to check
   * @param {{x: number, y: number, w: number, h: number}} box - Box to check
   * @returns {boolean}
   */
  isPointInBox(point, box) {
    return (
      point.x >= box.x &&
      point.x <= box.x + box.w &&
      point.y >= box.y &&
      point.y <= box.y + box.h
    );
  }

  /**
   * Start dragging a box
   * @param {{x: number, y: number}} point - Mouse position
   * @param {{x: number, y: number, w: number, h: number}} box - Box to drag
   */
  startDrag(point, box) {
    this.selectedBox = { ...box };
    this.dragOffset = {
      x: point.x - box.x,
      y: point.y - box.y
    };
  }

  /**
   * Update box position while dragging
   * @param {{x: number, y: number}} point - Current mouse position
   * @returns {{x: number, y: number, w: number, h: number}|null} Updated box or null
   */
  updateDrag(point) {
    if (!this.selectedBox || !this.dragOffset) return null;

    return {
      ...this.selectedBox,
      x: point.x - this.dragOffset.x,
      y: point.y - this.dragOffset.y
    };
  }

  /**
   * Start resizing a box
   * @param {string} handle - Resize handle position
   * @param {{x: number, y: number, w: number, h: number}} box - Box to resize
   */
  startResize(handle, box) {
    this.resizeHandle = handle;
    this.selectedBox = { ...box };
  }

  /**
   * Update box dimensions while resizing
   * @param {{x: number, y: number}} point - Current mouse position
   * @returns {{x: number, y: number, w: number, h: number}|null} Updated box or null
   */
  updateResize(point) {
    if (!this.resizeHandle || !this.selectedBox) return null;

    const box = { ...this.selectedBox };
    const handle = this.resizeHandle;

    // Update based on handle position
    if (handle.includes('n')) {
      const delta = point.y - box.y;
      box.y = point.y;
      box.h -= delta;
    }
    if (handle.includes('s')) {
      box.h = point.y - box.y;
    }
    if (handle.includes('w')) {
      const delta = point.x - box.x;
      box.x = point.x;
      box.w -= delta;
    }
    if (handle.includes('e')) {
      box.w = point.x - box.x;
    }

    // Normalize to handle negative dimensions
    return normalizeBox(box);
  }

  /**
   * Finish drag or resize operation
   */
  finish() {
    this.selectedBox = null;
    this.dragOffset = null;
    this.resizeHandle = null;
  }

  /**
   * Reset manipulator state
   */
  reset() {
    this.finish();
  }
}

/**
 * Get cursor style for resize handle
 * @param {string|null} handle - Handle position
 * @returns {string} CSS cursor value
 */
export function getCursorForHandle(handle) {
  const cursors = {
    nw: 'nw-resize',
    ne: 'ne-resize',
    sw: 'sw-resize',
    se: 'se-resize',
    n: 'n-resize',
    s: 's-resize',
    e: 'e-resize',
    w: 'w-resize'
  };
  return cursors[handle] || 'default';
}

/**
 * Calculate scale factor to fit image in container
 * @param {{width: number, height: number}} imageSize - Original image dimensions
 * @param {{width: number, height: number}} containerSize - Container dimensions
 * @returns {{scale: number, width: number, height: number}} Scaled dimensions
 */
export function calculateImageScale(imageSize, containerSize) {
  const scaleX = containerSize.width / imageSize.width;
  const scaleY = containerSize.height / imageSize.height;
  const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond original size

  return {
    scale,
    width: imageSize.width * scale,
    height: imageSize.height * scale
  };
}

/**
 * Convert screen coordinates to image coordinates
 * @param {{x: number, y: number}} point - Screen point
 * @param {number} scale - Image scale factor
 * @param {{x: number, y: number}} offset - Image offset in container
 * @returns {{x: number, y: number}} Image coordinates
 */
export function screenToImageCoords(point, scale, offset = { x: 0, y: 0 }) {
  return {
    x: (point.x - offset.x) / scale,
    y: (point.y - offset.y) / scale
  };
}

/**
 * Convert image coordinates to screen coordinates
 * @param {{x: number, y: number}} point - Image point
 * @param {number} scale - Image scale factor
 * @param {{x: number, y: number}} offset - Image offset in container
 * @returns {{x: number, y: number}} Screen coordinates
 */
export function imageToScreenCoords(point, scale, offset = { x: 0, y: 0 }) {
  return {
    x: point.x * scale + offset.x,
    y: point.y * scale + offset.y
  };
}

/**
 * Constrain box within image bounds
 * @param {{x: number, y: number, w: number, h: number}} box - Box to constrain
 * @param {{width: number, height: number}} imageBounds - Image dimensions
 * @returns {{x: number, y: number, w: number, h: number}} Constrained box
 */
export function constrainBoxToImage(box, imageBounds) {
  const constrained = { ...box };

  // Constrain position
  constrained.x = Math.max(0, Math.min(constrained.x, imageBounds.width - constrained.w));
  constrained.y = Math.max(0, Math.min(constrained.y, imageBounds.height - constrained.h));

  // Constrain size
  constrained.w = Math.min(constrained.w, imageBounds.width - constrained.x);
  constrained.h = Math.min(constrained.h, imageBounds.height - constrained.y);

  return constrained;
}
