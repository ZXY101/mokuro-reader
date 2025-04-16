<script lang="ts">
  import { settings } from '$lib/settings';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';

  // Function to apply the night mode filter using CSS variables
  function applyNightModeFilter() {
    if (!browser) return;
    
    // Get the document's root element
    const rootElement = document.documentElement;
    
    // Set the CSS variable based on the night mode setting
    if ($settings.nightMode) {
      rootElement.style.setProperty('--night-mode-filter', 'url(#night-mode-filter)');
    } else {
      rootElement.style.setProperty('--night-mode-filter', 'none');
    }
  }

  // Watch for changes to the night mode setting
  $: if (browser && $settings) {
    applyNightModeFilter();
  }

  // Set up
  onMount(() => {
    applyNightModeFilter();
  });
</script>

<!-- No visible elements - just applies the filter via CSS variables -->