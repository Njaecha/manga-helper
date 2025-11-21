<script>
  import { imageList, currentImageIndex, folderPath, goToImage, clearCurrentPageCache, clearAllPageCache, carouselExpanded } from '../lib/store.js';
  import { getThumbnailUrl } from '../lib/api.js';
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';

  let carouselContainer;
  let minimalCarouselContainer;
  let failedThumbnails = new Set(); // Track which thumbnails failed to load

  // Subscribe to stores
  $: images = $imageList;
  $: currentIndex = $currentImageIndex;
  $: currentFolder = $folderPath;
  $: expanded = $carouselExpanded;

  function selectImage(index) {
    goToImage(index);
  }

  // Auto-scroll to show current image in full carousel
  $: if (carouselContainer && currentIndex !== null && expanded) {
    scrollToCurrentImage();
  }

  // Auto-scroll to show current page in minimal carousel
  $: if (minimalCarouselContainer && currentIndex !== null && !expanded) {
    scrollToCurrentPageMinimal();
  }

  function scrollToCurrentImage() {
    if (!carouselContainer) return;

    const thumbnails = carouselContainer.querySelectorAll('.thumbnail');
    const currentThumbnail = thumbnails[currentIndex];

    if (currentThumbnail) {
      currentThumbnail.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }

  function scrollToCurrentPageMinimal() {
    if (!minimalCarouselContainer) return;

    const items = minimalCarouselContainer.querySelectorAll('.minimal-carousel-item');
    const currentItem = items[currentIndex];

    if (currentItem) {
      currentItem.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }

  function handleThumbnailError(index) {
    failedThumbnails.add(index);
    failedThumbnails = failedThumbnails; // Trigger reactivity
  }

  function handleThumbnailLoad(index) {
    if (failedThumbnails.has(index)) {
      failedThumbnails.delete(index);
      failedThumbnails = failedThumbnails; // Trigger reactivity
    }
  }

  function handleClearCurrentPage() {
    if (confirm('Clear cache for current page? This will remove all saved analysis and boxes.')) {
      clearCurrentPageCache();
      window.location.reload(); // Reload to reflect changes
    }
  }

  function handleClearAllPages() {
    if (confirm('Clear cache for ALL pages? This will remove all saved analysis and boxes for the entire manga.')) {
      clearAllPageCache();
      window.location.reload(); // Reload to reflect changes
    }
  }

  function toggleCarousel() {
    carouselExpanded.set(!expanded);
  }
</script>

{#if images.length > 0}
  <div class="image-carousel">
    <div class="carousel-header">
      <div class="header-left">
        <h3 class="text-sm font-semibold">Pages</h3>
        {#if !expanded}
          <!-- Minimal carousel with page numbers -->
          <div bind:this={minimalCarouselContainer} class="minimal-carousel">
            {#each images as image, index}
              <button
                class="minimal-carousel-item"
                class:active={index === currentIndex}
                on:click={() => selectImage(index)}
                title="{image} - Page {index + 1}"
              >
                {index + 1}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="header-right">
        <div class="cache-controls">
          <button
            class="cache-btn"
            on:click={handleClearCurrentPage}
            title="Clear cache for current page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
            Page
          </button>
          <button
            class="cache-btn"
            on:click={handleClearAllPages}
            title="Clear cache for all pages"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
            All
          </button>
        </div>
        <button
          class="collapse-button"
          on:click={toggleCarousel}
          title={expanded ? 'Collapse carousel' : 'Expand carousel'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {#if expanded}
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            {:else}
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            {/if}
          </svg>
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>

    {#if expanded}
      <div bind:this={carouselContainer} class="carousel-container" transition:slide={{ duration: 300 }}>
        {#each images as image, index}
          <button
            class="thumbnail {index === currentIndex ? 'active' : ''}"
            on:click={() => selectImage(index)}
            title="{image} - Page {index + 1}"
          >
            <div class="thumbnail-number">{index + 1}</div>
            <!-- Show actual thumbnail image with fallback to placeholder -->
            {#if !failedThumbnails.has(index)}
              <img
                src={getThumbnailUrl(currentFolder, image, 120, 160)}
                alt="Page {index + 1}"
                class="thumbnail-image"
                loading="lazy"
                on:error={() => handleThumbnailError(index)}
                on:load={() => handleThumbnailLoad(index)}
              />
            {/if}
            {#if failedThumbnails.has(index)}
              <div class="thumbnail-placeholder">
                <span class="page-label">P{index + 1}</span>
              </div>
            {/if}
            <div class="thumbnail-filename">{image}</div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .image-carousel {
    background: var(--color-bg-surface);
    border-top: 1px solid var(--color-border-primary);
  }

  .carousel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--color-border-primary);
    gap: 1rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
    min-width: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .cache-controls {
    display: flex;
    gap: 0.5rem;
  }

  .cache-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-primary);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--color-text-secondary);
  }

  .cache-btn:hover {
    background: var(--color-hover);
    border-color: var(--color-accent-blue);
    color: var(--color-accent-blue);
  }

  .carousel-container {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-behavior: smooth;
  }

  .carousel-container::-webkit-scrollbar {
    height: 8px;
  }

  .carousel-container::-webkit-scrollbar-track {
    background: var(--color-bg-secondary);
  }

  .carousel-container::-webkit-scrollbar-thumb {
    background: var(--color-border-secondary);
    border-radius: 4px;
  }

  .carousel-container::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-tertiary);
  }

  .thumbnail {
    flex-shrink: 0;
    width: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    border: 2px solid transparent;
    border-radius: 4px;
    background: var(--color-bg-tertiary);
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .thumbnail:hover {
    background: var(--color-hover);
    border-color: var(--color-text-tertiary);
  }

  .thumbnail.active {
    border-color: var(--color-accent-blue);
    background: var(--color-accent-blue-light);
  }

  .thumbnail-number {
    position: absolute;
    top: 4px;
    right: 4px;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    font-size: 10px;
    padding: 2px 4px;
    border-radius: 2px;
    font-weight: 600;
  }

  .thumbnail-image {
    width: 60px;
    height: 80px;
    object-fit: cover;
    border-radius: 4px;
    box-shadow: var(--shadow-sm);
    background: var(--color-bg-secondary);
  }

  .thumbnail-placeholder {
    width: 60px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 4px;
    box-shadow: var(--shadow-sm);
  }

  .page-label {
    font-size: 16px;
    font-weight: bold;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .thumbnail-filename {
    font-size: 9px;
    color: var(--color-text-tertiary);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .thumbnail.active .thumbnail-filename {
    color: var(--color-accent-blue-dark);
    font-weight: 600;
  }
</style>
