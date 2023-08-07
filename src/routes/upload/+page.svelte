<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import { processFiles, unzipManga, type Volume } from '$lib/upload';

	let promise: Promise<Volume[] | undefined> | undefined;

	async function onUpload(files: FileList) {
		promise = processFiles(files);
	}

	function up() {
		page++;
	}

	function down() {
		if (page > 0) {
			page--;
		}
	}

	let page = 0;
</script>

<!-- Note:  webkitdirectory is not fully supported and does not work on mobile -->
<Button on:click={down}>{'<'}</Button>
<Button on:click={up}>{'>'}</Button>
{page}
<FileUpload {onUpload} webkitdirectory>Upload directory</FileUpload>
<FileUpload {onUpload} accept=".mokuro,.zip,.cbz,.rar" multiple>Upload files</FileUpload>
{#if promise}
	{#await promise}
		<p>Loading...</p>
	{:then volumes}
		{#if volumes}
			{#each volumes as { mokuroData, volumeName, archiveFile, files }}
				<p>{volumeName}</p>
				{#if files}
					<img src={URL.createObjectURL(Object.values(files)[page])} alt="img" />
				{/if}
			{/each}
		{/if}
	{/await}
{/if}
