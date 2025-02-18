import { db } from '$lib/catalog/db';
import type { VolumeData, VolumeMetadata } from '$lib/types';
import { BlobWriter, ZipWriter } from '@zip.js/zip.js';

export async function extractManga(volume: VolumeMetadata) {
  // Get volume data
  const volumeData = await db.volumes_data.get(volume.volume_uuid);
  if (!volumeData) {
    throw new Error('Volume data not found');
  }

  // Create a zip file
  const zipWriter = new ZipWriter(new BlobWriter("application/zip"));

  // Add mokuro data
  const mokuroData = {
    version: volume.mokuro_version,
    title: volume.series_title,
    title_uuid: volume.series_uuid,
    volume: volume.volume_title,
    volume_uuid: volume.volume_uuid,
    pages: volumeData.pages,
    chars: volume.character_count
  };
  await zipWriter.add("data.mokuro", new BlobWriter("application/json").init(JSON.stringify(mokuroData)));

  // Add image files
  if (volumeData.files) {
    for (const [filename, file] of Object.entries(volumeData.files)) {
      await zipWriter.add(filename, new BlobWriter(file.type).init(await file.arrayBuffer()));
    }
  }

  // Close and get the zip file
  const zipBlob = await zipWriter.close();
  const zipFile = new File([zipBlob], `${volume.series_title} - ${volume.volume_title}.zip`, { type: "application/zip" });

  // Create download link
  const a = document.createElement('a');
  a.href = URL.createObjectURL(zipFile);
  a.download = zipFile.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}