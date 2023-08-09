<script lang="ts">
	import { currentManga, currentVolume } from '$lib/catalog';
	import Button from '$lib/components/Button.svelte';
	import { Panzoom, zoomOriginal } from '$lib/panzoom';
	import MangaPage from './MangaPage.svelte';

	const volume = $currentVolume;
	let page = 1;

	let pages = volume?.mokuroData.pages;
	function right() {
		page++;
	}

	function left() {
		if (page > 1) {
			page--;
		}
	}
</script>

{#if volume}
	<div>
		<Button on:click={zoomOriginal}>Reset Zoom</Button>
		<Button on:click={left}>{'<'}</Button>
		<Button on:click={right}>{'>'}</Button>
	</div>
	<Panzoom>
		<MangaPage page={pages[page - 1]} src={Object.values(volume?.files)[page - 1]} />
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
