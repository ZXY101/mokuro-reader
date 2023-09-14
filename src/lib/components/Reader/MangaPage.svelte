<script lang="ts">
	import { settingsStore } from '$lib/settings';
	import type { Page } from '$lib/types';
	import { clamp } from '$lib/util';

	export let page: Page;
	export let left: () => void;
	export let right: () => void;

	$: fontWeight = $settingsStore.boldFont ? 'bold' : '400';

	$: textBoxes = page.blocks.map((block) => {
		const { img_height, img_width } = page;
		const { box, font_size, lines, vertical } = block;

		let [_xmin, _ymin, _xmax, _ymax] = box;

		const xmin = clamp(_xmin, 0, img_width);
		const ymin = clamp(_ymin, 0, img_height);
		const xmax = clamp(_xmax, 0, img_width);
		const ymax = clamp(_ymax, 0, img_height);

		const width = xmax - xmin;
		const height = ymax - ymin;

		const textBox = {
			left: `${xmin}px`,
			top: `${ymin}px`,
			width: `${width}px`,
			height: `${height}px`,
			fontSize: `${font_size}px`,
			writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
			lines
		};

		return textBox;
	});

	export let src: Blob;
</script>

<div
	draggable="false"
	style:width={`${page.img_width}px`}
	style:height={`${page.img_height}px`}
	style:background-image={`url(${URL.createObjectURL(src)})`}
>
	{#each textBoxes as { left, top, width, height, lines, fontSize, writingMode }}
		<div
			class="text-box"
			style:width
			style:height
			style:left
			style:top
			style:font-size={fontSize}
			style:writing-mode={writingMode}
			style:font-weight={fontWeight}
		>
			{#each lines as line}
				<p>{line}</p>
			{/each}
		</div>
		<div />
	{/each}
	<button
		on:click={left}
		class={`left-0 top-0 absolute h-full w-[200%]`}
		style:margin-left={page.img_width * -2 + 'px'}
	/>
	<button
		on:click={right}
		class={`right-0 top-0 absolute h-full w-[200%]`}
		style:margin-right={page.img_width * -2 + 'px'}
	/>
</div>

<style>
	div {
		position: relative;
		margin: 0 auto;
	}

	.text-box {
		color: black;
		padding: 0;
		position: absolute;
		line-height: 1.1em;
		font-size: 16pt;
		white-space: nowrap;
		border: 1px solid rgba(0, 0, 0, 0);
	}
	.text-box:hover {
		background: rgb(255, 255, 255);
		border: 1px solid rgba(0, 0, 0, 0);
		z-index: 999 !important;
	}
	.text-box p {
		display: none;
		white-space: nowrap;
		letter-spacing: 0.1em;
		line-height: 1.1em;
		margin: 0;
		background-color: rgb(255, 255, 255);
		font-weight: var(--bold);
	}

	.text-box:hover p {
		display: table;
	}
</style>
