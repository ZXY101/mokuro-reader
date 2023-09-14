<script lang="ts">
	import '../app.postcss';
	import NavBar from '$lib/components/NavBar.svelte';
	import Snackbar from '$lib/components/Snackbar.svelte';
	import ConfirmationPopup from '$lib/components/ConfirmationPopup.svelte';
	import { settingsStore } from '$lib/settings';
</script>

<div class="h-screen text-white" style:background-color={$settingsStore.backgroundColor}>
	<NavBar />
	<Snackbar />
	<ConfirmationPopup />
	<slot />
</div>
