/**
 * Chat Store
 * State management for multi-tab chat conversations
 */

import { writable, derived, get } from 'svelte/store';
import { analysisResult, streamingTranslation, folderPath, currentImage, selectedTokenIndices } from './store.js';
import { getImageUrl } from './api.js';

// Storage key for localStorage persistence
const STORAGE_KEY = 'manga-chat-history';
const MAX_TABS = 5;

/**
 * Generate a unique ID for chat tabs
 */
function generateId() {
  return `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new empty chat tab
 */
function createNewTab(title = null, existingTabCount = 0) {
  return {
    id: generateId(),
    title: title || `Chat ${existingTabCount + 1}`,
    messages: [],
    model: 'llama3.2', // Default model
    isStreaming: false,
    streamingContent: '',
    streamingThinking: '',
    createdAt: Date.now()
  };
}

/**
 * Load chat history from localStorage
 */
function loadChatHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Ensure we have at least one tab
      if (data.tabs && data.tabs.length > 0) {
        return {
          tabs: data.tabs,
          activeTabId: data.activeTabId || data.tabs[0].id
        };
      }
    }
  } catch (error) {
    console.error('Failed to load chat history:', error);
  }

  // Default: one empty tab
  const defaultTab = createNewTab('Chat 1', 0);
  return {
    tabs: [defaultTab],
    activeTabId: defaultTab.id
  };
}

/**
 * Save chat history to localStorage
 */
function saveChatHistory(tabs, activeTabId) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tabs,
      activeTabId,
      savedAt: Date.now()
    }));
  } catch (error) {
    console.error('Failed to save chat history:', error);
  }
}

// Initialize stores
const initialData = loadChatHistory();
export const chatTabs = writable(initialData.tabs);
export const activeChatId = writable(initialData.activeTabId);

// Derived store for active tab
export const activeChat = derived(
  [chatTabs, activeChatId],
  ([$chatTabs, $activeChatId]) => {
    return $chatTabs.find(tab => tab.id === $activeChatId) || $chatTabs[0];
  }
);

// Auto-save to localStorage whenever tabs or active tab changes
chatTabs.subscribe($tabs => {
  const $activeId = get(activeChatId);
  saveChatHistory($tabs, $activeId);
});

activeChatId.subscribe($activeId => {
  const $tabs = get(chatTabs);
  saveChatHistory($tabs, $activeId);
});

/**
 * Create a new chat tab
 */
export function createChatTab(title = null) {
  const $tabs = get(chatTabs);

  if ($tabs.length >= MAX_TABS) {
    console.warn(`Maximum ${MAX_TABS} tabs reached`);
    return null;
  }

  const newTab = createNewTab(title, $tabs.length);
  chatTabs.update(tabs => [...tabs, newTab]);
  activeChatId.set(newTab.id);

  return newTab.id;
}

/**
 * Delete a chat tab
 */
export function deleteChatTab(tabId) {
  const $tabs = get(chatTabs);

  // Don't delete the last tab
  if ($tabs.length <= 1) {
    // Just clear messages instead
    clearChatMessages(tabId);
    return;
  }

  const tabIndex = $tabs.findIndex(tab => tab.id === tabId);
  if (tabIndex === -1) return;

  // If deleting active tab, switch to another tab
  if (get(activeChatId) === tabId) {
    const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 1;
    activeChatId.set($tabs[newActiveIndex].id);
  }

  chatTabs.update(tabs => tabs.filter(tab => tab.id !== tabId));
}

/**
 * Switch to a different tab
 */
export function switchToTab(tabId) {
  const $tabs = get(chatTabs);
  const tab = $tabs.find(t => t.id === tabId);
  if (tab) {
    activeChatId.set(tabId);
  }
}

/**
 * Rename a chat tab
 */
export function renameTab(tabId, newTitle) {
  chatTabs.update(tabs => {
    return tabs.map(tab =>
      tab.id === tabId ? { ...tab, title: newTitle } : tab
    );
  });
}

/**
 * Add a message to a chat tab
 */
export function addMessage(tabId, role, content, images = null, thinking = null) {
  chatTabs.update(tabs => {
    return tabs.map(tab => {
      if (tab.id === tabId) {
        const message = {
          role,
          content,
          timestamp: Date.now()
        };

        // Add images if provided
        if (images && images.length > 0) {
          message.images = images;
        }

        // Add thinking if provided (for assistant messages)
        if (thinking) {
          message.thinking = thinking;
        }

        return {
          ...tab,
          messages: [...tab.messages, message]
        };
      }
      return tab;
    });
  });
}

/**
 * Start streaming for a tab
 */
export function startStreaming(tabId) {
  chatTabs.update(tabs => {
    return tabs.map(tab =>
      tab.id === tabId
        ? { ...tab, isStreaming: true, streamingContent: '', streamingThinking: '' }
        : tab
    );
  });
}

/**
 * Append streaming content
 */
export function appendStreamingContent(tabId, chunk) {
  chatTabs.update(tabs => {
    return tabs.map(tab =>
      tab.id === tabId
        ? { ...tab, streamingContent: tab.streamingContent + chunk }
        : tab
    );
  });
}

/**
 * Append streaming thinking content
 */
export function appendStreamingThinking(tabId, chunk) {
  chatTabs.update(tabs => {
    return tabs.map(tab =>
      tab.id === tabId
        ? { ...tab, streamingThinking: tab.streamingThinking + chunk }
        : tab
    );
  });
}

/**
 * End streaming and save as message
 */
export function endStreaming(tabId) {
  chatTabs.update(tabs => {
    return tabs.map(tab => {
      if (tab.id === tabId && tab.isStreaming) {
        const finalMessage = {
          role: 'assistant',
          content: tab.streamingContent,
          timestamp: Date.now()
        };

        // Include thinking if present
        if (tab.streamingThinking) {
          finalMessage.thinking = tab.streamingThinking;
        }

        return {
          ...tab,
          messages: [...tab.messages, finalMessage],
          isStreaming: false,
          streamingContent: '',
          streamingThinking: ''
        };
      }
      return tab;
    });
  });
}

/**
 * Handle streaming error
 */
export function handleStreamingError(tabId, error) {
  chatTabs.update(tabs => {
    return tabs.map(tab => {
      if (tab.id === tabId) {
        const errorMessage = {
          role: 'assistant',
          content: `Error: ${error.message || 'Failed to get response'}`,
          timestamp: Date.now(),
          isError: true
        };
        return {
          ...tab,
          messages: [...tab.messages, errorMessage],
          isStreaming: false,
          streamingContent: ''
        };
      }
      return tab;
    });
  });
}

/**
 * Clear all messages in a tab
 */
export function clearChatMessages(tabId) {
  chatTabs.update(tabs => {
    return tabs.map(tab =>
      tab.id === tabId
        ? { ...tab, messages: [], streamingContent: '', isStreaming: false }
        : tab
    );
  });
}

/**
 * Truncate messages up to a specific index (for resending)
 */
export function truncateMessagesAtIndex(tabId, messageIndex) {
  chatTabs.update(tabs => {
    return tabs.map(tab => {
      if (tab.id === tabId) {
        return {
          ...tab,
          messages: tab.messages.slice(0, messageIndex + 1),
          streamingContent: '',
          isStreaming: false
        };
      }
      return tab;
    });
  });
}

/**
 * Change the model for a tab
 */
export function setTabModel(tabId, modelName) {
  chatTabs.update(tabs => {
    return tabs.map(tab =>
      tab.id === tabId ? { ...tab, model: modelName } : tab
    );
  });
}

/**
 * Get context from current analysis
 */
export function getCurrentContext() {
  const $analysisResult = get(analysisResult);
  const $streamingTranslation = get(streamingTranslation);

  let context = '';

  if ($analysisResult.ocr_text) {
    context += `Japanese OCR: ${$analysisResult.ocr_text}\n`;
  }

  if ($streamingTranslation.content) {
    context += `Translation: ${$streamingTranslation.content}\n`;
  }

  return context.trim();
}

/**
 * Insert current translation context into a message
 */
export function insertContext() {
  return getCurrentContext();
}

/**
 * Get OCR text only
 */
export function getOcrContext() {
  const $analysisResult = get(analysisResult);
  return $analysisResult.ocr_text || '';
}

/**
 * Get translation only
 */
export function getTranslationContext() {
  const $streamingTranslation = get(streamingTranslation);
  return $streamingTranslation.content || '';
}

/**
 * Get current page image URL
 */
export function getCurrentPageImage() {
  const $folderPath = get(folderPath);
  const $currentImage = get(currentImage);

  if (!$folderPath || !$currentImage) return null;

  return getImageUrl($folderPath, $currentImage);
}

/**
 * Get selected tokens text only
 */
export function getSelectedTokensContext() {
  const $analysisResult = get(analysisResult);
  const $selectedIndices = get(selectedTokenIndices);

  if (!$selectedIndices || $selectedIndices.size === 0 || !$analysisResult.ocr_tokens) {
    return '';
  }

  // Get selected tokens in order
  const indices = Array.from($selectedIndices).sort((a, b) => a - b);
  const selectedText = indices
    .map(idx => {
      const token = $analysisResult.ocr_tokens[idx];
      return typeof token === 'string' ? token : token?.text || '';
    })
    .join('');

  return selectedText;
}

/**
 * Export chat history as JSON
 */
export function exportChatHistory() {
  const $tabs = get(chatTabs);
  const $activeId = get(activeChatId);

  const data = {
    tabs: $tabs,
    activeTabId: $activeId,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `manga-chat-history-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import chat history from JSON file
 */
export async function importChatHistory(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        if (data.tabs && Array.isArray(data.tabs)) {
          chatTabs.set(data.tabs);

          if (data.activeTabId) {
            activeChatId.set(data.activeTabId);
          } else if (data.tabs.length > 0) {
            activeChatId.set(data.tabs[0].id);
          }

          resolve();
        } else {
          reject(new Error('Invalid chat history format'));
        }
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Clear all chat history
 */
export function clearAllChats() {
  const newTab = createNewTab('Chat 1', 0);
  chatTabs.set([newTab]);
  activeChatId.set(newTab.id);
}

export default {
  chatTabs,
  activeChatId,
  activeChat,
  createChatTab,
  deleteChatTab,
  switchToTab,
  renameTab,
  addMessage,
  startStreaming,
  appendStreamingContent,
  endStreaming,
  handleStreamingError,
  clearChatMessages,
  setTabModel,
  getCurrentContext,
  insertContext,
  exportChatHistory,
  importChatHistory,
  clearAllChats
};
