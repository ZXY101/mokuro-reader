import { db } from '$lib/catalog/db';
import type { Volume } from '$lib/types';
import { showSnackbar } from '$lib/util/snackbar';
import { requestPersistentStorage } from '$lib/util/upload';
import { BlobReader, ZipReader, BlobWriter, getMimeType } from '@zip.js/zip.js';

const zipTypes = ['zip', 'cbz', 'ZIP', 'CBZ'];
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];


export async function unzipManga(file: File) {
  const zipFileReader = new BlobReader(file);
  const zipReader = new ZipReader(zipFileReader);

  const entries = await zipReader.getEntries();
  const unzippedFiles: Record<string, File> = {};

  for (const entry of entries) {
    const mime = getMimeType(entry.filename);
    if (imageTypes.includes(mime)) {
      const blob = await entry.getData?.(new BlobWriter(mime));
      if (blob) {
        const file = new File([blob], entry.filename, { type: mime });
        unzippedFiles[entry.filename] = file;
      }
    }
  }

  return unzippedFiles;
}

function getDetails(file: File) {
  const [filename, ext] = file.name.split('.');

  return {
    filename,
    ext
  };
}

async function getFile(fileEntry: FileSystemFileEntry) {
  try {
    return new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));
  } catch (err) {
    console.log(err);
  }
}

export async function scanFiles(item: FileSystemEntry, files: Promise<File | undefined>[]) {
  if (item.isDirectory) {
    const directoryReader = (item as FileSystemDirectoryEntry).createReader();
    await new Promise<void>((resolve) => {
      directoryReader.readEntries(async (entries) => {
        for (const entry of entries) {
          if (entry.isFile) {
            files.push(getFile(entry as FileSystemFileEntry));
          } else {
            await scanFiles(entry, files);
          }
        }
        resolve();
      });
    });
  }
}

export async function processFiles(files: File[]) {
  const volumes: Record<string, Volume> = {};
  const mangas: string[] = [];

  for (const file of files) {
    const { ext, filename } = getDetails(file);
    const { type, webkitRelativePath } = file;

    if (ext === 'mokuro') {
      const mokuroData: Volume['mokuroData'] = JSON.parse(await file.text());

      if (!mangas.includes(mokuroData.title_uuid)) {
        mangas.push(mokuroData.title_uuid);
      }

      volumes[filename] = {
        ...volumes[filename],
        mokuroData,
        volumeName: filename
      };
      continue;
    }

    const mimeType = type || getMimeType(file.name);

    if (imageTypes.includes(mimeType)) {
      if (webkitRelativePath) {
        const imageName = webkitRelativePath.split('/').at(-1);
        const vol = webkitRelativePath.split('/').at(-2);

        if (vol && imageName) {
          volumes[vol] = {
            ...volumes[vol],
            files: {
              ...volumes[vol]?.files,
              [imageName]: file
            }
          };
        }
      }
      continue;
    }

    if (zipTypes.includes(ext)) {
      const unzippedFiles = await unzipManga(file);

      volumes[filename] = {
        ...volumes[filename],
        files: unzippedFiles
      };

      continue;
    }
  }

  const vols = Object.values(volumes);

  if (vols.length > 0) {
    const valid = vols.map((vol) => {
      const { files, mokuroData, volumeName } = vol;
      if (!mokuroData || !volumeName) {
        showSnackbar('Missing .mokuro file');
        return false;
      }

      if (!files) {
        showSnackbar('Missing image files');
        return false;
      }

      return true;
    });

    if (!valid.includes(false)) {
      await requestPersistentStorage();

      for (const key of mangas) {
        const existingCatalog = await db.catalog.get(key);

        const filtered = vols.filter((vol) => {
          return (
            !existingCatalog?.manga.some((manga) => {
              return manga.mokuroData.volume_uuid === vol.mokuroData.volume_uuid;
            }) && key === vol.mokuroData.title_uuid
          );
        });

        if (existingCatalog) {
          await db.catalog.update(key, { manga: [...existingCatalog.manga, ...filtered] });
        } else {
          await db.catalog.add({ id: key, manga: filtered });
        }
      }

      showSnackbar('Catalog updated successfully');
    }
  }
}
