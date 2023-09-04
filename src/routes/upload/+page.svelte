<script lang="ts">
	import Catalog from '$lib/components/Catalog.svelte';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import { processFiles } from '$lib/upload';

	let promise: Promise<void>;

	async function onUpload(files: FileList) {
		promise = processFiles(files);
	}
</script>

<!-- Note:  webkitdirectory is not fully supported and does not work on mobile -->
<FileUpload {onUpload} webkitdirectory>Upload directory</FileUpload>
<FileUpload {onUpload} accept=".mokuro,.zip,.cbz" multiple>Upload files</FileUpload>

{#await promise}
	<h2>Loading...</h2>
{:then}
	<Catalog />
{/await}
