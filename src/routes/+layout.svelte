<script lang="ts">
	import '../app.postcss';
	import NavBar from '$lib/components/NavBar.svelte';
	import Snackbar from '$lib/components/Snackbar.svelte';
	import '../app.scss';
	import ConfirmationPopup from '$lib/components/ConfirmationPopup.svelte';
</script>

<NavBar />
<Snackbar />
<ConfirmationPopup />

<div>
	<slot />
</div>
