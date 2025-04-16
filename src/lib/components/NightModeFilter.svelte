<script lang="ts">
  import { settings } from '$lib/settings';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';

  // Create elements to hold our filter
  let styleElement: HTMLStyleElement | null = null;

  // Function to apply the night mode filter
  function applyNightModeFilter() {
    if (!browser) return;
    
    // Create style element if it doesn't exist
    if (!styleElement) {
      styleElement = document.createElement('style');
      document.head.appendChild(styleElement);
    }
    
    // Apply the filter
    if ($settings.nightMode) {
      styleElement.textContent = `
        html {
          filter: url('#night-mode-filter') !important;
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
    if (browser && styleElement) {
      styleElement.remove();
    }
  });
</script>

<!-- Include the SVG filter directly in the component template -->
<svg width="0" height="0" style="position: absolute; z-index: -9999; visibility: hidden;">
  <defs>
    <filter id="night-mode-filter" color-interpolation-filters="sRGB">
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
</svg>