<script lang="ts">
	import {
		Navbar,
		NavBrand,
		Modal,
		Drawer,
		Button,
		CloseButton,
		Checkbox,
		Toggle,
		Select,
		Input,
		Label
	} from 'flowbite-svelte';
	import {
		UserSettingsSolid,
		UploadSolid,
		InfoCircleSolid,
		ArrowRightOutline
	} from 'flowbite-svelte-icons';
	import FileUpload from './FileUpload.svelte';
	import { processFiles } from '$lib/upload';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { sineIn } from 'svelte/easing';
	import { settingsStore, updateSetting } from '$lib/settings';

	let transitionParams = {
		x: 320,
		duration: 200,
		easing: sineIn
	};

	let promise: Promise<void>;
	let modal = false;
	let drawer = false;
	let isReader = true;

	async function onUpload(files: FileList) {
		promise = processFiles(files).then(() => {
			modal = false;
		});
	}

	afterNavigate(() => {
		isReader = $page.route.id === '/[manga]/[volume]';
	});

	let selected = 'us';

	let countries = [
		{ value: 'us', name: 'auto' },
		{ value: 'ca', name: 'Canada' },
		{ value: 'fr', name: 'France' }
	];

	$: toggles = [
		{ key: 'rightToLeft', text: 'Right to left', value: $settingsStore.rightToLeft },
		{ key: 'singlePageView', text: 'Single page view', value: $settingsStore.singlePageView },
		{ key: 'textEditable', text: 'Editable text', value: $settingsStore.textEditable },
		{ key: 'textBoxBorders', text: 'Text box borders', value: $settingsStore.textBoxBorders },
		{ key: 'displayOCR', text: 'OCR enabled', value: $settingsStore.displayOCR }
	];
</script>

<div class="relative z-10">
	<Navbar hidden={isReader}>
		<NavBrand href="/">
			<span class="text-xl font-semibold dark:text-white">Mokuro</span>
		</NavBrand>
		<div class="flex md:order-2 gap-5">
			<UserSettingsSolid class="hover:text-primary-700" on:click={() => (drawer = false)} />
			<UploadSolid class="hover:text-primary-700" on:click={() => (modal = true)} />
		</div>
	</Navbar>
	{#if isReader}
		<UserSettingsSolid
			class="hover:text-primary-700 absolute right-5 top-5 opacity-10 hover:opacity-100"
			on:click={() => (drawer = false)}
		/>
	{/if}
</div>

<Drawer
	placement="right"
	transitionType="fly"
	width="lg:w-1/4 md:w-1/2 w-full"
	{transitionParams}
	bind:hidden={drawer}
	id="sidebar1"
>
	<div class="flex items-center">
		<h5 id="drawer-label" class="inline-flex items-center mb-4 text-base font-semibold">
			<UserSettingsSolid class="w-4 h-4 mr-2.5" />Settings
		</h5>
		<CloseButton on:click={() => (drawer = true)} class="mb-4 dark:text-white" />
	</div>
	<div class="flex flex-col gap-5">
		{#each toggles as { key, text, value }}
			<Toggle size="small" checked={value} on:change={() => updateSetting(key, !value)}
				>{text}</Toggle
			>
		{/each}
		<div>
			<Label>Fontsize:</Label>
			<Select items={countries} bind:value={selected} />
		</div>
		<div>
			<Label>Background color:</Label>
			<Input type="color" />
		</div>
	</div>
</Drawer>

<Modal title="Upload" bind:open={modal} outsideclose>
	{#await promise}
		<h2 class="justify-center flex">Loading...</h2>
	{:then}
		<FileUpload {onUpload} webkitdirectory>Upload directory</FileUpload>
		<FileUpload {onUpload} accept=".mokuro,.zip,.cbz" multiple>Upload files</FileUpload>
	{/await}
</Modal>
