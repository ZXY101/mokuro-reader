<script lang="ts">
	import type { Page } from '$lib/types';

	export let page: Page;

	let bold = false;

	$: fontWeight = bold ? 'bold' : '400';

	function clamp(x: number, min: number, max: number) {
		return Math.min(Math.max(x, min), max);
	}

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

	export let src;
</script>

<div style:--bold={fontWeight}>
	<div class="bold">
		<label>Bold</label>
		<input bind:checked={bold} type="checkbox" placeholder="????" />
	</div>
	<img draggable="false" src={URL.createObjectURL(src)} alt="img" />
	{#each textBoxes as { left, top, width, height, lines, fontSize, writingMode }}
		<div
			class="text-box"
			style:width
			style:height
			style:left
			style:top
			style:font-size={fontSize}
			style:writing-mode={writingMode}
		>
			{#each lines as line}
				<p>{line}</p>
			{/each}
		</div>
		<div />
	{/each}
</div>

<style>
	div {
		position: relative;
		margin: 0 auto;
	}

	.bold {
		position: absolute;
		color: #000;
		right: 10px;
		bottom: 10px;
		z-index: 99;
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
