<script lang="ts">
	import { currentManga } from '$lib/catalog';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import VolumeItem from '$lib/components/VolumeItem.svelte';
	import { Button, Modal } from 'flowbite-svelte';
	import { ExclamationCircleOutline } from 'flowbite-svelte-icons';
	import { db } from '$lib/catalog/db';

	const manga = $currentManga?.sort((a, b) => {
		if (a.volumeName < b.volumeName) {
			return -1;
		}
		if (a.volumeName > b.volumeName) {
			return 1;
		}
		return 0;
	});

	let popupModal = false;

	onMount(() => {
		if (!manga) {
			goto('/');
		}
	});

	function onDelete() {
		popupModal = true;
	}

	async function confirmDelete() {
		const title = manga?.[0].mokuroData.title_uuid;
		await db.catalog.delete(title);
		goto('/');
	}
</script>

<div class="float-right"><Button outline color="red" on:click={onDelete}>Delete manga</Button></div>
<div class="volumes">
	{#if manga}
		{#each manga as volume}
			<VolumeItem {volume} />
		{/each}
	{/if}
</div>

<Modal bind:open={popupModal} size="xs" autoclose>
	<div class="text-center">
		<ExclamationCircleOutline class="mx-auto mb-4 text-gray-400 w-12 h-12 dark:text-gray-200" />
		<h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
			Are you sure you want to delete this manga?
		</h3>
		<Button color="red" class="mr-2" on:click={confirmDelete}>Yes</Button>
		<Button color="alternative">No</Button>
	</div>
</Modal>

<style>
	.volumes {
		display: flex;
		flex-direction: row;
		gap: 20px;
		flex-wrap: wrap;
	}
</style>
