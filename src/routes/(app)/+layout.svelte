<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { navigating } from '$app/stores';
	import { currentManga } from '$lib/catalog';
	import Button from '$lib/components/Button.svelte';
	import NavBar from '$lib/components/NavBar.svelte';
	import '../../app.css';

	afterNavigate(({}) => {
		window.document.body.classList.remove('reader');
	});
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
