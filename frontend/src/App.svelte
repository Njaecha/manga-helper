<script>
  import Canvas from './components/Canvas.svelte';
  import PageControls from './components/PageControls.svelte';
  import ImageCarousel from './components/ImageCarousel.svelte';
  import AnalysisControls from './components/AnalysisControls.svelte';
  import TokenReveal from './components/TokenReveal.svelte';
  import StreamingTranslation from './components/StreamingTranslation.svelte';
  import CollapsibleOutput from './components/CollapsibleOutput.svelte';
  import TranslationInput from './components/TranslationInput.svelte';
  import PanelSeparator from './components/PanelSeparator.svelte';
  import { error, analysisResult, revealedSections, leftPaneWidthPercent } from './lib/store.js';

  // Subscribe to stores
  $: analysisData = $analysisResult;
  $: globalError = $error;

  // Handle revealing sections
  function handleRevealSection(section) {
    revealedSections.update(sections => ({
      ...sections,
      [section]: true
    }));
  }
</script>

<div class="app-container">
  <!-- Global Error Display -->
  {#if globalError}
    <div class="error-banner">
      <svg xmlns="http://www.w3.org/2000/svg" class="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{globalError}</span>
      <button on:click={() => error.set(null)} class="close-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  {/if}

  <div class="main-layout" style="--left-pane-width: {$leftPaneWidthPercent}%">
    <!-- LEFT PANE -->
    <div class="left-pane">
      <!-- Collapsible Folder Input (top) -->
      <PageControls />

      <!-- Canvas with Controls Bar (middle - takes flex space) -->
      <div class="canvas-section">
        <Canvas />
      </div>

      <!-- Collapsible Image Carousel (bottom) -->
      <ImageCarousel />
    </div>

    <!-- DRAGGABLE SEPARATOR -->
    <PanelSeparator />

    <!-- RIGHT PANE -->
    <div class="right-pane">
      <!-- Analysis Controls -->
      <AnalysisControls />

      <!-- Analysis Results -->
      <div class="analysis-results">
        <!-- Token Analysis with OCR, Hiragana, and Romaji -->
        <TokenReveal
          ocrTokens={analysisData.ocr_tokens}
          hiraganaTokens={analysisData.hiragana_tokens}
          romajiTokens={analysisData.romaji_tokens}
        />

        <!-- Streaming AI Translation -->
        <StreamingTranslation />

      </div>

      <!-- User Translation Input -->
      <TranslationInput />
    </div>
  </div>
</div>

<style>
  .app-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-bg-secondary);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: var(--color-error-bg);
    color: var(--color-error-text);
    border-bottom: 2px solid var(--color-error-border);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .error-icon {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }

  .close-error {
    margin-left: auto;
    padding: 0.25rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--color-error-text);
    transition: color 0.2s;
  }

  .close-error:hover {
    color: var(--color-accent-red-hover);
  }

  .icon {
    width: 1rem;
    height: 1rem;
  }

  .main-layout {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .left-pane {
    flex: none;
    width: var(--left-pane-width);
    min-width: 300px;
    max-width: calc(100vw - 300px);
    display: flex;
    flex-direction: column;
    background: var(--color-bg-surface);
    overflow: hidden;
  }

  .canvas-section {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .right-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-secondary);
    overflow-y: auto;
  }

  .analysis-results {
    flex: 1;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
  }

  /* Responsive Design */
  @media (max-width: 1024px) {
    .main-layout {
      flex-direction: column;
    }

    .left-pane {
      flex: 1;
      width: auto !important;
      min-width: auto;
      max-width: none;
      border-bottom: 2px solid var(--color-border-primary);
    }

    .right-pane {
      flex: 1;
    }

    /* Hide separator on mobile/tablet */
    .main-layout :global(.panel-separator) {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .left-pane {
      min-height: 50vh;
    }

    .right-pane {
      min-height: 50vh;
    }
  }
</style>
