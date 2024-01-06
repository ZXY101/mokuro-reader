import type { Volume } from "$lib/types";
import {
  BlobReader,
  BlobWriter,
  TextReader,
  ZipWriter,
} from "@zip.js/zip.js";

async function zipVolumes(manga: Volume[]) {
  const volumeZips = []

  for (const volume of manga) {
    const files = Object.values(volume.files);
    const zipWriter = new ZipWriter(new BlobWriter("application/zip"));

    const promises = files.map((file) => {
      return zipWriter.add(file.name, new BlobReader(file))
    })


    await Promise.all(promises);


    volumeZips.push({
      zipName: volume.volumeName,
      zipBlob: await zipWriter.close(),
      mokuroData: JSON.stringify(volume.mokuroData)
    });
  }

  return volumeZips;
}

export async function zipManga(manga: Volume[]) {
  const volumeZips = await zipVolumes(manga)
  const zipWriter = new ZipWriter(new BlobWriter("application/zip"));


  const promises = volumeZips.map((volumeZip) => {
    return [
      zipWriter.add(`${volumeZip.zipName}.mokuro`, new TextReader(volumeZip.mokuroData)),
      zipWriter.add(`${volumeZip.zipName}.zip`, new BlobReader(volumeZip.zipBlob))
    ]
  })

  await Promise.all(promises);

  const zipFileBlob = await zipWriter.close();

  const link = document.createElement('a');
  link.href = URL.createObjectURL(zipFileBlob);
  link.download = `${manga[0].mokuroData.title}.zip`;
  link.click();

  return false
}