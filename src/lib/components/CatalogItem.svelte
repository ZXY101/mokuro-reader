<script lang="ts">
	import { currentManga } from '$lib/catalog';
	import type { Manga } from '$lib/types/catalog';
	import { navbarTitle } from './NavBar.svelte';
	export let manga: Manga;
	const { cover, title } = manga;

	function onClick() {
		console.log('bruh');

		navbarTitle.set(title);
		currentManga.set(manga);
	}
</script>

<a href={title} on:click={onClick}>
	<div class="content">
		{title}
		<img src={cover} alt={title} />
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
