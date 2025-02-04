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

    const mimeType = type || getMimeType(file.name);

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
        }
      }
      continue;
    }

    if (ext && zipTypes.includes(ext)) {
      const unzippedFiles = await unzipManga(file);

      if (files.length === 1) {
        await processFiles(Object.values(unzippedFiles));
        return;
      }

      volumesDataByPath[path] = {
        ...volumesDataByPath[path],
        files: unzippedFiles
      };

      continue;
    }
  }

  const volumes = Object.values(volumesByPath) as VolumeMetadata[];
  const volumesData = Object.values(volumesDataByPath) as VolumeData[];

  if (volumes.length > 0 && volumesData.length > 0) {
    const valid = volumes.map((vol) => {
      if (!vol.mokuro_version || !vol.series_title || !vol.volume_uuid) {
        showSnackbar('Missing .mokuro file');
        return false;
      }

      if (!volumesData.filter((data) => data.volume_uuid === vol.volume_uuid).length) {
        showSnackbar('Missing image files');
        return false;
      }

      return true;
    });

    if (!valid.includes(false)) {
      await requestPersistentStorage();

      // Add volumes to the database
      for (const volume of volumes) {
        const existingVolume = await db.volumes
          .where('volume_uuid')
          .equals(volume.volume_uuid)
          .first();

        if (!existingVolume) {
          await db.transaction('rw', db.volumes, async () => {
            await db.volumes.add(volume, volume.volume_uuid);
          });
          await db.transaction('rw', db.volumes_data, async () => {
            const volume_data = volumesData.filter((data) => data.volume_uuid === volume.volume_uuid)[0]
            await db.volumes_data.add(volume_data, volume_data.volume_uuid);
          });
        }
      }
      await db.processThumbnails(5);

      showSnackbar('Volumes added successfully');
    }
  } else {
    showSnackbar('Missing .mokuro file');
  }
}