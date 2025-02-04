import { db } from '$lib/catalog/db';
import type { VolumeData, VolumeMetadata } from '$lib/types';
import { showSnackbar } from '$lib/util/snackbar';
import { requestPersistentStorage } from '$lib/util/upload';
import { ZipReader, BlobWriter, getMimeType, Uint8ArrayReader } from '@zip.js/zip.js';

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

export async function processFiles(_files: File[]) {
  const volumesByPath: Record<string, Partial<VolumeMetadata>> = {};
  const volumesDataByPath: Record<string, Partial<VolumeData>> = {};
  const titleUuids: string[] = [];

  const files = _files.sort((a, b) => {
    return decodeURI(a.name).localeCompare(decodeURI(b.name), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  })

  // First pass: Process .mokuro files
  for (const file of files) {
    const { ext, filename, path } = getDetails(file);

    if (ext === 'mokuro') {
      const mokuroData = JSON.parse(await file.text());

      if (!titleUuids.includes(mokuroData.title_uuid)) {
        titleUuids.push(mokuroData.title_uuid);
      }

      volumesByPath[path] = {
        mokuro_version: mokuroData.version,
        series_title: mokuroData.title,
        series_uuid: mokuroData.title_uuid,
        page_count: mokuroData.pages.length,
        character_count: mokuroData.chars,
        volume_title: mokuroData.volume,
        volume_uuid: mokuroData.volume_uuid
      };

      volumesDataByPath[path] = {
        volume_uuid: mokuroData.volume_uuid,
        pages: mokuroData.pages
      };
      continue;
    }
  }


  // Second pass: Process image files and archives
  for (const file of files) {
    const { ext, path } = getDetails(file);
    const { type, webkitRelativePath } = file;
    if (ext?.toLowerCase() === 'mokuro') continue;

    const mimeType = type || getMimeType(file.name);

    let uploadData: Partial<VolumeData> | undefined = undefined;

    if (imageTypes.includes(mimeType)) {
      if (webkitRelativePath) {
        const imageName = webkitRelativePath.split('/').at(-1);
        let vol = '';

        Object.keys(volumesDataByPath).forEach((key) => {
          if (webkitRelativePath.startsWith(key)) {
            vol = key;
          }
        });

        if (vol && imageName) {
          volumesDataByPath[vol] = {
            ...volumesDataByPath[vol],
            files: {
              ...volumesDataByPath[vol]?.files,
              [imageName]: file
            }
          };
          if (
            volumesDataByPath[vol].pages.length === Object.keys(volumesDataByPath[vol].files).length
          ) {
            uploadData = volumesDataByPath[vol];
            volumesDataByPath[vol] = {};
            await uploadVolumeData(volumesByPath, path, uploadData);
          } else {
            continue;
          }
        }
      }
    }

    if (ext && zipTypes.includes(ext)) {
      await extractAndUploadVolume(file, uploadData, volumesDataByPath, path, volumesByPath);
    }
  }
  showSnackbar('Files uploaded successfully');
  db.processThumbnails(5);
}