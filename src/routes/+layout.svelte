<script lang="ts">
	import NavBar from '$lib/components/NavBar.svelte';
	import Snackbar from '$lib/components/Snackbar.svelte';
	import '../app.css';
</script>

<NavBar />
<Snackbar />

<div>
	<slot />
</div>

<style>
	div {
		padding: 10px;
	}
</style>
