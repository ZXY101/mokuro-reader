<script lang="ts">
	import { currentManga } from '$lib/catalog';
	import type { Volume } from '$lib/types';
	export let manga: Volume[];
	const { volumeName, files, mokuroData } = manga[0];

	function onClick() {
		currentManga.set(manga);
	}
</script>

<a href={volumeName} on:click={onClick}>
	<div class="content">
		{mokuroData.title}
		{#if files}
			<img src={URL.createObjectURL(Object.values(files)[0])} alt="img" />
		{/if}
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
