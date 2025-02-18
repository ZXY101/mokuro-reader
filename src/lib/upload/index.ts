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

async function extractZipContents(file: File, parentPath: string = ''): Promise<File[]> {
  const unzippedFiles = await unzipManga(file);
  const extractedFiles: File[] = [];

  for (const [name, entryFile] of Object.entries(unzippedFiles)) {
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    Object.defineProperty(entryFile, 'webkitRelativePath', {
      value: fullPath
    });
    extractedFiles.push(entryFile);
  }

  return extractedFiles;
}

async function processZipFile(
  file: File,
  volumesByPath: Record<string, Partial<VolumeMetadata>>,
  volumesDataByPath: Record<string, Partial<VolumeData>>,
  pendingImagesByPath: Record<string, Record<string, File>>,
  titleUuids: Set<string>,
  fileStack: File[]
): Promise<void> {
  const { path } = getDetails(file);
  
  // Extract and add all files to the stack
  const extractedFiles = await extractZipContents(file, path);
  fileStack.push(...extractedFiles);

  // Group images by their directory
  const imagesByDir: Record<string, Record<string, File>> = {};
  for (const file of extractedFiles) {
    const { type } = file;
    const mimeType = type || getMimeType(file.name);
    if (!imageTypes.includes(mimeType)) continue;

    const dirPath = file.webkitRelativePath.split('/').slice(0, -1).join('/');
    if (!imagesByDir[dirPath]) {
      imagesByDir[dirPath] = {};
    }
    imagesByDir[dirPath][file.webkitRelativePath] = file;
  }

  // Store images for potential mokuro files
  Object.entries(imagesByDir).forEach(([dirPath, images]) => {
    pendingImagesByPath[dirPath] = images;
    
    // Check if we already have a mokuro file for this path
    if (volumesDataByPath[dirPath]) {
      volumesDataByPath[dirPath].files = images;
      if (volumesDataByPath[dirPath].pages?.length === Object.keys(images).length) {
        const uploadData = volumesDataByPath[dirPath];
        delete volumesDataByPath[dirPath];
        uploadVolumeData(volumesByPath, dirPath, uploadData);
      }
    }
  });
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
    delete volumesDataByPath[vol];
    await uploadVolumeData(volumesByPath, vol, uploadData);
  }
}

async function processMokuroWithPendingImages(
  file: File,
  volumesByPath: Record<string, Partial<VolumeMetadata>>,
  volumesDataByPath: Record<string, Partial<VolumeData>>,
  pendingImagesByPath: Record<string, Record<string, File>>,
  titleUuids: Set<string>
): Promise<void> {
  const { path } = getDetails(file);
  const { metadata, data, titleUuid } = await processMokuroFile(file);
  titleUuids.add(titleUuid);
  volumesByPath[path] = metadata;

  // Check if we have pending images for this mokuro file
  if (pendingImagesByPath[path]) {
    volumesDataByPath[path] = {
      ...data,
      files: pendingImagesByPath[path]
    };
    delete pendingImagesByPath[path];

    // Upload if complete
    if (volumesDataByPath[path].pages?.length === Object.keys(volumesDataByPath[path].files!).length) {
      const uploadData = volumesDataByPath[path];
      delete volumesDataByPath[path];
      await uploadVolumeData(volumesByPath, path, uploadData);
    }
  } else {
    // Store mokuro data for potential future images
    volumesDataByPath[path] = {
      ...data,
      files: {}
    };
  }
}

export async function processFiles(_files: File[]) {
  const volumesByPath: Record<string, Partial<VolumeMetadata>> = {};
  const volumesDataByPath: Record<string, Partial<VolumeData>> = {};
  const pendingImagesByPath: Record<string, Record<string, File>> = {};
  const titleUuids = new Set<string>();

  // Create a stack of files to process
  const fileStack = _files.sort((a, b) => 
    decodeURI(a.name).localeCompare(decodeURI(b.name), undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  ).reverse(); // Reverse to maintain order when using as a stack

  // Process files using a stack
  while (fileStack.length > 0) {
    const file = fileStack.pop()!;
    const { ext } = getDetails(file);
    const { type } = file;

    if (ext === 'mokuro') {
      await processMokuroWithPendingImages(file, volumesByPath, volumesDataByPath, pendingImagesByPath, titleUuids);
    } else if (ext && zipTypes.includes(ext)) {
      await processZipFile(file, volumesByPath, volumesDataByPath, pendingImagesByPath, titleUuids, fileStack);
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