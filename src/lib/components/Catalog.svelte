<script lang="ts">
	import { catalog } from '$lib/catalog';
	import { Button } from 'flowbite-svelte';
	import CatalogItem from './CatalogItem.svelte';
	import { promptConfirmation } from '$lib/util';
	import { db } from '$lib/catalog/db';

	function onClear() {
		promptConfirmation('Are you sure you want to clear your catalog?', () => db.catalog.clear());
	}
</script>

{#if $catalog}
	{#if $catalog.length > 0}
		<Button outline color="red" class="float-right" on:click={onClear}>Clear catalog</Button>
		<div class="container">
			{#each $catalog as { manga }}
				<CatalogItem {manga} />
			{/each}
		</div>
	{:else}
		<div class="empty-state">
			<p>Your catalog is currently empty.</p>
		</div>
	{/if}
{:else}
	<p>Loading...</p>
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
