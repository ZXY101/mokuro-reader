<script lang="ts">
	import '../app.postcss';
	import NavBar from '$lib/components/NavBar.svelte';
	import Snackbar from '$lib/components/Snackbar.svelte';
	import '../app.scss';
</script>

<NavBar />
<Snackbar />

<div>
	<slot />
</div>
