import type { Volume } from "$lib/types";
import {
  BlobReader,
  BlobWriter,
  TextReader,
  ZipWriter,
} from "@zip.js/zip.js";

export async function zipManga(manga: Volume[]) {
  const zipWriter = new ZipWriter(new BlobWriter("application/zip"));

  const promises = manga.map((volume) => {
    const imagePromises = Object.values(volume.files).map((file) => {
      return zipWriter.add(`${volume.volumeName}/${file.name}`, new BlobReader(file))
    })

    return [
      zipWriter.add(`${volume.volumeName}.mokuro`, new TextReader(JSON.stringify(volume.mokuroData))),
      ...imagePromises,
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