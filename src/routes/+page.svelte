<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import Catalog from '$lib/components/Catalog.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { showSnackbar } from '$lib/util/snackbar';

	function onClick() {
		goto('/upload');
	}

	let modal: HTMLDialogElement;
</script>

<Button variant="secondary" on:click={onClick}>Upload</Button>
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
