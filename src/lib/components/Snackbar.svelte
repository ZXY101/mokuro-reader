<script lang="ts">
	import { snackbarStore } from '$lib/util/snackbar';
	import { Toast } from 'flowbite-svelte';
	import { CheckCircleSolid, FireOutline } from 'flowbite-svelte-icons';
	import { fade, fly } from 'svelte/transition';
</script>

{#if $snackbarStore?.message && $snackbarStore?.visible}
	<Toast position="bottom-right">{$snackbarStore?.message}</Toast>
{/if}

<style lang="scss">
	div {
		position: fixed;
		right: 10px;
		bottom: 10px;
		padding: 20px;
		border-radius: 6px;
		border: 1px solid $secondary-color;
		min-width: 250px;
		display: flex;
		z-index: 2;
	}
</style>
