<script lang="ts">
	import { currentVolume } from '$lib/catalog';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	const volume = $currentVolume;

	onMount(() => {
		if (!volume) {
			goto('/');
		} else {
			console.log('???');

			window.document.body.classList.add('reader');
		}
	});
</script>

<slot />

<style>
	:global(body.reader) {
		overflow: hidden !important;
	}
</style>
