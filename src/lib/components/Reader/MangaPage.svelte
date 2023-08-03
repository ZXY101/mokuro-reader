<script lang="ts">
	import img from '$lib/assets/001.jpg';

	type Block = {
		box: number[];
		vertical: boolean;
		fontSize: number;
		lines: string[];
	};

	type Page = {
		version?: string;
		imgWidth: number;
		imgHeight: number;
		blocks: Block[];
		imgPath: string;
	};

	let page: Page = {
		version: '0.1.6',
		imgWidth: 1078,
		imgHeight: 1530,
		blocks: [
			{
				box: [924, 167, 948, 380],
				vertical: true,
				fontSize: 21.0,
				lines: ['私も頑張らなくちゃ！']
			},
			{
				box: [584, 242, 610, 397],
				vertical: true,
				fontSize: 26.0,
				lines: ['リョウ先輩！']
			},
			{
				box: [895, 474, 943, 687],
				vertical: true,
				fontSize: 20.0,
				lines: ['私のギターの練習', 'みてもらえませんか！']
			},
			{
				box: [898, 787, 947, 979],
				vertical: true,
				fontSize: 21.0,
				lines: ['ぼっちに教えて', 'もらってるじゃん？']
			},
			{
				box: [708, 796, 783, 936],
				vertical: true,
				fontSize: 20.0,
				lines: ['〜〜っ', 'もっと練習', 'したいんです！！']
			},
			{
				box: [663, 832, 701, 971],
				vertical: true,
				fontSize: 20.0,
				lines: ['後藤さんだって', '？の練習あるし．．．']
			},
			{
				box: [568, 800, 616, 1011],
				vertical: true,
				fontSize: 20.0,
				lines: ['ちょっと喜多ちゃん', '急にどうしちゃったの']
			},
			{
				box: [874, 1122, 951, 1380],
				vertical: true,
				fontSize: 22.0,
				lines: ['まさか結束パンドの', 'ギター同士で血で血を洗う', 'パート争いを．．．']
			},
			{
				box: [636, 1135, 682, 1256],
				vertical: true,
				fontSize: 20.0,
				lines: ['ちょっと', '結束してよ〜']
			},
			{
				box: [560, 1240, 590, 1381],
				vertical: true,
				fontSize: 27.0,
				lines: ['違います！！']
			}
		],
		imgPath: '049.jpg'
	};

	let bold = false;

	$: fontWeight = bold ? 'bold' : '400';

	console.log(bold);

	function clamp(x: number, min: number, max: number) {
		return Math.min(Math.max(x, min), max);
	}

	const { blocks, imgHeight, imgPath, imgWidth } = page;
	const area = imgWidth * imgHeight;

	const textBoxes = blocks.map((block) => {
		const { box, fontSize, lines, vertical } = block;
		let [_xmin, _ymin, _xmax, _ymax] = box;

		const xmin = clamp(_xmin, 0, imgWidth);
		const ymin = clamp(_ymin, 0, imgHeight);
		const xmax = clamp(_xmax, 0, imgWidth);
		const ymax = clamp(_ymax, 0, imgHeight);

		const width = xmax - xmin;
		const height = ymax - ymin;

		const textBox = {
			left: `${xmin}px`,
			top: `${ymin}px`,
			width: `${width}px`,
			height: `${height}px`,
			fontSize: `${fontSize}px`,
			writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
			lines
		};

		console.log(textBox);

		return textBox;
	});
	let src = `/src/lib/assets/${imgPath}`;
</script>

<div style:--bold={fontWeight}>
	<div class="bold">
		<label>Bold</label>
		<input bind:checked={bold} type="checkbox" placeholder="????" />
	</div>
	<img draggable="false" {src} alt="Page 1" />
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
