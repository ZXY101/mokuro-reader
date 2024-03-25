<script lang="ts">
  import { processFiles } from '$lib/upload';
  import Loader from '$lib/components/Loader.svelte';
  import { formatBytes, showSnackbar, uploadFile } from '$lib/util';
  import { Button, Frame, Listgroup, ListgroupItem } from 'flowbite-svelte';
  import { onMount } from 'svelte';
  import { promptConfirmation } from '$lib/util';
  import { GoogleSolid } from 'flowbite-svelte-icons';
  import { profiles, volumes } from '$lib/settings';

  const CLIENT_ID = import.meta.env.VITE_GDRIVE_CLIENT_ID;
  const API_KEY = import.meta.env.VITE_GDRIVE_API_KEY;

  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  const SCOPES = 'https://www.googleapis.com/auth/drive';

  const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
  const READER_FOLDER = 'mokuro-reader';
  const VOLUME_DATA_FILE = 'volume-data.json';
  const PROFILES_FILE = 'profiles.json';

  const type = 'application/json';

  let tokenClient: any;
  let zips: gapi.client.drive.File[];
  let loadingMessage = '';
  let readerFolderId = '';
  let volumeDataId = '';
  let profilesId = '';

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

    const { result: readerFolderRes } = await gapi.client.drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${READER_FOLDER}'`,
      fields: 'files(id)'
    });

    if (readerFolderRes.files?.length === 0) {
      const { result: createReaderFolderRes } = await gapi.client.drive.files.create({
        resource: { mimeType: FOLDER_MIME_TYPE, name: READER_FOLDER },
        fields: 'id'
      });

      readerFolderId = createReaderFolderRes.id || '';
    } else {
      const id = readerFolderRes.files?.[0]?.id || '';
      zips = [...((await fetchZips(id)) || [])];

      readerFolderId = id || '';
    }

    const { result: volumeDataRes } = await gapi.client.drive.files.list({
      q: `'${readerFolderId}' in parents and name='${VOLUME_DATA_FILE}'`,
      fields: 'files(id, name)'
    });

    if (volumeDataRes.files?.length !== 0) {
      volumeDataId = volumeDataRes.files?.[0].id || '';
    }

    const { result: profilesRes } = await gapi.client.drive.files.list({
      q: `'${readerFolderId}' in parents and name='${PROFILES_FILE}'`,
      fields: 'files(id, name)'
    });

    if (profilesRes.files?.length !== 0) {
      profilesId = profilesRes.files?.[0].id || '';
    }

    loadingMessage = '';
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

  async function onUploadVolumeData() {
    const metadata = {
      mimeType: type,
      name: VOLUME_DATA_FILE,
      parents: [volumeDataId ? null : readerFolderId]
    };
    const { access_token } = gapi.auth.getToken();

    loadingMessage = 'Uploading volume data';

    const res = await uploadFile({
      accessToken: access_token,
      fileId: volumeDataId,
      metadata,
      localStorageId: 'volumes',
      type
    });

    volumeDataId = res.id;
    loadingMessage = '';

    showSnackbar('Volume data uploaded');
  }

  async function onUploadProfiles() {
    const metadata = {
      mimeType: type,
      name: PROFILES_FILE,
      parents: [profilesId ? null : readerFolderId]
    };
    const { access_token } = gapi.auth.getToken();

    loadingMessage = 'Uploading profiles';

    const res = await uploadFile({
      accessToken: access_token,
      fileId: profilesId,
      metadata,
      localStorageId: 'profiles',
      type
    });

    profilesId = res.id;
    loadingMessage = '';

    showSnackbar('Profiles uploaded');
  }

  async function onDownloadVolumeData() {
    loadingMessage = 'Downloading volume data';

    const { body } = await gapi.client.drive.files.get({
      fileId: volumeDataId,
      alt: 'media'
    });

    const downloaded = JSON.parse(body);

    volumes.update((prev) => {
      return {
        ...prev,
        ...downloaded
      };
    });

    loadingMessage = '';
    showSnackbar('Volume data downloaded');
  }

  async function onDownloadProfiles() {
    loadingMessage = 'Downloading profiles';

    const { body } = await gapi.client.drive.files.get({
      fileId: profilesId,
      alt: 'media'
    });

    const downloaded = JSON.parse(body);

    profiles.update((prev) => {
      return {
        ...prev,
        ...downloaded
      };
    });

    loadingMessage = '';
    showSnackbar('Profiles downloaded');
  }
</script>

<div class="p-2 h-[90svh]">
  {#if loadingMessage}
    <Loader>
      {loadingMessage}
    </Loader>
  {:else if zips}
    <div class="flex flex-col gap-2">
      <div class="flex justify-between items-center gap-2 flex-col sm:flex-row">
        <h2 class="text-2xl font-semibold text-center">Google Drive:</h2>
        <div class="flex flex-col sm:flex-row gap-2 sm:w-auto w-full">
          <Button
            color="dark"
            on:click={() => promptConfirmation('Upload volume data?', onUploadVolumeData)}
          >
            Upload volume data
          </Button>
          {#if volumeDataId}
            <Button
              color="alternative"
              on:click={() =>
                promptConfirmation('Download and overwrite volume data?', onDownloadVolumeData)}
            >
              Download volume data
            </Button>
          {/if}
          <Button
            color="dark"
            on:click={() => promptConfirmation('Upload profiles?', onUploadProfiles)}
          >
            Upload profiles
          </Button>
          {#if profilesId}
            <Button
              color="alternative"
              on:click={() =>
                promptConfirmation('Download and overwrite profiles?', onDownloadProfiles)}
            >
              Download profiles
            </Button>
          {/if}
        </div>
      </div>
      <div class="flex gap-2 justify-center flex-wrap">
        {#if zips.length > 0}
          <Listgroup active class="w-full">
            {#each zips as zip}
              <Frame
                on:click={() => onClick(zip)}
                rounded
                border
                class="divide-y divide-gray-200 dark:divide-gray-600"
              >
                <ListgroupItem normalClass="py-4">
                  <div class="flex flex-col gap-2">
                    <h2 class="font-semibold">{zip.name}</h2>
                    <p>{formatBytes(parseInt(zip.size || '0'))}</p>
                  </div>
                </ListgroupItem>
              </Frame>
            {/each}
          </Listgroup>
        {:else}
          <p class="text-center">
            Add your zip files to the <span class="text-primary-700">{READER_FOLDER}</span> folder in
            your Google Drive.
          </p>
        {/if}
      </div>
    </div>
  {:else}
    <button
      class="w-full border rounded-lg border-slate-600 p-10 border-opacity-50 hover:bg-slate-800"
      on:click={signIn}
    >
      <div class="flex sm:flex-row flex-col gap-2 items-center justify-center">
        <GoogleSolid size="lg" />
        <h2 class="text-lg">Connect to Google Drive</h2>
      </div>
    </button>
  {/if}
</div>
