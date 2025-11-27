<script>
  import { renderMarkdown } from '../lib/markdownUtils.js';

  export let messages = [];
  export let isStreaming = false;
  export let streamingContent = '';
  export let streamingThinking = '';
  export let onResend = null;

  let messagesContainer;
  let shouldAutoScroll = true;
  let expandedThinking = {}; // Track which messages have expanded thinking

  // Auto-scroll to bottom when new messages arrive
  $: if (shouldAutoScroll && messagesContainer && (messages.length || streamingContent)) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Check if user has scrolled up
  function handleScroll() {
    if (!messagesContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    shouldAutoScroll = isNearBottom;
  }

  // Format timestamp
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Scroll to bottom manually
  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'smooth'
      });
      shouldAutoScroll = true;
    }
  }

  // Toggle thinking visibility
  function toggleThinking(index) {
    expandedThinking = {
      ...expandedThinking,
      [index]: !expandedThinking[index]
    };
  }
</script>

<div
  class="overflow-y-auto p-3 flex flex-col gap-3 bg-bg-secondary relative min-h-[200px] max-h-[400px] scrollbar-thin scrollbar-thumb-border-secondary scrollbar-track-bg-secondary"
  bind:this={messagesContainer}
  on:scroll={handleScroll}
>
  {#if messages.length === 0 && !isStreaming}
    <div class="flex-1 flex flex-col items-center justify-center gap-3 text-text-tertiary p-8 text-center">
      <svg class="w-12 h-12 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <p class="text-base font-medium m-0">Start a conversation</p>
      <p class="text-xs m-0 opacity-70">Send a message or insert context from the current bubble</p>
    </div>
  {:else}
    {#each messages as message, index}
      <div class="flex mb-2 group" class:justify-end={message.role === 'user'} class:justify-start={message.role === 'assistant'}>
        <div
          class="max-w-[80%] px-3.5 py-2.5 rounded-xl relative break-words text-sm leading-relaxed {message.isError ? 'bg-red-500 bg-opacity-10 border-red-500 text-red-500' : ''}"
          class:bg-accent-blue={message.role === 'user' && !message.isError}
          class:text-white={message.role === 'user' && !message.isError}
          class:rounded-br={message.role === 'user'}
          class:bg-bg-surface={message.role === 'assistant' && !message.isError}
          class:text-text-primary={message.role === 'assistant' && !message.isError}
          class:border={message.role === 'assistant' || message.isError}
          class:border-border-primary={message.role === 'assistant' && !message.isError}
          class:rounded-bl={message.role === 'assistant'}
        >
          <!-- Show thinking bar if present (assistant messages only) -->
          {#if message.role === 'assistant' && message.thinking}
            <button
              class="w-full flex items-center justify-between gap-2 px-2 py-1.5 mb-2 bg-black/10 border border-white/10 rounded cursor-pointer hover:bg-black/20 transition-colors text-left"
              on:click={() => toggleThinking(index)}
            >
              <div class="flex items-center gap-2">
                <svg class="w-3.5 h-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span class="text-xs font-medium opacity-70">Thinking</span>
              </div>
              <svg class="w-3.5 h-3.5 opacity-60 transition-transform" class:rotate-180={expandedThinking[index]} viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>

            {#if expandedThinking[index]}
              <div class="px-2 py-1.5 mb-2 bg-black/5 border border-white/10 rounded text-xs opacity-80 whitespace-pre-wrap">
                {message.thinking}
              </div>
            {/if}
          {/if}

          <!-- Show attached images if present -->
          {#if message.images && message.images.length > 0}
            <div class="flex flex-wrap gap-2 mb-2">
              {#each message.images as imageUrl}
                <img
                  src={imageUrl}
                  alt="Attached"
                  class="max-h-32 w-auto rounded border border-white/20 object-cover"
                />
              {/each}
            </div>
          {/if}

          <!-- Render content with markdown for assistant, plain text for user -->
          {#if message.role === 'assistant'}
            <div class="markdown mb-1">{@html renderMarkdown(message.content)}</div>
          {:else}
            <div class="whitespace-pre-wrap mb-1">{message.content}</div>
          {/if}
          <div class="flex items-center justify-between gap-2 text-[11px] opacity-60 mt-0.5">

            <!-- Resend button for user messages -->
            {#if message.role === 'user' && onResend && !isStreaming}
              <button
                class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/20 cursor-pointer border-none text-[11px]"
                class:text-white={!message.isError}
                class:text-red-500={message.isError}
                on:click={() => onResend(index)}
                title="Resend from here"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Resend
              </button>
            {/if}
            <span class:ml-auto={message.role === 'user'}>{formatTime(message.timestamp)}</span>
          </div>
        </div>
      </div>
    {/each}

    {#if isStreaming}
      <div class="flex justify-start mb-2">
        <div class="max-w-[80%] px-3.5 py-2.5 rounded-xl bg-bg-surface text-text-primary border border-border-primary rounded-bl text-sm leading-relaxed animate-pulse">
          <!-- Show thinking if present during streaming -->
          {#if streamingThinking}
            <div class="px-2 py-1.5 mb-2 bg-black/5 border border-white/10 rounded text-xs opacity-70 whitespace-pre-wrap">
              <div class="flex items-center gap-2 mb-1">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span class="font-medium">Thinking...</span>
              </div>
              {streamingThinking}
            </div>
          {/if}

          <div class="markdown">
            {@html renderMarkdown(streamingContent)}<span class="inline-block ml-0.5 font-bold text-accent-blue animate-blink">▊</span>
          </div>
        </div>
      </div>
    {/if}
  {/if}

  <!-- Scroll to bottom button (shown when not auto-scrolling) -->
  {#if !shouldAutoScroll && (messages.length > 0 || isStreaming)}
    <button
      class="sticky bottom-4 left-[calc(100%-3rem)] w-8 h-8 bg-accent-blue text-white border-none rounded-full cursor-pointer flex items-center justify-center shadow-lg transition-all hover:bg-blue-600 hover:-translate-y-0.5 hover:shadow-xl z-10"
      on:click={scrollToBottom}
      title="Scroll to bottom"
    >
      <svg class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </button>
  {/if}
</div>

<style>
  /* Blink animation for cursor */
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .animate-blink {
    animation: blink 1s step-end infinite;
  }
</style>
