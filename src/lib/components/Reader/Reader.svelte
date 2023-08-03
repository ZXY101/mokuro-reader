<script lang="ts">
	import { currentManga, currentVolume } from '$lib/catalog';
	import Button from '$lib/components/Button.svelte';
	import { Panzoom, zoomOriginal } from '$lib/panzoom';
	import MangaPage from './MangaPage.svelte';

	const volume = $currentVolume;
</script>

{#if volume}
	<div>
		<Button on:click={zoomOriginal}>Reset Zoom</Button>
	</div>
	<Panzoom>
		<MangaPage />
	</Panzoom>
{/if}

<style>
	div {
		position: absolute;
		bottom: 10px;
		left: 10px;
		z-index: 1;
	}
</style>
