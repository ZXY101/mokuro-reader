<script lang="ts">
	import { currentVolume } from '$lib/catalog';
	import { Panzoom, zoomFitToScreen, zoomFitToWidth, zoomOriginal } from '$lib/panzoom';
	import { progress, settings, updateProgress } from '$lib/settings';
	import { clamp } from '$lib/util';
	import { Button, Input, Popover, Range } from 'flowbite-svelte';
	import MangaPage from './MangaPage.svelte';
	import { ChervonDoubleLeftSolid, ChervonDoubleRightSolid } from 'flowbite-svelte-icons';

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

	$: manualPage = page;
	$: pageDisplay = `${page}/${pages?.length}`;

	function onInputClick(this: any) {
		this.select();
	}

	function onManualPageChange() {
		page = clamp(manualPage, 1, pages!.length);
	}
</script>

{#if volume && pages}
	<Popover placement="bottom-end" trigger="click" triggeredBy="#page-num" class="z-20">
		<div class="flex flex-col gap-3">
			<div class="flex flex-row items-center gap-5 z-10">
				<ChervonDoubleLeftSolid on:click={() => (page = 1)} class="hover:text-primary-600" />
				<Input
					type="number"
					size="sm"
					defaultClass="select-all"
					bind:value={manualPage}
					on:click={onInputClick}
					on:change={onManualPageChange}
				/>
				<ChervonDoubleRightSolid
					on:click={() => (page = pages.length)}
					class="hover:text-primary-600"
				/>
			</div>
			<Range
				min={1}
				max={pages.length}
				size="sm"
				bind:value={manualPage}
				on:change={onManualPageChange}
			/>
		</div>
	</Popover>
	<button
		class="absolute opacity-50 left-5 top-5 z-10 mix-blend-difference"
		class:hidden={!$settings.pageNum}
		id="page-num"
	>
		{pageDisplay}
	</button>
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
	<div class="absolute left-5 bottom-5">
		<Button on:click={zoomOriginal}>zoomOriginal</Button>
		<Button on:click={zoomFitToWidth}>zoomFitToWidth</Button>
		<Button on:click={zoomFitToScreen}>zoomFitToScreen</Button>
	</div>
{/if}
