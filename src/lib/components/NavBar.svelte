<script lang="ts">
	import { Navbar, NavBrand, Modal, Button } from 'flowbite-svelte';
	import { UserSettingsSolid, UploadSolid } from 'flowbite-svelte-icons';
	import FileUpload from './FileUpload.svelte';
	import { processFiles } from '$lib/upload';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';

	let promise: Promise<void>;
	let modal = false;
	let isReader = false;

	async function onUpload(files: FileList) {
		promise = processFiles(files).then(() => {
			modal = false;
		});
	}

	afterNavigate(() => {
		isReader = $page.route.id === '/[manga]/[volume]';
	});
</script>

<div class="relative z-10">
	<Navbar hidden={isReader}>
		<NavBrand href="/">
			<span class="text-xl font-semibold dark:text-white">Mokuro</span>
		</NavBrand>
		<div class="flex md:order-2 gap-5">
			<UserSettingsSolid class="hover:text-cyan-300" />
			<UploadSolid class="hover:text-cyan-300" on:click={() => (modal = true)} />
		</div>
	</Navbar>
</div>

<Modal title="Upload" bind:open={modal} outsideclose>
	{#await promise}
		<h2 class="justify-center flex">Loading...</h2>
	{:then}
		<FileUpload {onUpload} webkitdirectory>Upload directory</FileUpload>
		<FileUpload {onUpload} accept=".mokuro,.zip,.cbz" multiple>Upload files</FileUpload>
	{/await}
</Modal>
