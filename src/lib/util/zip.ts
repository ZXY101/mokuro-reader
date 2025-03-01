import type { VolumeMetadata } from "$lib/types";
import { db } from "$lib/catalog/db";
import {
  BlobReader,
  BlobWriter,
  TextReader,
  ZipWriter,
} from "@zip.js/zip.js";

export async function zipManga(
  manga: VolumeMetadata[], 
  asCbz = false, 
  individualVolumes = false, 
  includeSeriesTitle = true
) {
  if (individualVolumes) {
    // Extract each volume individually
    for (const volume of manga) {
      await zipSingleVolume(volume, asCbz, includeSeriesTitle);
    }
  } else {
    // Extract all volumes as a single file
    await zipAllVolumes(manga, asCbz);
  }
  
  return false;
}

async function zipSingleVolume(
  volume: VolumeMetadata, 
  asCbz = false, 
  includeSeriesTitle = true
) {
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

  // Create folder name for images (same as mokuro file name without extension)
  const folderName = `${volume.volume_title}`;
  
  // Add image files inside the folder
  const imagePromises = volumeData.files ? 
    Object.entries(volumeData.files).map(([filename, file]) => {
      return zipWriter.add(`${folderName}/${filename}`, new BlobReader(file));
    }) : [];

  // Add mokuro data file in the root directory (for both ZIP and CBZ)
  const promises = [
    ...imagePromises,
    zipWriter.add(
      `${volume.volume_title}.mokuro`, 
      new TextReader(JSON.stringify(mokuroData))
    )
  ];

  // Wait for all files to be added
  await Promise.all(promises);

  const zipFileBlob = await zipWriter.close();

  const link = document.createElement('a');
  link.href = URL.createObjectURL(zipFileBlob);
  const extension = asCbz ? 'cbz' : 'zip';
  
  // Generate filename based on options
  let filename;
  if (includeSeriesTitle) {
    filename = `${volume.series_title} - ${volume.volume_title}.${extension}`;
  } else {
    filename = `${volume.volume_title}.${extension}`;
  }
  
  link.download = filename;
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

    // Organize files in volume-specific folders
    const folderPrefix = `${volume.volume_title}/`;

    // Add image files
    const imagePromises = volumeData.files ? 
      Object.entries(volumeData.files).map(([filename, file]) => {
        return zipWriter.add(`${folderPrefix}${filename}`, new BlobReader(file));
      }) : [];

    // Add mokuro data file (for both ZIP and CBZ)
    return [
      zipWriter.add(
        `${folderPrefix}${volume.volume_title}.mokuro`, 
        new TextReader(JSON.stringify(mokuroData))
      ),
      ...imagePromises,
    ];
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