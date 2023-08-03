<script lang="ts">
	import NavBar from '$lib/components/NavBar.svelte';
	import '../app.css';
</script>

<NavBar />

<div>
	<slot />
</div>

<style>
	div {
		padding: 10px;
	}
</style>
