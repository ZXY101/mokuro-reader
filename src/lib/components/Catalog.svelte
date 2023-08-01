<script lang="ts">
	import image1 from '$lib/assets/1.jpg';
	import image2 from '$lib/assets/2.jpg';
	import image3 from '$lib/assets/3.jpg';
	import image4 from '$lib/assets/4.jpg';
	import image5 from '$lib/assets/5.jpg';
	import type { Manga } from '$lib/types/catalog';
	import CatalogItem from './CatalogItem.svelte';

	const manga: Manga[] = [
		{
			title: 'Manga name',
			cover: image1,
			currentPage: 26,
			totalPages: 100
		},
		{
			title: 'Another',
			cover: image2,
			currentPage: 0,
			totalPages: 120
		},
		{
			title: 'Awooo',
			cover: image3,
			currentPage: 69,
			totalPages: 96
		},
		{
			title: 'Title',
			cover: image4,
			currentPage: 9,
			totalPages: 59
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			currentPage: 19,
			totalPages: 200
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			currentPage: 19,
			totalPages: 200
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			currentPage: 19,
			totalPages: 200
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			currentPage: 19,
			totalPages: 200
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			currentPage: 19,
			totalPages: 200
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			currentPage: 19,
			totalPages: 200
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			currentPage: 19,
			totalPages: 200
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			currentPage: 19,
			totalPages: 200
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			currentPage: 19,
			totalPages: 200
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			currentPage: 19,
			totalPages: 200
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			currentPage: 19,
			totalPages: 200
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			currentPage: 19,
			totalPages: 200
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			currentPage: 19,
			totalPages: 200
		}
	];
</script>

<div>
	{#each manga as item}
		<CatalogItem manga={item} />
	{/each}
</div>

<style>
	div {
		display: flex;
		flex-direction: row;
		gap: 20px;
		flex-wrap: wrap;
	}
</style>
