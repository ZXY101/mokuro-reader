<script lang="ts">
	import img from '$lib/assets/000a.jpg';
	import Button from '$lib/components/Button.svelte';
	import panzoom from 'panzoom';
	import type { PanZoom } from 'panzoom';
	import { writable } from 'svelte/store';

	export const pz = writable<PanZoom | undefined>(undefined);

	function initPanzoom(node: any) {
		pz.set(
			panzoom(node, {
				bounds: false,
				maxZoom: 10,
				minZoom: 0.1,
				zoomDoubleClickSpeed: 1,
				enableTextSelection: true,
				beforeMouseDown: (e) => {
					const nodeName = (e.target as HTMLElement).nodeName;
					return nodeName === 'P';
				},
				beforeWheel: (e) => e.altKey,
				onTouch: (e) => e.touches.length > 1
			})
		);
	}

	function test() {
		$pz?.moveTo(0, 0);
	}
</script>

<div>
	<Button variant="primary" on:click={test}>Click</Button>

	<div id="container" use:initPanzoom>
		<p draggable="false">my selectable tex</p>
		<img draggable="false" src={img} alt="a" />
	</div>
</div>
