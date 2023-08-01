<script lang="ts">
	import img from '$lib/assets/000a.jpg';
	import Button from '$lib/components/Button.svelte';
	import { pz, Panzoom } from '$lib/panzoom';

	function test() {
		$pz?.moveTo(0, 0);
	}
</script>

<div>
	<Button variant="primary" on:click={test}>Click</Button>

	<Panzoom>
		<p draggable="false">my selectable tex</p>
		<img draggable="false" src={img} alt="a" />
	</Panzoom>
</div>
