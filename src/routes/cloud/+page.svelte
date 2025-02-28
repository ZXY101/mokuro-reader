<script lang="ts">
  import { processFiles } from '$lib/upload';

  /** @type {string} */
  export let accessToken = '';
  import Loader from '$lib/components/Loader.svelte';
  import { formatBytes, showSnackbar, uploadFile } from '$lib/util';
  import { Button, P, Progressbar } from 'flowbite-svelte';
  import { onMount } from 'svelte';
  import { promptConfirmation } from '$lib/util';
  import { GoogleSolid } from 'flowbite-svelte-icons';
  import { profiles, volumes } from '$lib/settings';

  const CLIENT_ID = import.meta.env.VITE_GDRIVE_CLIENT_ID;
  const API_KEY = import.meta.env.VITE_GDRIVE_API_KEY;

  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
  const SCOPES = 'https://www.googleapis.com/auth/drive.file';

  const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
  const READER_FOLDER = 'mokuro-reader';
  const VOLUME_DATA_FILE = 'volume-data.json';
  const PROFILES_FILE = 'profiles.json';

  const type = 'application/json';

  let tokenClient: any;
  let readerFolderId = '';
  let volumeDataId = '';
  let profilesId = '';

  let loadingMessage = '';

  let completed = 0;
  let totalSize = 0;
  $: progress = Math.floor((completed / totalSize) * 100).toString();

  $: if (accessToken) {
    localStorage.setItem('gdrive_token', accessToken);
  }

  function xhrDownloadFileId(fileId: string) {
    return new Promise<Blob>((resolve, reject) => {
      const { access_token } = gapi.auth.getToken();
      const xhr = new XMLHttpRequest();

      completed = 0;
      totalSize = 0;

      xhr.open('GET', `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
      xhr.setRequestHeader('Authorization', `Bearer ${access_token}`);
      xhr.responseType = 'blob';

      xhr.onprogress = ({ loaded, total }) => {
        loadingMessage = '';
        completed = loaded;
        totalSize = total;
      };

      xhr.onabort = (event) => {
        console.warn(`xhr ${fileId}: download aborted at ${event.loaded} of ${event.total}`);
        showSnackbar('Download failed');
        reject(new Error('Download aborted'));
      };

      xhr.onerror = (event) => {
        console.error(`xhr ${fileId}: download error at ${event.loaded} of ${event.total}`);
        showSnackbar('Download failed');
        reject(new Error('Error downloading file'));
      };

      xhr.onload = () => {
        completed = 0;
        totalSize = 0;
        resolve(xhr.response);
      };

      xhr.ontimeout = (event) => {
        console.warn(`xhr ${fileId}: download timeout after ${event.loaded} of ${event.total}`);
        showSnackbar('Download timed out');
        reject(new Error('Timout downloading file'));
      };

      xhr.send();
    });
  }

  export async function connectDrive(resp?: any) {
    if (resp?.error !== undefined) {
      localStorage.removeItem('gdrive_token');
      accessToken = '';
      throw resp;
    }

    accessToken = resp?.access_token;
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

    if (accessToken) {
      showSnackbar('Connected to Google Drive');
    }
  }

  function signIn() {
    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  }

  export function logout() {
    localStorage.removeItem('gdrive_token');
    accessToken = '';
  }

  onMount(() => {
    gapi.load('client', async () => {
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC]
      });

      // Initialize token client after gapi client is ready
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: connectDrive
      });

      // Try to restore the saved token only after gapi client is initialized
      const savedToken = localStorage.getItem('gdrive_token');
      if (savedToken) {
        try {
          // Set the token in gapi client
          gapi.client.setToken({ access_token: savedToken });
          accessToken = savedToken;
          await connectDrive({ access_token: savedToken });
        } catch (error) {
          console.error('Failed to restore saved token:', error);
          // Token will be cleared in connectDrive if there's an error
        }
      }
    });

    gapi.load('picker', () => {});
  });

  function createPicker() {
    const docsView = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setMimeTypes('application/zip,application/x-zip-compressed')
      .setMode(google.picker.DocsViewMode.LIST)
      .setIncludeFolders(true)
      .setParent(readerFolderId);

    const picker = new google.picker.PickerBuilder()
      .addView(docsView)
      .setOAuthToken(accessToken)
      .setAppId(CLIENT_ID)
      .setDeveloperKey(API_KEY)
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .setCallback(pickerCallback)
      .build();
    picker.setVisible(true);
  }

  async function pickerCallback(data: google.picker.ResponseObject) {
    try {
      if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
        loadingMessage = 'Downloading from drive...';
        const docs = data[google.picker.Response.DOCUMENTS];
        const blob = await xhrDownloadFileId(docs[0].id);

        loadingMessage = 'Adding to catalog...';

        const file = new File([blob], docs[0].name);

        await processFiles([file]);
        loadingMessage = '';
      }
    } catch (error) {
      showSnackbar('Something went wrong');
      loadingMessage = '';
      console.error(error);
    }
  }

  async function onUploadVolumeData() {
    const metadata = {
      mimeType: type,
      name: VOLUME_DATA_FILE,
      parents: [volumeDataId ? null : readerFolderId]
    };

    loadingMessage = 'Uploading volume data';

    const res = await uploadFile({
      accessToken,
      fileId: volumeDataId,
      metadata,
      localStorageId: 'volumes',
      type
    });

    volumeDataId = res.id;
    loadingMessage = '';

    if (volumeDataId) {
      showSnackbar('Volume data uploaded');
    }
  }

  async function onUploadProfiles() {
    const metadata = {
      mimeType: type,
      name: PROFILES_FILE,
      parents: [profilesId ? null : readerFolderId]
    };

    loadingMessage = 'Uploading profiles';

    const res = await uploadFile({
      accessToken,
      fileId: profilesId,
      metadata,
      localStorageId: 'profiles',
      type
    });

    profilesId = res.id;
    loadingMessage = '';

    if (profilesId) {
      showSnackbar('Profiles uploaded');
    }
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

<svelte:head>
  <title>Cloud</title>
</svelte:head>

<div class="p-2 h-[90svh]">
  {#if loadingMessage || completed > 0}
    <Loader>
      {#if completed > 0}
        <P>{formatBytes(completed)} / {formatBytes(totalSize)}</P>
        <Progressbar {progress} />
      {:else}
        {loadingMessage}
      {/if}
    </Loader>
  {:else if accessToken}
    <div class="flex justify-between items-center gap-6 flex-col">
      <div class="flex justify-between items-center w-full max-w-3xl">
        <h2 class="text-3xl font-semibold text-center pt-2">Google Drive:</h2>
        <Button color="red" on:click={logout}>Log out</Button>
      </div>
      <p class="text-center">
        Add your zipped manga files to the <span class="text-primary-700">{READER_FOLDER}</span> folder
        in your Google Drive.
      </p>
      <div class="flex flex-col gap-4 w-full max-w-3xl">
        <Button color="blue" on:click={createPicker}>Download manga</Button>
        <div class="flex-col gap-2 flex">
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
        </div>
        <div class="flex-col gap-2 flex">
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
    </div>
  {:else}
    <div class="flex justify-center pt-0 sm:pt-32">
      <button
        class="w-full border rounded-lg border-slate-600 p-10 border-opacity-50 hover:bg-slate-800 max-w-3xl"
        on:click={signIn}
      >
        <div class="flex sm:flex-row flex-col gap-2 items-center justify-center">
          <GoogleSolid size="lg" />
          <h2 class="text-lg">Connect to Google Drive</h2>
        </div>
      </button>
    </div>
  {/if}
</div>
