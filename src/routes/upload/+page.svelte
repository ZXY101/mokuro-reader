<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Loader from '$lib/components/Loader.svelte';
  import { getItems, processFiles } from '$lib/upload';
  import { Button } from 'flowbite-svelte';
  export const BASE_URL = 'https://www.mokuro.moe/manga';

  const manga = $page.url.searchParams.get('manga');
  const volume = $page.url.searchParams.get('volume');
  const url = `${BASE_URL}/${manga}/${volume}`;

  let message = 'Loading...';
  let loading = false;

  let files: File[] = [];

  async function onImport() {
    loading = true;
    const mokuroRes = await fetch(url + '.mokuro');
    const mokuroBlob = await mokuroRes.blob();
    const mokuroFile = new File([mokuroBlob], volume + '.mokuro', { type: mokuroBlob.type });

    Object.defineProperty(mokuroFile, 'webkitRelativePath', {
      value: '/' + volume + '.mokuro'
    });

    const res = await fetch(url + '/');
    const html = await res.text();

    const items = getItems(html);
    message = 'Downloading images...';

    const imageTypes = ['.jpg', '.png', '.webp'];

    for (const item of items) {
      if (imageTypes.includes('.' + item.pathname.split('.').at(-1) || '')) {
        const image = await fetch(url + item.pathname);
        const blob = await image.blob();
        const file = new File([blob], item.pathname.substring(1));
        Object.defineProperty(file, 'webkitRelativePath', {
          value: '/' + volume + item.pathname
        });

        files.push(file);
      }
    }
    files.push(mokuroFile);
    files = files;
    message = 'Adding to catalog...';
    console.log(files);

    processFiles(files).then(() => {
      goto('/');
    });
    loading = true;
  }
</script>

{#if loading}
  <Loader>{message}</Loader>
{:else}
  <Button on:click={onImport}>Import {decodeURI(volume || '')} into catalog?</Button>
{/if}
