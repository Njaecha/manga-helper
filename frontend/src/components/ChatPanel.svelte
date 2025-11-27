<script>
  import { onMount } from 'svelte';
  import ChatMessages from './ChatMessages.svelte';
  import ChatInput from './ChatInput.svelte';
  import {
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
    truncateMessagesAtIndex,
    setTabModel,
    exportChatHistory,
    importChatHistory,
    clearAllChats
  } from '../lib/chatStore.js';
  import { streamChat, checkOllamaConnection } from '../lib/ollama.js';

  let isCollapsed = false;
  let editingTabId = null;
  let editingTitle = '';
  let ollamaConnected = true;
  let showMenu = false;
  let fileInput;

  onMount(async () => {
    // Check Ollama connection
    ollamaConnected = await checkOllamaConnection();
  });

  /**
   * Convert image URL to base64
   */
  async function imageUrlToBase64(url) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // Remove the data URL prefix to get just the base64 string
          const result = reader.result;
          if (typeof result === 'string') {
            const base64 = result.split(',')[1];
            resolve(base64);
          } else {
            reject(new Error('Failed to read image as data URL'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to convert image to base64:', error);
      return null;
    }
  }

  async function handleSendMessage(message, images = null) {
    const currentTab = $activeChat;
    if (!currentTab) return;

    // Add user message with images
    addMessage(currentTab.id, 'user', message, images);

    // Start streaming assistant response
    startStreaming(currentTab.id);

    // Prepare messages for Ollama - convert images to base64
    const messagesWithBase64 = [];

    for (const m of currentTab.messages) {
      const msg = { role: m.role, content: m.content };

      if (m.images && m.images.length > 0) {
        // Convert all images to base64
        const base64Images = await Promise.all(
          m.images.map(url => imageUrlToBase64(url))
        );
        // Filter out any failed conversions
        msg.images = base64Images.filter(img => img !== null);
      }

      messagesWithBase64.push(msg);
    }

    // Add the current message with images
    const currentMsg = { role: 'user', content: message };
    if (images && images.length > 0) {
      const base64Images = await Promise.all(
        images.map(url => imageUrlToBase64(url))
      );
      currentMsg.images = base64Images.filter(img => img !== null);
    }
    messagesWithBase64.push(currentMsg);

    try {
      await streamChat(
        currentTab.model,
        messagesWithBase64,
        (chunk) => {
          appendStreamingContent(currentTab.id, chunk);
        },
        (error) => {
          handleStreamingError(currentTab.id, error);
        },
        () => {
          endStreaming(currentTab.id);
        }
      );
    } catch (error) {
      handleStreamingError(currentTab.id, error);
    }
  }

  function handleCreateTab() {
    createChatTab();
  }

  function handleDeleteTab(tabId, event) {
    event.stopPropagation();

    const tab = $chatTabs.find(t => t.id === tabId);
    if (tab && tab.messages.length > 0) {
      if (!confirm(`Delete "${tab.title}"? This will remove all messages.`)) {
        return;
      }
    }

    deleteChatTab(tabId);
  }

  function handleSwitchTab(tabId) {
    if (editingTabId === tabId) return;
    switchToTab(tabId);
  }

  function startEditingTab(tabId, event) {
    event.stopPropagation();
    const tab = $chatTabs.find(t => t.id === tabId);
    if (tab) {
      editingTabId = tabId;
      editingTitle = tab.title;
    }
  }

  function finishEditingTab() {
    if (editingTabId && editingTitle.trim()) {
      renameTab(editingTabId, editingTitle.trim());
    }
    editingTabId = null;
    editingTitle = '';
  }

  function handleTitleKeydown(event) {
    if (event.key === 'Enter') {
      finishEditingTab();
    } else if (event.key === 'Escape') {
      editingTabId = null;
      editingTitle = '';
    }
  }

  function handleModelChange(modelName) {
    if ($activeChat) {
      setTabModel($activeChat.id, modelName);
    }
  }

  function handleClearChat() {
    if ($activeChat) {
      if (confirm('Clear all messages in this chat?')) {
        clearChatMessages($activeChat.id);
      }
    }
  }

  function handleExport() {
    exportChatHistory();
    showMenu = false;
  }

  function handleImportClick() {
    fileInput.click();
    showMenu = false;
  }

  async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      await importChatHistory(file);
      alert('Chat history imported successfully');
    } catch (error) {
      alert(`Failed to import: ${error.message}`);
    }

    // Reset file input
    event.target.value = '';
  }

  function handleClearAll() {
    if (confirm('Delete all chats and start fresh? This cannot be undone.')) {
      clearAllChats();
    }
    showMenu = false;
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
  }

  async function handleResendMessage(messageIndex) {
    const currentTab = $activeChat;
    if (!currentTab) return;

    // Get the message at the specified index (should be a user message)
    const messageToResend = currentTab.messages[messageIndex];
    if (!messageToResend || messageToResend.role !== 'user') return;

    // Truncate messages to only include up to (and including) this message
    truncateMessagesAtIndex(currentTab.id, messageIndex);

    // Start streaming assistant response
    startStreaming(currentTab.id);

    // Prepare messages for Ollama - convert images to base64
    const messagesWithBase64 = [];

    for (let i = 0; i <= messageIndex; i++) {
      const m = currentTab.messages[i];
      const msg = { role: m.role, content: m.content };

      if (m.images && m.images.length > 0) {
        // Convert all images to base64
        const base64Images = await Promise.all(
          m.images.map(url => imageUrlToBase64(url))
        );
        msg.images = base64Images.filter(img => img !== null);
      }

      messagesWithBase64.push(msg);
    }

    try {
      await streamChat(
        currentTab.model,
        messagesWithBase64,
        (chunk) => {
          appendStreamingContent(currentTab.id, chunk);
        },
        (error) => {
          handleStreamingError(currentTab.id, error);
        },
        () => {
          endStreaming(currentTab.id);
        }
      );
    } catch (error) {
      handleStreamingError(currentTab.id, error);
    }
  }
</script>

<div class="border border-border-primary rounded-lg bg-bg-surface transition-all duration-300" class:max-h-12={isCollapsed}>
  <!-- Header -->
  <div class="flex items-center justify-between px-1.5 py-0.5 bg-bg-tertiary border-b border-border-primary">
    <div class="flex items-center gap-2">
      <h3 class="text-sm font-semibold text-text-primary">AI Chat</h3>
      {#if !ollamaConnected}
        <span class="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/10 text-red-500">
          <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          Offline
        </span>
      {/if}
    </div>

    <div class="flex items-center gap-1">
      <!-- Menu button -->
      <div class="relative">
        <button
          class="w-7 h-7 p-0 flex items-center justify-center bg-transparent border-none text-text-secondary hover:bg-bg-primary hover:text-text-primary rounded cursor-pointer transition-all"
          on:click={() => showMenu = !showMenu}
          title="Menu"
        >
          <svg class="w-4.5 h-4.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {#if showMenu}
          <div class="absolute top-full right-0 mt-1 bg-bg-surface border border-border-primary rounded-md shadow-lg z-50 min-w-[200px]">
            <button class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-transparent border-none text-text-secondary hover:bg-bg-primary cursor-pointer transition-colors" on:click={handleClearChat}>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Current Chat
            </button>
            <button class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-transparent border-none text-text-secondary hover:bg-bg-primary cursor-pointer transition-colors" on:click={handleExport}>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export History
            </button>
            <button class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-transparent border-none text-text-secondary hover:bg-bg-primary cursor-pointer transition-colors" on:click={handleImportClick}>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import History
            </button>
            <div class="h-px bg-border-primary my-1"></div>
            <button class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-transparent border-none text-red-500 hover:bg-bg-primary cursor-pointer transition-colors" on:click={handleClearAll}>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Delete All Chats
            </button>
          </div>
        {/if}
      </div>

      <!-- Collapse button -->
      <button class="w-7 h-7 p-0 flex items-center justify-center bg-transparent border-none text-text-secondary hover:bg-bg-primary hover:text-text-primary rounded cursor-pointer transition-all" on:click={toggleCollapse} title={isCollapsed ? 'Expand' : 'Collapse'}>
        <svg class="w-4.5 h-4.5" viewBox="0 0 20 20" fill="currentColor">
          {#if isCollapsed}
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          {:else}
            <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
          {/if}
        </svg>
      </button>
    </div>
  </div>

  {#if !isCollapsed}
    <!-- Tab Bar -->
    <div class="bg-bg-secondary border-b border-border-primary overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-border-secondary scrollbar-track-transparent">
      <div class="flex px-2 pt-1 gap-1">
        {#each $chatTabs as tab}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="flex items-center gap-1.5 px-3 bg-bg-surface border border-border-primary border-b-0 rounded-t-md text-xs text-text-secondary cursor-pointer transition-all hover:bg-bg-tertiary whitespace-nowrap"
            class:bg-bg-secondary={tab.id === $activeChatId}
            class:text-text-primary={tab.id === $activeChatId}
            class:font-medium={tab.id === $activeChatId}
            class:border-b-2={tab.id === $activeChatId}
            class:border-b-accent-blue={tab.id === $activeChatId}
            on:click={() => handleSwitchTab(tab.id)}
          >
            {#if editingTabId === tab.id}
              <input
                type="text"
                class="w-20 px-1 py-0.5 bg-bg-primary border border-accent-blue rounded text-text-primary text-xs"
                bind:value={editingTitle}
                on:blur={finishEditingTab}
                on:keydown={handleTitleKeydown}
                autofocus
              />
            {:else}
              <span class="select-none max-w-[120px] overflow-hidden text-ellipsis" on:dblclick={(e) => startEditingTab(tab.id, e)}>
                {tab.title}
              </span>
              {#if $chatTabs.length > 1}
                <button
                  class="w-4 h-4 p-0 flex items-center justify-center bg-transparent border-none text-text-tertiary text-xl leading-none cursor-pointer rounded hover:bg-red-500 hover:text-white transition-all"
                  on:click={(e) => handleDeleteTab(tab.id, e)}
                  title="Close tab"
                >
                  ×
                </button>
              {/if}
            {/if}
          </div>
        {/each}

        {#if $chatTabs.length < 5}
          <button class="flex items-center justify-center px-2 bg-bg-surface border border-border-primary border-b-0 rounded-t-md text-base font-bold text-text-secondary cursor-pointer transition-all hover:bg-accent-blue hover:text-white hover:border-accent-blue min-w-8" on:click={handleCreateTab} title="New chat">
            +
          </button>
        {/if}
      </div>
    </div>

    <!-- Content -->
    {#if $activeChat}
      <ChatMessages
        messages={$activeChat.messages}
        isStreaming={$activeChat.isStreaming}
        streamingContent={$activeChat.streamingContent}
        streamingThinking={$activeChat.streamingThinking || ''}
        onResend={handleResendMessage}
      />

      <ChatInput
        onSend={handleSendMessage}
        disabled={$activeChat.isStreaming || !ollamaConnected}
        currentModel={$activeChat.model}
        onModelChange={handleModelChange}
      />
    {:else}
      <div class="flex flex-col items-center justify-center gap-4 p-8 min-h-[200px] text-text-tertiary">
        <p>No chat available</p>
        <button class="px-4 py-2 bg-accent-blue text-white rounded-md text-sm font-medium border-none cursor-pointer hover:bg-blue-600 transition-colors" on:click={handleCreateTab}>Create Chat</button>
      </div>
    {/if}
  {/if}
</div>

<!-- Hidden file input for import -->
<input
  type="file"
  accept=".json"
  bind:this={fileInput}
  on:change={handleImport}
  class="hidden"
/>
