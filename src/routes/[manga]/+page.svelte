<script lang="ts">
	import Panzoom from '$lib/panzoom/Panzoom.svelte';
	import { currentManga } from '$lib/catalog';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	const manga = $currentManga;
</script>

{#if manga}
	<Panzoom>
		<img draggable="false" src={manga.cover} alt={manga.title} />
	</Panzoom>
{/if}

<style>
	h2 {
		z-index: 1;
		position: fixed;
		left: 10px;
	}
</style>
