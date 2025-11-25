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
  import ViewRouter from '$lib/components/ViewRouter.svelte';
  import { initializeProviders } from '$lib/util/sync/init-providers';
  import { initFileHandler } from '$lib/util/file-handler';
  import { initViewFromUrl, navigateBack, currentView } from '$lib/util/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';

  interface Props {
    children?: import('svelte').Snippet;
  }

  let { children }: Props = $props();

  inject({ mode: dev ? 'development' : 'production' });

  // Handle global Escape key for back navigation
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      // Don't interfere with Escape on inputs or textareas
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Only navigate back if not already on catalog
      const view = get(currentView);
      if (view.type !== 'catalog') {
        event.preventDefault();
        navigateBack();
      }
    }
  }

  // Initialize sync providers on app startup (non-blocking)
  onMount(() => {
    // Fire and forget - don't block app initialization
    initializeProviders().catch((error) => {
      console.error('Failed to initialize providers:', error);
    });

    // Initialize file handler for PWA file associations
    initFileHandler();

    // Initialize view state from URL (for browser mode)
    const pageData = get(page);
    initViewFromUrl(pageData.params as { manga?: string; volume?: string }, pageData.url.pathname);
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class=" h-full min-h-[100svh] text-white">
  <NavBar />
  <ViewRouter>
    {@render children?.()}
  </ViewRouter>
  <Snackbar />
  <ConfirmationPopup />
  <ExtractionModal />
  <ImageOnlyImportModal />
  <ProgressTracker />
  <NightModeFilter />
  <GlobalDropZone />
</div>
