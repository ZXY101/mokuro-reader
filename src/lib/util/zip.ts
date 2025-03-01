import type { VolumeMetadata } from "$lib/types";
import { db } from "$lib/catalog/db";
import {
  BlobReader,
  BlobWriter,
  TextReader,
  ZipWriter,
} from "@zip.js/zip.js";

export async function zipManga(manga: VolumeMetadata[], asCbz = false, individualVolumes = false) {
  if (individualVolumes) {
    // Extract each volume individually
    for (const volume of manga) {
      await zipSingleVolume(volume, asCbz);
    }
  } else {
    // Extract all volumes as a single file
    await zipAllVolumes(manga, asCbz);
  }
  
  return false;
}

async function zipSingleVolume(volume: VolumeMetadata, asCbz = false) {
  const zipWriter = new ZipWriter(new BlobWriter("application/zip"));
  
  // Get volume data from the database
  const volumeData = await db.volumes_data.get(volume.volume_uuid);
  if (!volumeData) {
    console.error(`Volume data not found for ${volume.volume_uuid}`);
    return false;
  }

  // Create mokuro data in the old format for compatibility
  const mokuroData = {
    version: volume.mokuro_version,
    title: volume.series_title,
    title_uuid: volume.series_uuid,
    volume: volume.volume_title,
    volume_uuid: volume.volume_uuid,
    pages: volumeData.pages,
    chars: volume.character_count
  };

  // Add image files
  const imagePromises = volumeData.files ? 
    Object.entries(volumeData.files).map(([filename, file]) => {
      return zipWriter.add(filename, new BlobReader(file));
    }) : [];

  // Add mokuro data file if not CBZ
  const promises = [
    ...imagePromises
  ];
  
  if (!asCbz) {
    promises.push(
      zipWriter.add(
        `${volume.volume_title}.mokuro`, 
        new TextReader(JSON.stringify(mokuroData))
      )
    );
  }

  // Wait for all files to be added
  await Promise.all(promises);

  const zipFileBlob = await zipWriter.close();

  const link = document.createElement('a');
  link.href = URL.createObjectURL(zipFileBlob);
  const extension = asCbz ? 'cbz' : 'zip';
  link.download = `${volume.series_title} - ${volume.volume_title}.${extension}`;
  link.click();
  URL.revokeObjectURL(link.href);

  return false;
}

async function zipAllVolumes(manga: VolumeMetadata[], asCbz = false) {
  const zipWriter = new ZipWriter(new BlobWriter("application/zip"));

  const promises = manga.map(async (volume) => {
    // Get volume data from the database
    const volumeData = await db.volumes_data.get(volume.volume_uuid);
    if (!volumeData) {
      console.error(`Volume data not found for ${volume.volume_uuid}`);
      return [];
    }

    // Create mokuro data in the old format for compatibility
    const mokuroData = {
      version: volume.mokuro_version,
      title: volume.series_title,
      title_uuid: volume.series_uuid,
      volume: volume.volume_title,
      volume_uuid: volume.volume_uuid,
      pages: volumeData.pages,
      chars: volume.character_count
    };

    // For CBZ, organize files in volume-specific folders
    const folderPrefix = asCbz ? `${volume.volume_title}/` : '';

    // Add image files
    const imagePromises = volumeData.files ? 
      Object.entries(volumeData.files).map(([filename, file]) => {
        return zipWriter.add(`${folderPrefix}${filename}`, new BlobReader(file));
      }) : [];

    // Add mokuro data file if not CBZ
    if (!asCbz) {
      return [
        zipWriter.add(
          `${folderPrefix}${volume.volume_title}.mokuro`, 
          new TextReader(JSON.stringify(mokuroData))
        ),
        ...imagePromises,
      ];
    }
    
    return imagePromises;
  });

  // Wait for all files to be added
  await Promise.all((await Promise.all(promises)).flat());

  const zipFileBlob = await zipWriter.close();

  const link = document.createElement('a');
  link.href = URL.createObjectURL(zipFileBlob);
  const extension = asCbz ? 'cbz' : 'zip';
  link.download = `${manga[0].series_title}.${extension}`;
  link.click();
  URL.revokeObjectURL(link.href);

  return false;
}