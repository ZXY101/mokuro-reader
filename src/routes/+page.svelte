<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import Catalog from '$lib/components/Catalog.svelte';

	function onClick() {
		goto('/upload');
	}
</script>

<Button on:click={onClick}>Upload</Button>
<Catalog />
