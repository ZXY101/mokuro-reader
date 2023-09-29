<script lang="ts">
  import '../app.postcss';
  import NavBar from '$lib/components/NavBar.svelte';
  import Snackbar from '$lib/components/Snackbar.svelte';
  import ConfirmationPopup from '$lib/components/ConfirmationPopup.svelte';
  import { settings } from '$lib/settings';
</script>

<div class=" h-full min-h-[100svh] text-white">
  <NavBar />
  <slot />
  <Snackbar />
  <ConfirmationPopup />
</div>
