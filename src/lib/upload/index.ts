import { db } from '$lib/catalog/db';
import type { VolumeData, VolumeMetadata } from '$lib/types';
import { showSnackbar } from '$lib/util/snackbar';
import { requestPersistentStorage } from '$lib/util/upload';
import { ZipReader, BlobWriter, getMimeType, Uint8ArrayReader } from '@zip.js/zip.js';
import { generateThumbnail } from '$lib/catalog/thumbnails';

export * from './web-import'

const zipTypes = ['zip', 'cbz', 'ZIP', 'CBZ'];
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];

export async function unzipManga(file: File) {
  const zipFileReader = new Uint8ArrayReader(new Uint8Array(await file.arrayBuffer()));
  const zipReader = new ZipReader(zipFileReader);

  const entries = await zipReader.getEntries();
  const unzippedFiles: Record<string, File> = {};

  const sortedEntries = entries.sort((a, b) => {
    return a.filename.localeCompare(b.filename, undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  })

  for (const entry of sortedEntries) {
    const mime = getMimeType(entry.filename);
    const isMokuroFile = entry.filename.split('.').pop() === 'mokuro'

    if (imageTypes.includes(mime) || isMokuroFile) {
      const blob = await entry.getData?.(new BlobWriter(mime));
      if (blob) {
        const fileName = entry.filename.split('/').pop() || entry.filename;
        const file = new File([blob], fileName, { type: mime });
        if (!file.webkitRelativePath) {
          Object.defineProperty(file, 'webkitRelativePath', {
            value: entry.filename
          })
        }
        unzippedFiles[entry.filename] = file;
      }
    }
  }

  return unzippedFiles;
}

function getDetails(file: File) {
  const { webkitRelativePath, name } = file
  const split = name.split('.');
  const ext = split.pop();
  const filename = split.join('.');
  let path = filename

  if (webkitRelativePath) {
    path = webkitRelativePath.split('.')[0]
  }

  return {
    filename,
    ext,
    path
  };
}

async function getFile(fileEntry: FileSystemFileEntry) {
  try {
    return new Promise<File>((resolve, reject) => fileEntry.file((file) => {
      if (!file.webkitRelativePath) {
        Object.defineProperty(file, 'webkitRelativePath', {
          value: fileEntry.fullPath.substring(1)
        })
      }
      resolve(file)
    }, reject));
  } catch (err) {
    console.log(err);
  }
}

export async function scanFiles(item: FileSystemEntry, files: Promise<File | undefined>[]) {
  if (item.isDirectory) {
    const directoryReader = (item as FileSystemDirectoryEntry).createReader();
    await new Promise<void>((resolve) => {
      function readEntries() {
        directoryReader.readEntries(async (entries) => {
          if (entries.length > 0) {
            for (const entry of entries) {
              if (entry.isFile) {
                files.push(getFile(entry as FileSystemFileEntry));
              } else {
                await scanFiles(entry, files);
              }
            }
            readEntries()
          } else {
            resolve();
          }
        });
      }

      readEntries()
    });
  }
}

async function uploadVolumeData(
  volumesByPath: Record<string, Partial<VolumeMetadata>>,
  path: string,
  uploadData: undefined | Partial<VolumeData>
) {
  const uploadMetadata = volumesByPath[path];
  if (
    uploadData &&
    uploadMetadata &&
    uploadMetadata.volume_uuid &&
    uploadMetadata.mokuro_version &&
    uploadMetadata.volume_uuid &&
    uploadMetadata.series_title &&
    uploadMetadata.volume_title &&
    uploadMetadata.page_count
  ) {
    await requestPersistentStorage();
    const existingVolume = await db.volumes
      .where('volume_uuid')
      .equals(uploadMetadata.volume_uuid)
      .first();

    if (!existingVolume) {
      uploadMetadata.thumbnail = await generateThumbnail(uploadData.files?.[Object.keys(uploadData.files)[0]]);
      await db.transaction('rw', db.volumes, async () => {
        await db.volumes.add(uploadMetadata as VolumeMetadata, uploadMetadata.volume_uuid);
      });
      await db.transaction('rw', db.volumes_data, async () => {
        await db.volumes_data.add(uploadData as VolumeData, uploadMetadata.volume_uuid);
      });
    }
  }
}

async function extractAndUploadVolume(
  file: File,
  uploadData: Partial<VolumeData> | undefined,
  volumesDataByPath: Record<string, Partial<VolumeData>>,
  path: string,
  volumesByPath: Record<string, Partial<VolumeMetadata>>
) {
  const unzippedFiles = await unzipManga(file);

  uploadData = {
    ...volumesDataByPath[path],
    files: unzippedFiles
  };
  await uploadVolumeData(volumesByPath, path, uploadData);
}

interface MokuroData {
  version: string;
  title: string;
  title_uuid: string;
  pages: any[];
  chars: number;
  volume: string;
  volume_uuid: string;
}

async function processMokuroFile(file: File): Promise<{
  metadata: Partial<VolumeMetadata>;
  data: Partial<VolumeData>;
  titleUuid: string;
}> {
  const mokuroData: MokuroData = JSON.parse(await file.text());
  return {
    metadata: {
      mokuro_version: mokuroData.version,
      series_title: mokuroData.title,
      series_uuid: mokuroData.title_uuid,
      page_count: mokuroData.pages.length,
      character_count: mokuroData.chars,
      volume_title: mokuroData.volume,
      volume_uuid: mokuroData.volume_uuid
    },
    data: {
      volume_uuid: mokuroData.volume_uuid,
      pages: mokuroData.pages
    },
    titleUuid: mokuroData.title_uuid
  };
}

async function processImageFile(
  file: File,
  volumesDataByPath: Record<string, Partial<VolumeData>>,
  volumesByPath: Record<string, Partial<VolumeMetadata>>
): Promise<void> {
  const { path } = getDetails(file);
  const { webkitRelativePath } = file;
  
  if (!webkitRelativePath) return;

  const imageName = webkitRelativePath.split('/').at(-1);
  const vol = Object.keys(volumesDataByPath).find(key => webkitRelativePath.startsWith(key));

  if (!vol || !imageName) return;

  // Update volume data with new image
  volumesDataByPath[vol] = {
    ...volumesDataByPath[vol],
    files: {
      ...volumesDataByPath[vol]?.files,
      [imageName]: file
    }
  };

  // Check if all images are collected for this volume
  if (volumesDataByPath[vol].pages?.length === Object.keys(volumesDataByPath[vol].files || {}).length) {
    const uploadData = volumesDataByPath[vol];
    volumesDataByPath[vol] = {}; // Clear memory
    await uploadVolumeData(volumesByPath, path, uploadData);
  }
}

async function processZipFile(
  file: File,
  volumesByPath: Record<string, Partial<VolumeMetadata>>,
  volumesDataByPath: Record<string, Partial<VolumeData>>,
  titleUuids: Set<string>
): Promise<void> {
  const unzippedFiles = await unzipManga(file);
  const entries = Object.entries(unzippedFiles);
  const { path } = getDetails(file);

  // Find mokuro file if present
  const mokuroEntry = entries.find(([name]) => name.endsWith('.mokuro'));
  if (!mokuroEntry) return;

  // Process mokuro file
  const { metadata, data, titleUuid } = await processMokuroFile(mokuroEntry[1]);
  titleUuids.add(titleUuid);
  volumesByPath[path] = metadata;
  volumesDataByPath[path] = {
    ...data,
    files: {}
  };

  // Process images and upload when complete
  for (const [name, imageFile] of entries) {
    const mime = getMimeType(name);
    if (!imageTypes.includes(mime)) continue;

    volumesDataByPath[path].files![name] = imageFile;

    // Check if volume is complete
    if (volumesDataByPath[path].pages?.length === Object.keys(volumesDataByPath[path].files!).length) {
      const uploadData = volumesDataByPath[path];
      delete volumesDataByPath[path]; // Clear memory
      await uploadVolumeData(volumesByPath, path, uploadData);
      break;
    }
  }
}

async function processStandaloneImage(
  file: File,
  volumesDataByPath: Record<string, Partial<VolumeData>>,
  volumesByPath: Record<string, Partial<VolumeMetadata>>
): Promise<void> {
  const { path } = getDetails(file);
  const { webkitRelativePath } = file;
  
  if (!webkitRelativePath) return;

  const imageName = webkitRelativePath.split('/').at(-1);
  const vol = Object.keys(volumesDataByPath).find(key => webkitRelativePath.startsWith(key));

  if (!vol || !imageName) return;

  // Add image to volume data
  if (!volumesDataByPath[vol].files) {
    volumesDataByPath[vol].files = {};
  }
  volumesDataByPath[vol].files![imageName] = file;

  // Check if volume is complete
  if (volumesDataByPath[vol].pages?.length === Object.keys(volumesDataByPath[vol].files!).length) {
    const uploadData = volumesDataByPath[vol];
    delete volumesDataByPath[vol]; // Clear memory
    await uploadVolumeData(volumesByPath, vol, uploadData);
  }
}

export async function processFiles(_files: File[]) {
  const volumesByPath: Record<string, Partial<VolumeMetadata>> = {};
  const volumesDataByPath: Record<string, Partial<VolumeData>> = {};
  const titleUuids = new Set<string>();

  const files = _files.sort((a, b) => 
    decodeURI(a.name).localeCompare(decodeURI(b.name), undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  );

  // First pass: Process standalone mokuro files
  for (const file of files) {
    const { ext, path } = getDetails(file);
    if (ext !== 'mokuro') continue;

    const { metadata, data, titleUuid } = await processMokuroFile(file);
    titleUuids.add(titleUuid);
    volumesByPath[path] = metadata;
    volumesDataByPath[path] = {
      ...data,
      files: {}
    };
  }

  // Second pass: Process all other files
  for (const file of files) {
    const { ext } = getDetails(file);
    const { type } = file;

    if (ext === 'mokuro') continue;

    if (ext && zipTypes.includes(ext)) {
      await processZipFile(file, volumesByPath, volumesDataByPath, titleUuids);
    } else {
      const mimeType = type || getMimeType(file.name);
      if (imageTypes.includes(mimeType)) {
        await processStandaloneImage(file, volumesDataByPath, volumesByPath);
      }
    }
  }

  showSnackbar('Files uploaded successfully');
  db.processThumbnails(5);
}