<script lang="ts">
	import { snackbarStore } from '$lib/util/snackbar';
	import { Toast } from 'flowbite-svelte';
</script>

{#if $snackbarStore?.message && $snackbarStore?.visible}
	<Toast position="bottom-right">{$snackbarStore?.message}</Toast>
{/if}
