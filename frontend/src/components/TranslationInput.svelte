<script>
  import {
    currentImage,
    selectedBoxIndex,
    userTranslations,
    saveUserTranslation
  } from '../lib/store.js';
  import { saveTranslation, exportTranslations, importTranslations } from '../lib/api.js';
  import { saveToLocalStorage, loadFromLocalStorage } from '../lib/utils.js';
  import { onMount } from 'svelte';

  let marker = '';
  let translation = '';
  let isSaving = false;
  let saveMessage = '';
  let fileInput;

  // Subscribe to stores
  $: imageName = $currentImage;
  $: boxIndex = $selectedBoxIndex;

  // Load saved translation when selection changes
  $: if (imageName && boxIndex !== null) {
    loadSavedTranslation();
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
    if (!imageName || boxIndex === null) {
      marker = '';
      translation = '';
      return;
    }

    let saved = null;
    userTranslations.subscribe(translations => {
      saved = translations[imageName]?.[boxIndex];
    })();

    if (saved) {
      marker = saved.marker || '';
      translation = saved.translation || '';
    } else {
      marker = '';
      translation = '';
    }
  }

  async function handleSave() {
    if (!imageName || boxIndex === null) {
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
      saveUserTranslation(imageName, boxIndex, marker, translation);

      // Try to save to backend (mock for now)
      await saveTranslation(imageName, boxIndex, marker, translation);

      saveMessage = 'Translation saved successfully!';
      setTimeout(() => {
        saveMessage = '';
      }, 3000);
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

<div class="translation-input">
  <div class="header-row">
    <h3 class="title">Your Translation</h3>
    <label for="translation-text" class="label-inline">
      Translation
      <span class="required">*</span>
    </label>
  </div>

  <div class="input-group">
    <textarea
      id="translation-text"
      bind:value={translation}
      placeholder="Enter your translation here..."
      class="textarea"
      rows="2"
      disabled={!imageName || boxIndex === null}
    ></textarea>
  </div>

  <div class="button-row">
    <button
      on:click={handleSave}
      disabled={isSaving || !imageName || boxIndex === null || !translation.trim()}
      class="btn btn-primary"
    >
      {#if isSaving}
        <svg class="animate-spin icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Saving...
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      class="input marker-input-inline"
      disabled={!imageName || boxIndex === null}
    />
  </div>

  <div class="file-operations">
    <button on:click={handleExport} class="btn btn-secondary" title="Export all translations to JSON file">
      <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Export All
    </button>

    <button on:click={triggerFileInput} class="btn btn-secondary" title="Import translations from JSON file">
      <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    <div class="message {saveMessage.includes('Failed') || saveMessage.includes('No translations') ? 'error' : 'success'}">
      {saveMessage}
    </div>
  {/if}
</div>

<style>
  .translation-input {
    padding: 0.75rem;
    border-top: 1px solid var(--color-border-primary);
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .label-inline {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .input-group {
    margin-bottom: 0.5rem;
  }

  .optional {
    font-weight: 400;
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
  }

  .required {
    color: var(--color-accent-red);
  }

  .input,
  .textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    font-size: 0.875rem;
    transition: border-color 0.2s;
    background: var(--color-bg-surface);
    color: var(--color-text-primary);
  }

  .input:focus,
  .textarea:focus {
    outline: none;
    border-color: var(--color-accent-blue);
    box-shadow: 0 0 0 3px var(--color-focus-ring);
  }

  .input:disabled,
  .textarea:disabled {
    background: var(--color-bg-tertiary);
    color: var(--color-text-tertiary);
    cursor: not-allowed;
  }

  .marker-input {
    max-width: 150px;
  }

  .marker-input-inline {
    width: 60px;
    text-align: center;
    font-weight: 600;
  }

  .textarea {
    resize: vertical;
    font-family: inherit;
    line-height: 1.5;
  }

  .button-group {
    margin-bottom: 0.75rem;
  }

  .button-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .button-row .btn-primary {
    flex: 1;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    width: 100%;
    background: var(--color-accent-green);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-accent-green-dark);
  }

  .btn-secondary {
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border-secondary);
  }

  .btn-secondary:hover {
    background: var(--color-hover);
  }

  .icon {
    width: 1rem;
    height: 1rem;
  }

  .file-operations {
    display: flex;
    gap: 0.5rem;
  }

  .file-operations .btn {
    flex: 1;
  }

  .message {
    margin-top: 0.75rem;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    text-align: center;
  }

  .message.success {
    background: var(--color-success-bg);
    color: var(--color-success-text);
    border: 1px solid var(--color-accent-green);
  }

  .message.error {
    background: var(--color-error-bg);
    color: var(--color-error-text);
    border: 1px solid var(--color-accent-red);
  }
</style>
