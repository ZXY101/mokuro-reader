<script lang="ts">
	import { currentManga } from '$lib/catalog';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Button from '$lib/components/Button.svelte';
	import { panAlign, Panzoom, zoomOriginal } from '$lib/panzoom';
	import VolumeItem from '$lib/components/VolumeItem.svelte';

	const manga = $currentManga;

	onMount(() => {
		if (!manga) {
			goto('/');
		}
	});
</script>

<div>
	{#if manga}
		{#each manga.volumes as volume}
			<VolumeItem {volume} />
		{/each}
	{/if}
</div>

<style>
	div {
		display: flex;
		flex-direction: row;
		gap: 20px;
		flex-wrap: wrap;
	}
</style>
