<script lang="ts">
  import { settings } from '$lib/settings';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';

  // Create elements to hold our filter
  let styleElement: HTMLStyleElement | null = null;
  let svgElement: SVGElement | null = null;

  // Function to apply the night mode filter
  function applyNightModeFilter() {
    if (!browser) return;
    
    // Create style element if it doesn't exist
    if (!styleElement) {
      styleElement = document.createElement('style');
      document.head.appendChild(styleElement);
    }
    
    // Create SVG filter element if it doesn't exist
    if (!svgElement) {
      svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgElement.setAttribute('width', '0');
      svgElement.setAttribute('height', '0');
      svgElement.style.position = 'absolute';
      svgElement.style.zIndex = '-9999';
      
      // This implements a filter that approximates the Flutter color matrix:
      // [-1/3, -1/3, -1/3, 0, 255,  // red channel
      //  0, 0, 0, 0, 0,             // green channel
      //  0, 0, 0, 0, 0,             // blue channel
      //  0, 0, 0, 1, 0]             // alpha channel
      
      svgElement.innerHTML = `
        <defs>
          <filter id="night-mode-filter">
            <!-- Convert to grayscale first -->
            <feColorMatrix type="matrix" 
              values="0.2126 0.7152 0.0722 0 0
                      0.2126 0.7152 0.0722 0 0
                      0.2126 0.7152 0.0722 0 0
                      0 0 0 1 0" />
                      
            <!-- Keep only the red channel -->
            <feColorMatrix type="matrix"
              values="1 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0" />
          </filter>
        </defs>
      `;
      document.body.appendChild(svgElement);
    }
    
    // Apply the filter
    if ($settings.nightMode) {
      styleElement.textContent = `
        html {
          filter: url(#night-mode-filter) !important;
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
      if (svgElement) {
        svgElement.remove();
      }
    }
  });
</script>

<!-- This component doesn't render any visible elements, it just applies the filter -->