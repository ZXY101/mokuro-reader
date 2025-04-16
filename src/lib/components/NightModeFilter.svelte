<script lang="ts">
  import { settings } from '$lib/settings';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';

  // Create elements to hold our filter
  let styleElement: HTMLStyleElement | null = null;
  let canvasElement: HTMLCanvasElement | null = null;

  // Function to apply the night mode filter using a canvas-based approach
  function applyNightModeFilter() {
    if (!browser) return;
    
    // Create style element if it doesn't exist
    if (!styleElement) {
      styleElement = document.createElement('style');
      document.head.appendChild(styleElement);
    }
    
    // Apply the CSS filter
    if ($settings.nightMode) {
      // This CSS implementation is a close approximation of the Flutter color matrix
      // It preserves black as black while converting other colors to red based on luminosity
      styleElement.textContent = `
        html {
          filter: grayscale(100%) brightness(0.8) !important;
        }
        
        /* Create a red overlay with multiply blend mode to preserve blacks */
        html::before {
          content: "";
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: red;
          mix-blend-mode: multiply;
          pointer-events: none;
          z-index: 9999;
        }
      `;
    } else {
      styleElement.textContent = '';
    }
  }

  // Watch for changes to the night mode setting
  $: if (browser && $settings) {
    applyNightModeFilter();
  }

  // Set up and clean up
  onMount(() => {
    applyNightModeFilter();
  });

  onDestroy(() => {
    if (browser) {
      if (styleElement) {
        styleElement.remove();
      }
      if (canvasElement) {
        canvasElement.remove();
      }
    }
  });
</script>

<!-- This component doesn't render any visible elements, it just applies the CSS filter -->