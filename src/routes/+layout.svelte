<script lang="ts">
  import '../app.postcss';
  import { dev } from '$app/environment';
  import { inject } from '@vercel/analytics';
  import { onMount } from 'svelte';

  import NavBar from '$lib/components/NavBar.svelte';
  import Snackbar from '$lib/components/Snackbar.svelte';
  import ConfirmationPopup from '$lib/components/ConfirmationPopup.svelte';
  import ExtractionModal from '$lib/components/ExtractionModal.svelte';
  import ProgressTracker from '$lib/components/ProgressTracker.svelte';
  import NightModeFilter from '$lib/components/NightModeFilter.svelte';
  import { initializeProviders } from '$lib/util/sync/init-providers';
  import { enrichAllVolumesWithMetadata } from '$lib/settings/volume-data';

  interface Props {
    children?: import('svelte').Snippet;
  }

  let { children }: Props = $props();

  inject({ mode: dev ? 'development' : 'production' });

  // Initialize sync providers and enrich metadata on app startup (non-blocking)
  onMount(() => {
    // Enrich volume metadata while volumes still exist in IndexedDB
    // This ensures stats work even after volumes are deleted
    enrichAllVolumesWithMetadata().catch((error) => {
      console.error('Failed to enrich volume metadata:', error);
    });

    // Initialize sync providers - fire and forget, don't block app initialization
    initializeProviders().catch((error) => {
      console.error('Failed to initialize providers:', error);
    });
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
