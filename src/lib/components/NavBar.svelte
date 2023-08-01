<script lang="ts">
	import { colors } from '$lib/theme';
	import Button from './Button.svelte';

	let expanded = true;

	function toggle() {
		expanded = !expanded;
	}
	let color = colors.secondaryColor;
</script>

{#if expanded}
	<nav>
		<div>
			<h2>Mokuro</h2>
			<Button variant="secondary" on:click={toggle}>Settings</Button>
		</div>
	</nav>
{:else}
	<button on:click={toggle} class="svg">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line
				x1="3"
				y1="18"
				x2="21"
				y2="18"
			/></svg
		>
	</button>
{/if}

<style>
	nav {
		position: relative;
		width: 100%;
		z-index: 1;
	}
	div {
		display: flex;
		flex: 1;
		justify-content: space-between;
		background-color: var(--primary-color);
		padding: 0 10px 0 10px;
		align-items: center;
		z-index: 1;
	}
	.svg {
		padding: 10px;
		margin: 5px;
		position: fixed;
		border-radius: 2px;
		z-index: 1;
		right: 10px;
	}

	.svg:active {
		background-color: var(--primary-accent-color);
	}
	svg {
		z-index: 1;
	}
</style>
