<script>
  import { onMount } from 'svelte';
  import { listModels } from '../lib/ollama.js';
  import { getOcrContext, getTranslationContext, getSelectedTokensContext, getCurrentPageImage } from '../lib/chatStore.js';

  export let onSend;
  export let disabled = false;
  export let currentModel = 'llama3.2';
  export let onModelChange;

  let message = '';
  let textarea;
  let availableModels = [];
  let loadingModels = false;
  let showModelSelector = false;
  let showContextMenu = false;
  let attachedImages = [];

  onMount(async () => {
    loadAvailableModels();

    // Auto-focus textarea
    if (textarea) {
      textarea.focus();
    }
  });

  async function loadAvailableModels() {
    try {
      loadingModels = true;
      const models = await listModels();
      availableModels = models.map(m => m.name);

      // If current model isn't in the list, add it
      if (!availableModels.includes(currentModel)) {
        availableModels = [currentModel, ...availableModels];
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      // Fallback to common models
      availableModels = ['llama3.2', 'qwen2.5', 'mistral'];
    } finally {
      loadingModels = false;
    }
  }

  function handleSubmit() {
    if (!message.trim() || disabled) return;

    // Pass message and images (if any) to parent
    onSend(message.trim(), attachedImages.length > 0 ? attachedImages : null);
    message = '';
    attachedImages = [];

    // Reset textarea height
    if (textarea) {
      textarea.style.height = 'auto';
    }
  }

  function handleKeyDown(event) {
    // Enter without Shift = send
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  function handleInsertOcr() {
    const ocr = getOcrContext();
    if (ocr) {
      if (message.trim()) {
        message = `${message}\n\nJapanese: ${ocr}`;
      } else {
        message = `Japanese: ${ocr}`;
      }
      autoResizeTextarea();
    }
    showContextMenu = false;
  }

  function handleInsertTranslation() {
    const translation = getTranslationContext();
    if (translation) {
      if (message.trim()) {
        message = `${message}\n\nTranslation: ${translation}`;
      } else {
        message = `Translation: ${translation}`;
      }
      autoResizeTextarea();
    }
    showContextMenu = false;
  }

  function handleInsertSelectedTokens() {
    const selectedTokens = getSelectedTokensContext();
    if (selectedTokens) {
      if (message.trim()) {
        message = `${message}\n\nSelected Text: ${selectedTokens}`;
      } else {
        message = `Selected Text: ${selectedTokens}`;
      }
      autoResizeTextarea();
    }
    showContextMenu = false;
  }

  function handleAttachPageImage() {
    const imageUrl = getCurrentPageImage();
    if (imageUrl && !attachedImages.includes(imageUrl)) {
      attachedImages = [...attachedImages, imageUrl];
    }
    showContextMenu = false;
  }

  function removeAttachment(index) {
    attachedImages = attachedImages.filter((_, i) => i !== index);
  }

  function autoResizeTextarea() {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
      textarea.focus();
    }
  }

  function handleModelSelect(modelName) {
    if (onModelChange) {
      onModelChange(modelName);
    }
    showModelSelector = false;
  }

  // Auto-resize textarea as user types
  function handleInput() {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }
</script>

<div class="border-t border-border-primary bg-bg-tertiary p-2 flex flex-col gap-2">
  <!-- Toolbar -->
  <div class="flex items-center gap-2">
    <!-- Model selector -->
    <div class="relative flex-1">
      <button
        class="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-surface border border-border-primary rounded-md text-text-secondary text-xs cursor-pointer transition-all hover:bg-bg-primary hover:border-border-secondary disabled:opacity-50 disabled:cursor-not-allowed w-full"
        on:click={() => showModelSelector = !showModelSelector}
        disabled={disabled}
        title="Select model"
      >
        <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
        <span class="flex-1 text-left font-medium truncate">{currentModel}</span>
        <svg class="w-4 h-4 opacity-60 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>

      {#if showModelSelector}
        <div class="absolute bottom-full left-0 mb-1 bg-bg-surface border border-border-primary rounded-md shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
          {#if loadingModels}
            <div class="px-3 py-2 text-xs opacity-70">Loading models...</div>
          {:else if availableModels.length > 0}
            {#each availableModels as model}
              <button
                class="w-full px-3 py-2 text-xs text-left bg-transparent border-none text-text-secondary cursor-pointer transition-colors hover:bg-bg-primary"
                class:bg-accent-blue={model === currentModel}
                class:text-white={model === currentModel}
                class:font-medium={model === currentModel}
                on:click={() => handleModelSelect(model)}
              >
                {model}
              </button>
            {/each}
          {:else}
            <div class="px-3 py-2 text-xs opacity-70">No models available</div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Context menu button -->
    <div class="relative">
      <button
        class="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-surface border border-border-primary rounded-md text-text-secondary text-xs font-medium cursor-pointer transition-all hover:bg-accent-blue hover:border-accent-blue hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={() => showContextMenu = !showContextMenu}
        disabled={disabled}
        title="Insert context"
      >
        <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span>Context</span>
        <svg class="w-3.5 h-3.5 opacity-60 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>

      {#if showContextMenu}
        <div class="absolute bottom-full right-0 mb-1 bg-bg-surface border border-border-primary rounded-md shadow-lg z-50 min-w-[220px]">
          <button
            class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-transparent border-none text-text-secondary hover:bg-bg-primary cursor-pointer transition-colors"
            on:click={handleInsertOcr}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Insert OCR Text
          </button>
          <button
            class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-transparent border-none text-text-secondary hover:bg-bg-primary cursor-pointer transition-colors"
            on:click={handleInsertTranslation}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            Insert Translation
          </button>
          <button
            class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-transparent border-none text-text-secondary hover:bg-bg-primary cursor-pointer transition-colors"
            on:click={handleInsertSelectedTokens}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Insert Selected Tokens
          </button>
          <button
            class="w-full flex items-center gap-2 px-3 py-2 text-xs text-left bg-transparent border-none text-text-secondary hover:bg-bg-primary cursor-pointer transition-colors"
            on:click={handleAttachPageImage}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Attach Page Image
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Attached images preview -->
  {#if attachedImages.length > 0}
    <div class="flex flex-wrap gap-2">
      {#each attachedImages as imageUrl, idx}
        <div class="relative group">
          <img
            src={imageUrl}
            alt="Attached"
            class="h-16 w-auto rounded border border-border-primary object-cover"
          />
          <button
            class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none"
            on:click={() => removeAttachment(idx)}
            title="Remove"
          >
            ×
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Textarea and send button -->
  <div class="flex gap-2 items-end">
    <textarea
      bind:this={textarea}
      bind:value={message}
      on:keydown={handleKeyDown}
      on:input={handleInput}
      placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
      disabled={disabled}
      rows="1"
      class="flex-1 px-2.5 py-1 bg-bg-surface border border-border-primary rounded-lg text-text-primary text-sm resize-none min-h-[38px] max-h-[120px] leading-relaxed transition-colors focus:outline-none focus:border-accent-blue focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] disabled:opacity-60 disabled:cursor-not-allowed placeholder:text-text-tertiary placeholder:opacity-60"
    ></textarea>

    <button
      class="shrink-0 w-[38px] h-[38px] p-0 bg-accent-blue border-none rounded-lg text-white cursor-pointer transition-all flex items-center justify-center hover:bg-blue-600 hover:-translate-y-px hover:shadow-md active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      on:click={handleSubmit}
      disabled={disabled || !message.trim()}
      title="Send message (Enter)"
    >
      <svg class="w-4.5 h-4.5 shrink-0 m-1.5 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    </button>
  </div>
</div>
