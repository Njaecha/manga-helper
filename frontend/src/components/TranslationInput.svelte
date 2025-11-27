<script>
  import {
    currentImage,
    selectedBoxIndex,
    selectedBoxIndices,
    allBoxes,
    userTranslations,
    saveUserTranslation,
    analysisResult

  } from '../lib/store.js';
  import { saveTranslation, exportTranslations, importTranslations } from '../lib/api.js';
  import { saveToLocalStorage, loadFromLocalStorage } from '../lib/utils.js';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  let marker = '';
  let translation = '';
  let isSaving = false;
  let saveMessage = '';
  let fileInput;
  let bubbleCarouselContainer;

  // Bubble carousel state for multi-selection
  let selectedBubbleForTranslation = 0; // Index into selectedBoxIndices array

  // Subscribe to stores
  $: imageName = $currentImage;
  $: boxIndex = $selectedBoxIndex;
  $: selectedIndices = $selectedBoxIndices;
  $: hasMultipleSelection = selectedIndices.length > 1;
  $: currentAnalysisResult = $analysisResult;

  // Current box index for translation (from carousel selection)
  $: currentTranslationBoxIndex = hasMultipleSelection
    ? selectedIndices[selectedBubbleForTranslation]
    : boxIndex;

  // Load saved translation when selection or carousel position changes
  $: if (imageName && currentTranslationBoxIndex !== null) {
    loadSavedTranslation();
  }

  // Reset carousel position when selection changes
  $: if (selectedIndices.length > 0) {
    // Reset to first bubble if current position is out of bounds
    if (selectedBubbleForTranslation >= selectedIndices.length) {
      selectedBubbleForTranslation = 0;
    }
  }

  // Auto-scroll to show current bubble in carousel
  $: if (bubbleCarouselContainer && selectedBubbleForTranslation !== null && hasMultipleSelection) {
    scrollToCurrentBubble();
  }

  function scrollToCurrentBubble() {
    if (!bubbleCarouselContainer) return;

    const items = bubbleCarouselContainer.querySelectorAll('.minimal-carousel-item');
    const currentItem = items[selectedBubbleForTranslation];

    if (currentItem) {
      currentItem.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }

  // Load translations from localStorage on mount
  onMount(() => {
    const saved = loadFromLocalStorage('manga-translations', {});
    if (saved && Object.keys(saved).length > 0) {
      userTranslations.set(saved);
    }
  });

  // Save to localStorage whenever translations change
  userTranslations.subscribe(translations => {
    saveToLocalStorage('manga-translations', translations);
  });

  function loadSavedTranslation() {
    if (!imageName || currentTranslationBoxIndex === null) {
      marker = '';
      translation = '';
      return;
    }

    // Use get() to access store value synchronously
    const translations = get(userTranslations);
    const saved = translations[imageName]?.[currentTranslationBoxIndex];

    if (saved) {
      marker = saved.marker || '';
      translation = saved.translation || '';
    } else {
      marker = '';
      translation = '';
    }
  }

  function goToPreviousBubble() {
    if (selectedBubbleForTranslation > 0) {
      selectedBubbleForTranslation--;
    }
  }

  function goToNextBubble() {
    if (selectedBubbleForTranslation < selectedIndices.length - 1) {
      selectedBubbleForTranslation++;
    }
  }

  async function handleSave() {
    if (!imageName || currentTranslationBoxIndex === null) {
      saveMessage = 'Please select a speech bubble first';
      return;
    }

    if (!translation.trim()) {
      saveMessage = 'Please enter a translation';
      return;
    }

    isSaving = true;
    saveMessage = '';

    try {
      // Save to store (and localStorage via subscription)
      saveUserTranslation(imageName, currentTranslationBoxIndex, marker, translation);

      let ocr = null;
      if (hasMultipleSelection){
        ocr = currentAnalysisResult.bubbleBreakdown[selectedBubbleForTranslation].ocr_text
      }
      else{
        ocr = currentAnalysisResult.ocr_text
      }

      // Try to save to backend
      await saveTranslation(imageName, currentTranslationBoxIndex, marker, translation, ocr);

      saveMessage = 'Translation saved successfully!';

      // Auto-advance to next bubble if in multi-selection mode
      if (hasMultipleSelection && selectedBubbleForTranslation < selectedIndices.length - 1) {
        setTimeout(() => {
          goToNextBubble();
          saveMessage = '';
        }, 1000); // Brief delay to show success message
      } else {
        setTimeout(() => {
          saveMessage = '';
        }, 3000);
      }
    } catch (err) {
      saveMessage = `Failed to save: ${err.message}`;
    } finally {
      isSaving = false;
    }
  }

  function handleExport() {
    let translations = {};
    userTranslations.subscribe(t => translations = t)();

    if (Object.keys(translations).length === 0) {
      saveMessage = 'No translations to export';
      return;
    }

    exportTranslations(translations);
    saveMessage = 'Translations exported successfully!';
    setTimeout(() => {
      saveMessage = '';
    }, 3000);
  }

  async function handleImport() {
    if (!fileInput.files || fileInput.files.length === 0) {
      return;
    }

    const file = fileInput.files[0];

    try {
      const imported = await importTranslations(file);

      // Merge with existing translations
      userTranslations.update(current => {
        return { ...current, ...imported };
      });

      saveMessage = 'Translations imported successfully!';
      setTimeout(() => {
        saveMessage = '';
      }, 3000);
    } catch (err) {
      saveMessage = `Failed to import: ${err.message}`;
    }

    // Reset file input
    fileInput.value = '';
  }

  function triggerFileInput() {
    fileInput.click();
  }
</script>

<div class="p-3 border-t border-border-primary">
  <div class="flex justify-between items-center mb-2">
    <div class="flex items-center gap-3 flex-1 min-w-0">
      <h3 class="text-sm font-semibold text-text-secondary m-0">Your Translation</h3>

      <!-- Bubble Mini-Carousel for Multi-Selection -->
      {#if hasMultipleSelection}
        <div bind:this={bubbleCarouselContainer} class="minimal-carousel">
          {#each selectedIndices as bubbleIndex, i}
            <button
              class="minimal-carousel-item"
              class:active={i === selectedBubbleForTranslation}
              on:click={() => selectedBubbleForTranslation = i}
              title="Bubble {i + 1} (Box {bubbleIndex})"
            >
              {i + 1}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <label for="translation-text" class="text-xs font-medium text-text-secondary">
      Translation
      <span class="text-[var(--color-accent-red)]">*</span>
    </label>
  </div>

  <div class="mb-2">
    <textarea
      id="translation-text"
      bind:value={translation}
      placeholder="Enter your translation here..."
      class="w-full px-3 py-2 border border-border-secondary rounded-md text-sm transition-colors bg-bg-surface text-text-primary resize-y font-inherit leading-normal focus:outline-none focus:border-[var(--color-accent-blue)] focus:shadow-[0_0_0_3px_var(--color-focus-ring)] disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-tertiary)] disabled:cursor-not-allowed"
      rows="2"
      disabled={!imageName || boxIndex === null}
    ></textarea>
  </div>

  <div class="flex gap-2 items-center mb-2">
    <button
      on:click={handleSave}
      disabled={isSaving || !imageName || boxIndex === null || !translation.trim()}
      class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border-none rounded-md cursor-pointer transition-all duration-200 bg-[var(--color-accent-green)] text-white hover:bg-[var(--color-accent-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {#if isSaving}
        <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Saving...
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        Save Translation
      {/if}
    </button>

    <input
      id="bubble-marker"
      type="text"
      bind:value={marker}
      placeholder="#"
      title="Bubble Marker (optional)"
      class="w-[60px] text-center font-semibold px-3 py-2 border border-border-secondary rounded-md text-sm transition-colors bg-bg-surface text-text-primary focus:outline-none focus:border-[var(--color-accent-blue)] focus:shadow-[0_0_0_3px_var(--color-focus-ring)] disabled:bg-[var(--color-bg-tertiary)] disabled:text-[var(--color-text-tertiary)] disabled:cursor-not-allowed"
      disabled={!imageName || boxIndex === null}
    />
  </div>

  <div class="flex gap-2">
    <button
      on:click={handleExport}
      class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-all duration-200 bg-bg-tertiary text-text-secondary border border-border-secondary hover:bg-hover"
      title="Export all translations to JSON file"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Export All
    </button>

    <button
      on:click={triggerFileInput}
      class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-all duration-200 bg-bg-tertiary text-text-secondary border border-border-secondary hover:bg-hover"
      title="Import translations from JSON file"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      Import
    </button>

    <input
      bind:this={fileInput}
      type="file"
      accept=".json"
      on:change={handleImport}
      style="display: none;"
    />
  </div>

  {#if saveMessage}
    <div class="mt-3 px-3 py-3 rounded-md text-sm text-center {saveMessage.includes('Failed') || saveMessage.includes('No translations') ? 'bg-error-bg text-error-text border border-[var(--color-accent-red)]' : 'bg-success-bg text-success-text border border-[var(--color-accent-green)]'}">
      {saveMessage}
    </div>
  {/if}
</div>
