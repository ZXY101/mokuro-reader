<script lang="ts">
	import { catalog } from '$lib/catalog';
	import CatalogItem from './CatalogItem.svelte';
</script>

{#if $catalog && $catalog.length > 0}
	<div class="container">
		{#each $catalog as { manga }}
			<CatalogItem {manga} />
		{/each}
	</div>
{:else}
	<div class="empty-state">
		<p>Your catalog is currently empty.</p>
		<a href="upload">Add manga</a>
	</div>
{/if}

<style lang="scss">
	.container {
		display: flex;
		flex-direction: row;
		gap: 20px;
		flex-wrap: wrap;
	}

	.empty-state {
		text-align: center;
		padding: 20px;
	}

	a {
		color: $secondary-accent-color;
	}
</style>
