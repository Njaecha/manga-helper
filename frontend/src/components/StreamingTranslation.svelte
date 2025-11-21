<script>
  import { streamingTranslation } from '../lib/store.js';
  import { onMount, afterUpdate } from 'svelte';

  let thinkingContainer;
  let shouldAutoScroll = true;
  let showThinking = false; // Thinking collapsed by default

  // Determine streaming phase
  $: isThinkingPhase = $streamingTranslation.isStreaming &&
                       $streamingTranslation.thinking &&
                       !$streamingTranslation.content;

  $: isTranslationPhase = !!$streamingTranslation.content;

  // Auto-open thinking during thinking phase, auto-close when translation starts
  $: if (isThinkingPhase) {
    showThinking = true;
  } else if (isTranslationPhase && !$streamingTranslation.isStreaming) {
    showThinking = false;
  }

  // Auto-scroll thinking section when new content arrives
  afterUpdate(() => {
    if (shouldAutoScroll && thinkingContainer && $streamingTranslation.isStreaming && isThinkingPhase) {
      thinkingContainer.scrollTop = thinkingContainer.scrollHeight;
    }
  });

  // Check if user has scrolled up in thinking (disable auto-scroll if they did)
  function handleScroll() {
    if (!thinkingContainer) return;
    const isScrolledToBottom =
      thinkingContainer.scrollHeight - thinkingContainer.scrollTop <= thinkingContainer.clientHeight + 50;
    shouldAutoScroll = isScrolledToBottom;
  }

  // Toggle thinking visibility
  function toggleThinking() {
    showThinking = !showThinking;
  }
</script>

<div class="streaming-translation">
  <div class="header">
    <h3 class="title">AI Translation</h3>

    <div class="header-controls">
      {#if $streamingTranslation.isStreaming}
        <div class="streaming-indicator">
          <div class="spinner"></div>
          <span>Streaming...</span>
        </div>
      {/if}

      <!-- Show/Hide Thinking button (only when thinking exists and not during thinking phase) -->
      {#if $streamingTranslation.thinking && !isThinkingPhase}
        <button class="btn thinking-btn" on:click={toggleThinking}>
          {showThinking ? 'Hide' : 'Show'} Thinking
        </button>
      {/if}
    </div>
  </div>

  <div class="content">
    {#if $streamingTranslation.error}
      <div class="error-state">
        <svg xmlns="http://www.w3.org/2000/svg" class="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="error-message">{$streamingTranslation.error}</span>
      </div>
    {:else if $streamingTranslation.thinking || $streamingTranslation.content || $streamingTranslation.isStreaming}

      <!-- Thinking Section (only show during thinking phase OR when user toggled it visible) -->
      {#if $streamingTranslation.thinking && (isThinkingPhase || showThinking)}
        <div class="thinking-section">
          <div class="thinking-label">AI Thinking Process</div>
          <div class="thinking-content" bind:this={thinkingContainer} on:scroll={handleScroll}>
            <div class="text thinking-text">
              {$streamingTranslation.thinking}
              {#if $streamingTranslation.isStreaming && !$streamingTranslation.content}
                <span class="cursor">▊</span>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- Content Section (Main Translation) - only show when content exists -->
      {#if $streamingTranslation.content}
        <div class="content-section">
          <div class="content-label">Translation</div>
          <div class="text content-text">
            {$streamingTranslation.content}
            {#if $streamingTranslation.isStreaming}
              <span class="cursor">▊</span>
            {/if}
          </div>
        </div>
      {/if}

    {:else}
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <span>No translation yet. Click "Translate" to start.</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .streaming-translation {
    border: 1px solid var(--color-border-primary);
    border-radius: 6px;
    background: var(--color-bg-surface);
    margin-bottom: 0.5rem;
    display: flex;
    flex-direction: column;
    max-height: 600px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.375rem 0.5rem;
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border-primary);
    flex-shrink: 0;
  }

  .title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .streaming-indicator {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-accent);
  }

  .spinner {
    width: 0.875rem;
    height: 0.875rem;
    border: 2px solid var(--color-border-primary);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 4px;
    border: 1px solid var(--color-border-primary);
    background: var(--color-bg-surface);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .content {
    padding: 0.5rem;
    min-height: 80px;
    position: relative;
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .text {
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--color-text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .cursor {
    display: inline-block;
    animation: blink 1s step-start infinite;
    color: var(--color-accent);
    font-weight: bold;
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    color: var(--color-text-tertiary);
    text-align: center;
    padding: 1.5rem 0.75rem;
    height: 100%;
    justify-content: center;
  }

  .empty-icon {
    width: 2rem;
    height: 2rem;
    opacity: 0.5;
  }

  .empty-state span {
    font-size: 0.75rem;
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-error);
    text-align: center;
    padding: 1.5rem 0.75rem;
    height: 100%;
    justify-content: center;
  }

  .error-icon {
    width: 2rem;
    height: 2rem;
  }

  .error-message {
    font-size: 0.75rem;
    font-weight: 500;
  }

  /* Thinking section styles - Dark Theme */
  .thinking-section {
    margin-bottom: 0.5rem;
    border: 1px solid #374151;
    border-radius: 4px;
    overflow: hidden;
    background: #1f2937;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    max-height: 200px;
  }

  .thinking-label {
    padding: 0.375rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: #d1d5db;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    background: #374151;
    flex-shrink: 0;
  }

  .thinking-content {
    padding: 0.5rem;
    background: #111827;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  /* Custom scrollbar for thinking section */
  .thinking-content::-webkit-scrollbar {
    width: 6px;
  }

  .thinking-content::-webkit-scrollbar-track {
    background: #1f2937;
    border-radius: 3px;
  }

  .thinking-content::-webkit-scrollbar-thumb {
    background: #374151;
    border-radius: 3px;
  }

  .thinking-content::-webkit-scrollbar-thumb:hover {
    background: #4b5563;
  }

  .thinking-text {
    font-size: 0.75rem;
    color: #9ca3af;
    font-style: italic;
    opacity: 0.9;
  }

  /* Content section styles */
  .content-section {
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-surface, #ffffff);
    border-radius: 4px;
    border: 2px solid #3b82f6;
  }

  .content-label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: #3b82f6;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    margin-bottom: 0.1rem;
  }

  .content-text {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text-primary, #111827);
  }
</style>
