<script lang="ts">
  import { settings } from '$lib/settings';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';

  // Create a style element to hold our CSS filter
  let styleElement: HTMLStyleElement | null = null;

  // Function to apply the night mode filter
  function applyNightModeFilter() {
    if (!browser) return;
    
    // Create style element if it doesn't exist
    if (!styleElement) {
      styleElement = document.createElement('style');
      document.head.appendChild(styleElement);
    }
    
    // Apply the CSS filter that converts colors to red based on luminosity
    if ($settings.nightMode) {
      styleElement.textContent = `
        html {
          filter: grayscale(100%) sepia(100%) hue-rotate(0deg) saturate(60%) brightness(0.8) !important;
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

<!-- This component doesn't render any visible elements, it just applies the CSS filter -->