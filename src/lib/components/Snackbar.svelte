<script lang="ts">
	import { colorAlpha, colors } from '$lib/theme';
	import { snackbarStore } from '$lib/util/snackbar';
	import { fade, fly } from 'svelte/transition';
</script>

{#if $snackbarStore?.message && $snackbarStore?.visible}
	<div
		in:fly={{ y: 200, duration: 500 }}
		out:fade={{ duration: 500 }}
		style:--background={colorAlpha(colors.primaryAccentColor, 0.9)}
		style:--border={colors.secondaryColor}
		class="toast"
	>
		{$snackbarStore?.message}
	</div>
{/if}

<style>
	.toast {
		background-color: var(--background);
		position: fixed;
		right: 10px;
		bottom: 10px;
		padding: 20px;
		border-radius: 6px;
		border: 1px solid var(--border);
		min-width: 250px;
		display: flex;
	}
</style>
