<script lang="ts">
	import { currentManga } from '$lib/catalog';
	import NavBar from '$lib/components/NavBar.svelte';
	import { onMount } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import '../../app.css';

	const manga = $currentManga;

	onMount(() => {
		if (!manga) {
			goto('/');
			window.document.body.classList.remove('reader');
		} else {
			window.document.body.classList.add('reader');
		}
	});
</script>

<NavBar title={manga?.title} />
<slot />

<style>
	:global(body.reader) {
		overflow: hidden;
	}
</style>
