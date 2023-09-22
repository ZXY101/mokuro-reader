<script lang="ts">
  import { Navbar, NavBrand } from 'flowbite-svelte';
  import { UserSettingsSolid, UploadSolid } from 'flowbite-svelte-icons';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import Settings from './Settings.svelte';
  import UploadModal from './UploadModal.svelte';
  import { settings } from '$lib/settings';

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
      <span class="text-xl font-semibold dark:text-white">Mokuro</span>
    </NavBrand>
    <div class="flex md:order-2 gap-5">
      <UserSettingsSolid class="hover:text-primary-700" on:click={openSettings} />
      <UploadSolid class="hover:text-primary-700" on:click={() => (uploadModalOpen = true)} />
    </div>
  </Navbar>
  {#if isReader}
    <button
      on:click={openSettings}
      class="hover:text-primary-700 fixed opacity-50 hover:opacity-100 right-10 top-5 p-10 m-[-2.5rem]"
    >
      <div style:background-color={$settings.backgroundColor} class="absolute">
        <UserSettingsSolid class="mix-blend-difference" />
      </div>
    </button>
  {/if}
</div>

<Settings bind:hidden={settingsHidden} />
<UploadModal bind:open={uploadModalOpen} />
