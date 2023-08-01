<script lang="ts">
	import { colors } from '$lib/theme';

	export let title: string | undefined = undefined;
</script>

<nav>
	<div style:background-color={colors.primaryColor}>
		{#if title}
			<a href="/"><h2>Back</h2></a>
			<h2>{title}</h2>
		{:else}
			<a href="/"><h2>Mokuro</h2></a>
		{/if}
	</div>
</nav>

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
		padding: 0 10px 0 10px;
		align-items: center;
		z-index: 1;
	}
</style>
