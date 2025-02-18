import type { VolumeMetadata } from "$lib/types";
import { db } from "$lib/catalog/db";
import {
  BlobReader,
  BlobWriter,
  TextReader,
  ZipWriter,
} from "@zip.js/zip.js";

export async function zipManga(manga: VolumeMetadata[]) {
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

    // Add image files
    const imagePromises = volumeData.files ? 
      Object.entries(volumeData.files).map(([filename, file]) => {
        return zipWriter.add(filename, new BlobReader(file));
      }) : [];

    // Add mokuro data file
    return [
      zipWriter.add(
        `${volume.volume_title}.mokuro`, 
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
  link.download = `${manga[0].series_title}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);

  return false;
}