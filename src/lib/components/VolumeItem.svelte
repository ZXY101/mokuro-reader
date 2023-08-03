<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { currentManga, currentVolume } from '$lib/catalog';
	import type { Volume } from '$lib/types/catalog';

	export let volume: Volume;
	const { cover, title, currentPage, totalPages } = volume;

	function onClick() {
		currentVolume.set(volume);
	}
</script>

<a href={`${$page.params.manga}/${title}`} on:click={onClick}>
	<div class="content">
		{title}
		<img src={cover} alt={title} />
		{currentPage} / {totalPages}
	</div>
</a>

<style>
	img {
		width: 250px;
		height: 350px;
		object-fit: contain;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 5px;
		text-align: center;
	}
</style>
