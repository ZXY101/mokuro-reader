<script lang="ts">
  import { page } from '$app/stores';
  import Loader from '$lib/components/Loader.svelte';
  import { db } from '$lib/catalog/db';
  import { getItems, processFiles } from '$lib/upload';
  import {
    normalizeFilename,
    promptConfirmation,
    showSnackbar,
    comparePagePathsToFiles
  } from '$lib/util';
  import { promptImportMismatch } from '$lib/util/modals';
  import { nav } from '$lib/util/navigation';
  import { P, Progressbar } from 'flowbite-svelte';
  import { onMount } from 'svelte';
  export const BASE_URL = $page.url.searchParams.get('source') || 'https://mokuro.moe/manga';

  const manga = $page.url.searchParams.get('manga');
  const volume = $page.url.searchParams.get('volume');
  const url = `${BASE_URL}/${manga}/${volume}`;

  let message = $state('Loading...');

  let files: File[] = [];

  let completed = $state(0);
  let max = $state(0);

  let progress = $derived(Math.floor((completed / max) * 100).toString());

  async function onImport() {
    const normalizedVolume = normalizeFilename(volume || '');
    let mokuroFile: File | undefined;
    let mokuroData: { pages: Array<{ img_path: string }>; volume?: string } | undefined;
    let downloadErrors: string[] = [];

    // Fetch mokuro file
    try {
      message = 'Fetching mokuro data...';
      const mokuroRes = await fetch(url + '.mokuro', { cache: 'no-store' });
      if (!mokuroRes.ok) {
        throw new Error(`HTTP ${mokuroRes.status}: ${mokuroRes.statusText}`);
      }
      const mokuroText = await mokuroRes.text();

      // Parse mokuro JSON to extract expected page paths
      try {
        mokuroData = JSON.parse(mokuroText);
        console.log('[URL Import] Mokuro data parsed:', {
          pageCount: mokuroData?.pages?.length ?? 0,
          volumeName: mokuroData?.volume
        });
      } catch (parseErr) {
        throw new Error(
          `Invalid mokuro JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
        );
      }

      const mokuroBlob = new Blob([mokuroText], { type: 'application/json' });
      mokuroFile = new File([mokuroBlob], normalizedVolume + '.mokuro', {
        type: 'application/json'
      });

      Object.defineProperty(mokuroFile, 'webkitRelativePath', {
        value: '/' + normalizedVolume + '.mokuro'
      });
    } catch (err) {
      const errorMsg = `Failed to fetch mokuro file: ${err instanceof Error ? err.message : String(err)}`;
      console.error('[URL Import] Mokuro fetch error:', errorMsg, { url: url + '.mokuro' });
      showSnackbar(
        `Import failed: Could not fetch mokuro file. Please report if repeatable.`,
        8000
      );
      nav.toCatalog({ replaceState: true });
      return;
    }

    // Fetch directory listing
    let items: HTMLAnchorElement[] = [];
    try {
      message = 'Fetching file list...';
      const res = await fetch(url + '/');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const html = await res.text();
      items = getItems(html);

      if (items.length === 0) {
        throw new Error('No files found in directory listing');
      }
    } catch (err) {
      const errorMsg = `Failed to fetch directory listing: ${err instanceof Error ? err.message : String(err)}`;
      console.error('[URL Import] Directory fetch error:', errorMsg, { url: url + '/' });
      showSnackbar(`Import failed: Could not fetch file list. Please report if repeatable.`, 8000);
      nav.toCatalog({ replaceState: true });
      return;
    }

    message = 'Downloading images...';
    const imageTypes = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff', '.gif', '.bmp'];

    max = items.length;
    let downloadedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      const itemFileExtension = ('.' + item.pathname.split('.').at(-1)).toLowerCase();
      if (imageTypes.includes(itemFileExtension || '')) {
        const imageUrl = url + item.pathname;
        try {
          const image = await fetch(imageUrl);
          if (!image.ok) {
            throw new Error(`HTTP ${image.status} ${image.statusText}`);
          }
          const blob = await image.blob();
          const normalizedPath = normalizeFilename(item.pathname);
          const file = new File([blob], normalizedPath.substring(1));
          Object.defineProperty(file, 'webkitRelativePath', {
            value: '/' + normalizedVolume + normalizedPath
          });

          files.push(file);
          downloadedCount++;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          downloadErrors.push(`${item.pathname}: ${errorMsg}`);
          console.error('[URL Import] Image download failed:', {
            url: imageUrl,
            pathname: item.pathname,
            href: item.href,
            error: errorMsg,
            itemIndex: completed + 1,
            totalItems: items.length
          });
        }
      } else {
        skippedCount++;
        console.log('[URL Import] Skipped non-image:', {
          pathname: item.pathname,
          href: item.href,
          extension: itemFileExtension,
          itemIndex: completed + 1,
          totalItems: items.length
        });
      }
      completed++;
    }

    // Log download summary
    console.log('[URL Import] Download summary:', {
      total: items.length,
      downloaded: downloadedCount,
      skipped: skippedCount,
      failed: downloadErrors.length
    });
    console.log(
      '[URL Import] Downloaded files:',
      files.map((f) => ({
        name: f.name,
        path: f.webkitRelativePath,
        size: f.size,
        type: f.type
      }))
    );

    // Check if we have any images
    if (files.length === 0) {
      console.error('[URL Import] No images downloaded', { errors: downloadErrors });
      showSnackbar(
        `Import failed: No images could be downloaded. Please report if repeatable.`,
        8000
      );
      nav.toCatalog({ replaceState: true });
      return;
    }

    // Warn about partial downloads but continue
    if (downloadErrors.length > 0) {
      console.warn('[URL Import] Some images failed to download:', downloadErrors);
      showSnackbar(`Warning: ${downloadErrors.length} image(s) failed to download`, 5000);
    }

    // Compare downloaded files against mokuro page expectations
    const expectedPagePaths = mokuroData?.pages?.map((p) => p.img_path) ?? [];
    const downloadedFileNames = files.map((f) => f.name);

    console.log('[URL Import] Comparing files:', {
      expectedCount: expectedPagePaths.length,
      downloadedCount: downloadedFileNames.length,
      expectedPaths: expectedPagePaths,
      downloadedNames: downloadedFileNames
    });

    const matchResult = comparePagePathsToFiles(expectedPagePaths, downloadedFileNames);

    console.log('[URL Import] Match result:', matchResult);

    // If there are mismatches, show the modal and abort
    if (matchResult.missingFiles.length > 0 || matchResult.extraFiles.length > 0) {
      console.error('[URL Import] File mismatch detected:', {
        matched: matchResult.matched,
        missingCount: matchResult.missingFiles.length,
        extraCount: matchResult.extraFiles.length,
        missingFiles: matchResult.missingFiles,
        extraFiles: matchResult.extraFiles
      });

      promptImportMismatch(
        {
          volumeName: mokuroData?.volume ?? normalizedVolume,
          expectedCount: expectedPagePaths.length,
          actualCount: downloadedFileNames.length,
          missingFiles: matchResult.missingFiles,
          extraFiles: matchResult.extraFiles
        },
        () => nav.toCatalog({ replaceState: true })
      );
      return;
    }

    files.push(mokuroFile);
    console.log('[URL Import] Mokuro file:', {
      name: mokuroFile.name,
      path: mokuroFile.webkitRelativePath,
      size: mokuroFile.size,
      type: mokuroFile.type
    });
    console.log('[URL Import] Total files to process:', files.length);
    message = 'Adding to catalog...';

    try {
      const result = await processFiles(files, {
        onMismatchDismiss: () => nav.toCatalog({ replaceState: true })
      });

      // If processFiles detected failures, it already showed the modal
      // Navigation will happen when user dismisses the modal
      if (!result.success) {
        console.log('[URL Import] Import had failures, modal shown');
        return;
      }

      console.log('[URL Import] Successfully imported');
      nav.toCatalog({ replaceState: true });
    } catch (err) {
      console.error('[URL Import] Process files error:', err);
      showSnackbar(
        `Import failed during processing: ${err instanceof Error ? err.message : 'Unknown error'}. Please report if repeatable.`,
        8000
      );
      nav.toCatalog({ replaceState: true });
    }
  }

  function onCancel() {
    nav.toCatalog({ replaceState: true });
  }

  onMount(() => {
    if (!manga || !volume) {
      console.error('[URL Import] Missing required parameters', { manga, volume });
      showSnackbar('Import failed: Missing manga or volume parameter');
      onCancel();
    } else {
      promptConfirmation(`Import ${decodeURI(volume || '')} into catalog?`, onImport, onCancel);
    }
  });
</script>

<div>
  <Loader>
    {message}
    {#if completed && progress !== '100'}
      <P>{completed} / {max}</P>
      <Progressbar {progress} />
    {/if}
  </Loader>
</div>
