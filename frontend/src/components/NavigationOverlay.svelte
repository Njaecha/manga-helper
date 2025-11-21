<script>
  export let canGoPrev = false;
  export let canGoNext = false;
  export let onPrevious;
  export let onNext;
</script>

<button
  class="nav-overlay-button left"
  class:disabled={!canGoPrev}
  disabled={!canGoPrev}
  on:click={onPrevious}
  title="Previous page (←)"
>
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
  </svg>
</button>

<button
  class="nav-overlay-button right"
  class:disabled={!canGoNext}
  disabled={!canGoNext}
  on:click={onNext}
  title="Next page (→)"
>
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
  </svg>
</button>

<style>
  .nav-overlay-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 10;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.3);
    padding: 1rem 0.75rem;
    cursor: pointer;
    opacity: 0.4;
    transition: opacity 200ms ease-in-out, background-color 200ms ease-in-out;
    user-select: none;
  }

  .nav-overlay-button:hover:not(:disabled) {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.8);
  }

  .nav-overlay-button:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }

  .nav-overlay-button.left {
    left: 0;
    border-radius: 0 4px 4px 0;
    border-left: none;
  }

  .nav-overlay-button.right {
    right: 0;
    border-radius: 4px 0 0 4px;
    border-right: none;
  }
</style>
