<script lang="ts">
  import { processFiles } from '$lib/upload';
  import Loader from '$lib/components/Loader.svelte';
  import { formatBytes, showSnackbar } from '$lib/util';
  import { Card } from 'flowbite-svelte';
  import { onMount } from 'svelte';
  import { promptConfirmation } from '$lib/util';
  import { GoogleSolid } from 'flowbite-svelte-icons';

  const CLIENT_ID = import.meta.env.VITE_GDRIVE_CLIENT_ID;
  const API_KEY = import.meta.env.VITE_GDRIVE_API_KEY;

  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  const SCOPES = 'https://www.googleapis.com/auth/drive';
  const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

  let tokenClient: any;
  let zips: gapi.client.drive.File[];
  let loadingMessage = '';

  async function fetchZips(folderId: string) {
    const { result } = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and (mimeType='${FOLDER_MIME_TYPE}' or (fileExtension='zip' or fileExtension='cbz'))`,
      fields: 'files(id, name, mimeType, size)'
    });

    if (!result.files) return;

    let zipFiles: gapi.client.drive.File[] = [];

    for (const file of result.files) {
      if (!file.id) continue;

      if (file.mimeType === FOLDER_MIME_TYPE) {
        zipFiles = [...zipFiles, ...((await fetchZips(file.id)) || [])];
      } else {
        zipFiles.push(file);
      }
    }

    return zipFiles;
  }

  async function downloadFile(fileId: string) {
    loadingMessage = 'Downloading from drive';

    const { body, headers } = await gapi.client.drive.files.get({
      fileId,
      alt: 'media'
    });

    const type = headers?.['Content-Type'] || '';

    const blob = new Blob([new Uint8Array(body.length).map((_, i) => body.charCodeAt(i))], {
      type
    });

    const file = new File([blob], fileId + '.zip');

    loadingMessage = 'Adding to catalog';

    await processFiles([file]);
    loadingMessage = '';
  }

  function onClick({ id, name }: gapi.client.drive.File) {
    if (id) {
      promptConfirmation(`Would you like to download and add ${name} to your collection?`, () => {
        downloadFile(id);
      });
    }
  }

  async function connectDrive(resp?: any) {
    if (resp?.error !== undefined) {
      throw resp;
    }

    loadingMessage = 'Connecting to drive';

    const { result } = await gapi.client.drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='MokuroReader'`,
      fields: 'files(id)'
    });

    if (result.files?.length === 0) {
      await gapi.client.drive.files.create({
        resource: { mimeType: FOLDER_MIME_TYPE, name: 'MokuroReader' },
        fields: 'id'
      });
    } else {
      zips = [...((await fetchZips(result.files?.[0]?.id || '')) || [])];
      loadingMessage = '';
    }

    showSnackbar('Connected to Google Drive');
  }

  function signIn() {
    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  }

  onMount(() => {
    gapi.load('client', async () => {
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC]
      });

      if (gapi.client.getToken() !== null) {
        loadingMessage = 'Connecting to drive';
        connectDrive();
      }
    });

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: connectDrive
    });
  });
</script>

<div class="p-10 h-[90svh]">
  {#if loadingMessage}
    <Loader>
      {loadingMessage}
    </Loader>
  {:else if zips}
    <div class="flex flex-col gap-5">
      <h2 class="text-lg font-semibold text-center">Google drive:</h2>
      <div class="flex gap-2 flex-wrap p-10 border rounded-lg border-slate-600 border-opacity-50">
        {#each zips as zip}
          <Card href="#" on:click={() => onClick(zip)}>
            <h2 class="font-semibold">{zip.name}</h2>
            <p>{formatBytes(parseInt(zip.size || '0'))}</p>
          </Card>
        {/each}
      </div>
    </div>
  {:else}
    <button
      class="w-full border rounded-lg border-slate-600 p-10 border-opacity-50 hover:bg-slate-800"
      on:click={signIn}
    >
      <div class="flex gap-2 items-center justify-center">
        <GoogleSolid size="lg" />
        <h2 class="text-lg">Connect to Google Drive</h2>
      </div>
    </button>
  {/if}
</div>
