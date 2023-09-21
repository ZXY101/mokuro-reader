<script lang="ts">
	import { currentVolume } from '$lib/catalog';
	import { Panzoom } from '$lib/panzoom';
	import { progress, settings, updateProgress } from '$lib/settings';
	import { clamp } from '$lib/util';
	import MangaPage from './MangaPage.svelte';

	const volume = $currentVolume;
	const pages = volume?.mokuroData.pages;

	$: page = $progress?.[volume?.mokuroData.volume_uuid || 0] || 1;
	$: index = page - 1;
	$: navAmount = $settings.singlePageView ? 1 : 2;

	let start: Date;

	function mouseDown() {
		start = new Date();
	}

	function left() {
		const newPage = $settings.rightToLeft ? page + navAmount : page - navAmount;
		changePage(newPage);
	}

	function right() {
		const newPage = $settings.rightToLeft ? page - navAmount : page + navAmount;
		changePage(newPage);
	}

	function changePage(newPage: number) {
		const end = new Date();
		const clickDuration = end.getTime() - start.getTime();
		if (pages && volume && clickDuration < 200) {
			updateProgress(volume.mokuroData.volume_uuid, clamp(newPage, 1, pages?.length));
		}
	}
</script>

{#if volume && pages}
	<div
		class="absolute opacity-50 left-5 top-5 z-10 mix-blend-difference"
		class:hidden={!$settings.pageNum}
	>
		{page}/{pages.length}
	</div>
	<Panzoom>
		<div class="flex flex-row justify-center">
			{#if !$settings.singlePageView && index + 1 < pages.length}
				<MangaPage page={pages[index + 1]} src={Object.values(volume?.files)[index + 1]} />
			{/if}
			<MangaPage page={pages[index]} src={Object.values(volume?.files)[index]} />
		</div>
	</Panzoom>
	<button
		style:width={'10%'}
		on:mousedown={mouseDown}
		on:mouseup={left}
		class="left-0 top-0 absolute h-full"
	/>
	<button
		style:width={'10%'}
		on:mousedown={mouseDown}
		on:mouseup={right}
		class="right-0 top-0 absolute h-full"
	/>
{/if}
