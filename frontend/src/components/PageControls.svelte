<script>
  import { folderPath, currentImageIndex, imageList, isLoading, error, showFolderInput } from '../lib/store.js';
  import { loadFolder } from '../lib/api.js';
  import { isValidPath, formatError } from '../lib/utils.js';
  import { slide } from 'svelte/transition';

  let pathInput = '';
  let localError = '';

  // Subscribe to stores
  $: folderInputVisible = $showFolderInput;

  async function handleLoadFolder() {
    localError = '';

    if (!pathInput.trim()) {
      localError = 'Please enter a folder path';
      return;
    }

    if (!isValidPath(pathInput)) {
      localError = 'Invalid folder path format';
      return;
    }

    isLoading.set(true);
    error.set(null);

    try {
      const result = await loadFolder(pathInput);

      if (!result.images || result.images.length === 0) {
        localError = 'No images found in folder';
        isLoading.set(false);
        return;
      }

      folderPath.set(pathInput);
      imageList.set(result.images);
      currentImageIndex.set(0);

      // Auto-collapse folder input after successful load
      showFolderInput.set(false);
    } catch (err) {
      localError = formatError(err);
      error.set(formatError(err));
    } finally {
      isLoading.set(false);
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Enter') {
      handleLoadFolder();
    }
  }
</script>

<!-- Collapsible Folder Input Group -->
{#if folderInputVisible}
  <div class="folder-input-group" transition:slide={{ duration: 300 }}>
    <label for="folder-path" class="block text-sm font-medium mb-1">
      Manga Folder Path
    </label>
    <div class="flex gap-2">
      <input
        id="folder-path"
        type="text"
        bind:value={pathInput}
        on:keydown={handleKeydown}
        placeholder="C:\path\to\manga\folder or /path/to/manga/folder"
        class="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
        disabled={$isLoading}
      />
      <button
        on:click={handleLoadFolder}
        disabled={$isLoading}
        class="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {$isLoading ? 'Loading...' : 'Load Folder'}
      </button>
    </div>
    {#if localError}
      <p class="text-red-500 text-sm mt-1">{localError}</p>
    {/if}
  </div>
{/if}

<style>
  .folder-input-group {
    padding: 1rem;
    background: var(--color-bg-surface);
    border-bottom: 1px solid var(--color-border-primary);
  }
</style>
