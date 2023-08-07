<script lang="ts">
	export let files: FileList | null | undefined = undefined;
	export let onUpload: ((files: FileList) => void) | undefined = undefined;

	let input: HTMLInputElement;

	function handleChange() {
		if (files && onUpload) {
			onUpload(files);
		}
	}

	function onClick() {
		input.click();
	}

	function onDrop(event: DragEvent) {
		const items = event.dataTransfer?.items;
		// TODO
	}
</script>

<input type="file" bind:files bind:this={input} on:change={handleChange} {...$$restProps} />

<button
	on:click={onClick}
	on:dragover|preventDefault
	on:drop|preventDefault|stopPropagation={onDrop}
>
	<p><slot>Upload</slot></p>
</button>

<style lang="scss">
	input {
		display: none;
	}

	button {
		width: 500px;
		height: 100px;
		border-radius: 12px;
		border: 2px dashed $secondary-color;
	}

	p {
		font-weight: bold;
		font-size: 16px;
		color: $secondary-color;
	}
</style>
