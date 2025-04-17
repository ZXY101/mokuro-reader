<script lang="ts">
  import '../app.postcss';
  import { browser, dev } from '$app/environment';
  import { inject } from '@vercel/analytics';
  import { onMount } from 'svelte';

  import NavBar from '$lib/components/NavBar.svelte';
  import Snackbar from '$lib/components/Snackbar.svelte';
  import ConfirmationPopup from '$lib/components/ConfirmationPopup.svelte';
  import ExtractionModal from '$lib/components/ExtractionModal.svelte';
  import ProgressTracker from '$lib/components/ProgressTracker.svelte';
  import NightModeFilter from '$lib/components/NightModeFilter.svelte';
  import { initGoogleDriveApi } from '$lib/util';

  interface Props {
    children?: import('svelte').Snippet;
  }

  let { children }: Props = $props();

  inject({ mode: dev ? 'development' : 'production' });

  // Start thumbnail processing only in browser environment
  if (browser) {
    import('$lib/catalog/thumbnails');
  }
  
  // Initialize Google Drive API in browser environment
  onMount(() => {
    if (browser) {
      // Initialize Google Drive API
      initGoogleDriveApi().catch(error => {
        console.error('Failed to initialize Google Drive API:', error);
      });
    }
  });
</script>

<div class=" h-full min-h-[100svh] text-white">
  <NavBar />
  {@render children?.()}
  <Snackbar />
  <ConfirmationPopup />
  <ExtractionModal />
  <ProgressTracker />
  <NightModeFilter />
</div>
