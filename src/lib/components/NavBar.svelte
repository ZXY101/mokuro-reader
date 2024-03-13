<script lang="ts">
  import { Navbar, NavBrand } from 'flowbite-svelte';
  import { UserSettingsSolid, UploadSolid, CloudArrowUpOutline } from 'flowbite-svelte-icons';
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Settings from './Settings/Settings.svelte';
  import UploadModal from './UploadModal.svelte';
  import Icon from '$lib/assets/icon.webp';

  let settingsHidden = true;
  let uploadModalOpen = false;
  let isReader = false;

  function openSettings() {
    settingsHidden = false;
  }

  afterNavigate(() => {
    isReader = $page.route.id === '/[manga]/[volume]';

    if (isReader) {
      window.document.body.classList.add('reader');
    } else {
      window.document.body.classList.remove('reader');
    }
  });
</script>

<div class="relative z-10">
  <Navbar hidden={isReader}>
    <NavBrand href="/">
      <div class="flex flex-row gap-2 items-center">
        <img src={Icon} alt="icon" class="w-[32px] h-[32px]" />
        <span class="text-xl font-semibold dark:text-white">Mokuro</span>
      </div>
    </NavBrand>
    <div class="flex md:order-2 gap-5">
      <UserSettingsSolid class="hover:text-primary-700" on:click={openSettings} />
      <UploadSolid class="hover:text-primary-700" on:click={() => (uploadModalOpen = true)} />
      <CloudArrowUpOutline class="hover:text-primary-700" on:click={() => goto('/cloud')} />
    </div>
  </Navbar>
</div>

<Settings bind:hidden={settingsHidden} />
<UploadModal bind:open={uploadModalOpen} />
