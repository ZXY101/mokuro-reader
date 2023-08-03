import { BlobReader, ZipReader } from "@zip.js/zip.js";

export async function unzipManga(file: File) {
  const zipFileReader = new BlobReader(file);
  const zipReader = new ZipReader(zipFileReader);

  return await zipReader.getEntries()
}