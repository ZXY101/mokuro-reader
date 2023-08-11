<script lang="ts" context="module">
	export let navbarTitle = writable<string | undefined>(undefined);
</script>

<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';

	import { currentManga, currentVolume } from '$lib/catalog';

	import { writable } from 'svelte/store';
	let title: string | undefined = 'Mokuro';
	let back: string | undefined = undefined;

	afterNavigate(() => {
		window.document.body.classList.remove('reader');

		switch ($page?.route.id) {
			case '/[manga]':
				title = $currentManga?.[0].mokuroData.title;
				back = '/';
				break;
			case '/[manga]/[volume]':
				window.document.body.classList.add('reader');
				title = $currentVolume?.volumeName;
				back = '/manga';
				break;
			case '/upload':
				title = 'Upload';
				back = '/';
				break;
			default:
				title = 'Mokuro';
				back = undefined;
				break;
		}
	});
</script>

<nav>
	<div>
		{#if back}
			<a href={back}><h2>Back</h2></a>
			<h2>{title}</h2>
		{:else}
			<a href="/"><h2>{title}</h2></a>
		{/if}
	</div>
</nav>

<style lang="scss">
	nav {
		position: relative;
		width: 100%;
		z-index: 1;
	}
	div {
		background-color: $primary-color;
		display: flex;
		flex: 1;
		justify-content: space-between;
		padding: 0 10px 0 10px;
		align-items: center;
		z-index: 1;
	}
</style>
