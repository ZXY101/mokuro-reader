<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/catalog/db';
	import Button from '$lib/components/Button.svelte';
	import Catalog from '$lib/components/Catalog.svelte';
	import Modal from '$lib/components/Modal.svelte';

	function onClick() {
		goto('/upload');
	}

	function clear() {
		db.catalog.clear();
	}

	let modal: HTMLDialogElement;
</script>

<Button variant="secondary" on:click={onClick}>Upload</Button>
<Button variant="danger" on:click={clear}>Clear</Button>

<Modal bind:modal>
	<div slot="title">Title</div>
	<div slot="content">
		Content
		<input type="text" />
	</div>
	<div slot="action">
		<Button on:click={() => modal.close()}>Action</Button>
		<Button variant="secondary" on:click={() => modal.close()}>Close</Button>
	</div>
</Modal>
<Catalog />
