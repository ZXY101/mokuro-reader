<script lang="ts">
  import { settings } from '$lib/settings';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';

  // Create a style element to hold our CSS filter
  let styleElement: HTMLStyleElement | null = null;
  let canvasElement: HTMLCanvasElement | null = null;

  // Function to apply the night mode filter
  function applyNightModeFilter() {
    if (!browser) return;
    
    // Create style element if it doesn't exist
    if (!styleElement) {
      styleElement = document.createElement('style');
      document.head.appendChild(styleElement);
    }
    
    // Apply the stronger red filter using a color matrix transformation
    if ($settings.nightMode) {
      // This uses a CSS filter that approximates the color matrix:
      // [-1/3, -1/3, -1/3, 0, 255,  // red channel
      //  0, 0, 0, 0, 0,             // green channel
      //  0, 0, 0, 0, 0,             // blue channel
      //  0, 0, 0, 1, 0]             // alpha channel
      styleElement.textContent = `
        html {
          filter: brightness(0.7) contrast(1.2) grayscale(1) sepia(1) hue-rotate(0deg) saturate(3) !important;
        }
        
        /* Create a red overlay with screen blend mode */
        html::before {
          content: "";
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(255, 0, 0, 0.3);
          mix-blend-mode: screen;
          pointer-events: none;
          z-index: 9999;
        }
      `;
    } else {
      styleElement.textContent = '';
    }
  }

  // For more advanced color matrix transformations, we could use a canvas-based approach
  function setupCanvasFilter() {
    if (!browser || !$settings.nightMode) return;
    
    // This is an alternative approach using canvas that could be implemented
    // for more precise color matrix transformations if needed
    /*
    if (!canvasElement) {
      canvasElement = document.createElement('canvas');
      canvasElement.style.position = 'fixed';
      canvasElement.style.top = '0';
      canvasElement.style.left = '0';
      canvasElement.style.width = '100%';
      canvasElement.style.height = '100%';
      canvasElement.style.pointerEvents = 'none';
      canvasElement.style.zIndex = '9999';
      document.body.appendChild(canvasElement);
      
      // Apply color matrix transformation here
      // This would require capturing the screen content and applying the matrix
    }
    */
  }

  // Watch for changes to the night mode setting
  $: if (browser && $settings) {
    applyNightModeFilter();
    setupCanvasFilter();
  }

  // Set up and clean up
  onMount(() => {
    applyNightModeFilter();
    setupCanvasFilter();
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