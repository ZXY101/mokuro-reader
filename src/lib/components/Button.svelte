<script lang="ts">
	type ButtonType = 'primary' | 'secondary' | 'tertiary' | 'danger';

	export let variant: ButtonType = 'primary';
</script>

<button class={variant} {...$$restProps} on:click>
	<slot />
</button>

<style lang="scss">
	@mixin button(
		$bg-color: $primary-color,
		$color: $secondary-color,
		$active-color: $primary-accent-color
	) {
		border-style: none;
		border-radius: 6px;
		padding: 2px 10px 2px 10px;
		font-family: $font-family;
		height: 40px;
		max-height: 40px;
		font-weight: bold;
		color: $color;
		border: 1px solid;
		background-color: $bg-color;

		&:hover {
			cursor: pointer;
		}
		&:active {
			background-color: $active-color;
		}
	}

	.primary {
		@include button();
	}
	.secondary {
		@include button($secondary-color, $primary-color, $secondary-accent-color);
	}

	.tertiary {
		@include button(transparent, $secondary-color, $primary-accent-color);
	}

	.danger {
		@include button($danger-accent-color, $danger-color, $danger-active-color);
	}
</style>
