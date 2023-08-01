<script lang="ts">
	import { currentManga } from '$lib/catalog';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Button from '$lib/components/Button.svelte';
	import { panAlign, Panzoom, zoomOriginal } from '$lib/panzoom';

	const manga = $currentManga;
</script>

{#if manga}
	<div>
		<Button on:click={zoomOriginal}>Reset Zoom</Button>
	</div>
	<Panzoom>
		<img draggable="false" src={manga.cover} alt={manga.title} />
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
