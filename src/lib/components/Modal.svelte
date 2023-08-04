<script lang="ts">
	export let modal: HTMLDialogElement;

	function closeClicked() {
		modal.close();
	}
</script>

<dialog bind:this={modal}>
	<button on:click={closeClicked}>X</button>
	<h2 class="title">
		<slot name="title" />
	</h2>
	<slot name="content" />
	<div class="action">
		<slot name="action" />
	</div>
</dialog>

<style lang="scss">
	dialog {
		background-color: $secondary-color;
		width: clamp(50vw, 500px, 90%);
		border: 2px solid $primary-color;
		border-radius: 12px;
	}
	dialog::backdrop {
		background-color: rgba(black, 0.5);
	}

	button {
		color: black;
		font-weight: bold;
		position: absolute;
		right: 10px;
		top: 10px;
		font-size: large;
	}

	.action {
		float: right;
	}

	.title {
		text-align: center;
	}
</style>
