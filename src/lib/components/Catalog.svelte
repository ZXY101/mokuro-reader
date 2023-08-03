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
			volumes: [
				{
					cover: image1,
					title: 'Volume 1',
					currentPage: 0,
					totalPages: 100
				},
				{
					cover: image1,
					title: 'Volume 2',
					currentPage: 0,
					totalPages: 100
				}
			]
		},
		{
			title: 'Another',
			cover: image2,
			volumes: [
				{
					cover: image2,
					title: 'Volume 1',
					currentPage: 0,
					totalPages: 100
				},
				{
					cover: image2,
					title: 'Volume 2',
					currentPage: 0,
					totalPages: 100
				}
			]
		},
		{
			title: 'Awooo',
			cover: image3,
			volumes: [
				{
					cover: image3,
					title: 'Volume 1',
					currentPage: 0,
					totalPages: 100
				},
				{
					cover: image3,
					title: 'Volume 2',
					currentPage: 0,
					totalPages: 100
				}
			]
		},
		{
			title: 'Title',
			cover: image4,
			volumes: [
				{
					cover: image4,
					title: 'Volume 1',
					currentPage: 0,
					totalPages: 100
				},
				{
					cover: image4,
					title: 'Volume 2',
					currentPage: 0,
					totalPages: 100
				}
			]
		},
		{
			title: 'sdhfjksdh',
			cover: image5,
			volumes: [
				{
					cover: image5,
					title: 'Volume 1',
					currentPage: 0,
					totalPages: 100
				},
				{
					cover: image5,
					title: 'Volume 2',
					currentPage: 0,
					totalPages: 100
				}
			]
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
