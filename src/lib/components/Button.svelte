<script lang="ts">
	import { colors } from '$lib/theme';

	type ButtonType = 'primary' | 'secondary' | 'tertiary' | 'danger';

	export let variant: ButtonType = 'primary';

	function getStyles(buttonType: ButtonType) {
		switch (buttonType) {
			case 'primary':
				return {
					backgroundColor: colors.primaryColor,
					color: colors.secondaryColor,
					activeColor: colors.primaryAccentColor
				};
			case 'secondary':
				return {
					backgroundColor: colors.secondaryColor,
					color: colors.primaryColor,
					activeColor: colors.secondaryAccentColor
				};
			case 'tertiary':
				return {
					backgroundColor: 'transparent',
					color: colors.secondaryColor,
					activeColor: colors.primaryAccentColor
				};
			case 'danger':
				return {
					backgroundColor: colors.dangerAccentColor,
					color: colors.dangerColor,
					activeColor: colors.dangerActivecolor
				};
		}
	}

	const { backgroundColor, color, activeColor } = getStyles(variant);
</script>

<button
	style:--color={color}
	style:--background-color={backgroundColor}
	style:--active={activeColor}
	on:click
>
	<slot />
</button>

<style>
	button {
		border-style: none;
		border-radius: 6px;
		padding: 2px 10px 2px 10px;
		font-family: var(--font-family);
		height: 40px;
		max-height: 40px;
		font-weight: bold;
		color: var(--color);
		border: 1px solid;
		background-color: var(--background-color);
	}

	button:hover {
		cursor: pointer;
	}

	button:active {
		background-color: var(--active);
	}
</style>
