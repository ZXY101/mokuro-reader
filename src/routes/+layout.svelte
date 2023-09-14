<script lang="ts">
	import '../app.postcss';
	import NavBar from '$lib/components/NavBar.svelte';
	import Snackbar from '$lib/components/Snackbar.svelte';
	import ConfirmationPopup from '$lib/components/ConfirmationPopup.svelte';
	import { settings } from '$lib/settings';
</script>

<div
	class="h-full min-h-screen w-full min-w-max text-white"
	style:background-color={$settings.backgroundColor}
>
	<NavBar />
	<Snackbar />
	<ConfirmationPopup />
	<slot />
</div>
