<script lang="ts">
	import FileUpload from '$lib/components/FileUpload.svelte';
	import { unzipManga } from '$lib/upload';
	import type { Entry } from '@zip.js/zip.js';

	let promise: Promise<Entry[]> | undefined;

	async function onUpload(files: FileList) {
		const [file] = files;
		promise = unzipManga(file);
	}
</script>

<FileUpload {onUpload} accept=".mokuro,.zip,.cbz,.rar" />

{#if promise}
	{#await promise}
		<p>Loading...</p>
	{:then entries}
		{#each entries as entry}
			<p>{entry.filename}</p>
		{/each}
	{/await}
{/if}
