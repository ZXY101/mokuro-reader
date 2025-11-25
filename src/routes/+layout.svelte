<script lang="ts">
  import '../app.css';
  import { dev } from '$app/environment';
  import { inject } from '@vercel/analytics';
  import { onMount } from 'svelte';
  import NavBar from '$lib/components/NavBar.svelte';
  import Snackbar from '$lib/components/Snackbar.svelte';
  import ConfirmationPopup from '$lib/components/ConfirmationPopup.svelte';
  import ExtractionModal from '$lib/components/ExtractionModal.svelte';
  import ImageOnlyImportModal from '$lib/components/ImageOnlyImportModal.svelte';
  import ProgressTracker from '$lib/components/ProgressTracker.svelte';
  import NightModeFilter from '$lib/components/NightModeFilter.svelte';
  import GlobalDropZone from '$lib/components/GlobalDropZone.svelte';
  import { initializeProviders } from '$lib/util/sync/init-providers';
  import { initFileHandler } from '$lib/util/file-handler';

  interface Props {
    children?: import('svelte').Snippet;
  }

  let { children }: Props = $props();

  inject({ mode: dev ? 'development' : 'production' });

  // Initialize sync providers on app startup (non-blocking)
  onMount(() => {
    // Fire and forget - don't block app initialization
    initializeProviders().catch((error) => {
      console.error('Failed to initialize providers:', error);
    });

    // Initialize file handler for PWA file associations
    initFileHandler();
  });
</script>

<div class=" h-full min-h-[100svh] text-white">
  <NavBar />
  {@render children?.()}
  <Snackbar />
  <ConfirmationPopup />
  <ExtractionModal />
  <ImageOnlyImportModal />
  <ProgressTracker />
  <NightModeFilter />
  <GlobalDropZone />
</div>
