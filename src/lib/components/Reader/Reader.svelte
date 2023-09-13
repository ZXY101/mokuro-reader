<script lang="ts">
	import { currentVolume } from '$lib/catalog';
	import { Panzoom } from '$lib/panzoom';
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

{#if volume && pages}
	<Panzoom>
		<MangaPage page={pages[page - 1]} src={Object.values(volume?.files)[page - 1]} {left} {right} />
	</Panzoom>
{/if}
