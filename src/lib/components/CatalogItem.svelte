<script lang="ts">
	import { goto } from '$app/navigation';
	import { currentManga } from '$lib/catalog';
	import type { Manga } from '$lib/types/catalog';
	import Button from './Button.svelte';

	export let manga: Manga;
	const { cover, currentPage, title, totalPages } = manga;

	function onClick() {
		currentManga.set(manga);
	}
</script>

<a href={title} on:click={onClick}>
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
