<script lang="ts">
	import { snackbarStore } from '$lib/util/snackbar';
	import { fade, fly } from 'svelte/transition';
</script>

{#if $snackbarStore?.message && $snackbarStore?.visible}
	<div in:fly={{ y: 200, duration: 500 }} out:fade={{ duration: 500 }}>
		{$snackbarStore?.message}
	</div>
{/if}

<style lang="scss">
	div {
		background-color: rgba($primary-accent-color, 0.9);
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
