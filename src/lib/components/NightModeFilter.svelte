<script lang="ts">
  import { settings } from '$lib/settings';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';

  // Create style element to hold our filter application
  let styleElement: HTMLStyleElement | null = null;

  // Function to apply the night mode filter
  function applyNightModeFilter() {
    if (!browser) return;
    
    // Create style element if it doesn't exist
    if (!styleElement) {
      styleElement = document.createElement('style');
      document.head.appendChild(styleElement);
    }
    
    // Apply the filter - the SVG filter is already in the HTML
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

<!-- No SVG filter here - it's now in app.html -->