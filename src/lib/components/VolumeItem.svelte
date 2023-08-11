<script lang="ts">
	import { page } from '$app/stores';
	import { currentVolume } from '$lib/catalog';
	import type { Volume } from '$lib/types';

	export let volume: Volume;
	const { volumeName, files } = volume;

	function onClick() {
		currentVolume.set(volume);
	}
</script>

<a href={`${$page.params.manga}/${volumeName}`} on:click={onClick}>
	<div class="content">
		{volumeName}
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
