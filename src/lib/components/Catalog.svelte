<script lang="ts">
	import { catalog } from '$lib/catalog/test';
	import CatalogItem from './CatalogItem.svelte';
</script>

<div>
	{#if $catalog}
		{#each $catalog as { manga }}
			<CatalogItem {manga} />
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
