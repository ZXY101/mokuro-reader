<script lang="ts">
	import { Navbar, NavBrand } from 'flowbite-svelte';
	import { UserSettingsSolid, UploadSolid } from 'flowbite-svelte-icons';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import Settings from './Settings.svelte';
	import UploadModal from './UploadModal.svelte';

	let settingsHidden = true;
	let uploadModalOpen = false;
	let isReader = false;

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
			<UserSettingsSolid class="hover:text-primary-700" on:click={() => (settingsHidden = false)} />
			<UploadSolid class="hover:text-primary-700" on:click={() => (uploadModalOpen = true)} />
		</div>
	</Navbar>
	{#if isReader}
		<UserSettingsSolid
			class="hover:text-primary-700 absolute right-5 top-5 opacity-10 hover:opacity-100"
			on:click={() => (settingsHidden = false)}
		/>
	{/if}
</div>

<Settings bind:hidden={settingsHidden} />
<UploadModal bind:open={uploadModalOpen} />
