import { db } from "$lib/catalog/db";
import { requestPersistentStorage } from "$lib/util/upload";
import { BlobReader, ZipReader } from "@zip.js/zip.js";

export type Volume = {
  mokuroData: any;
  volumeName: string;
  archiveFile?: File | undefined;
  files?: Record<string, File>;
}

export async function unzipManga(file: File) {
  const zipFileReader = new BlobReader(file);
  const zipReader = new ZipReader(zipFileReader);

  return await zipReader.getEntries()
}

function getDetails(file: File) {
  const [filename, ext] = file.name.split('.');

  return {
    filename,
    ext
  }
}


export function processVolumes(volumes: Volume[]) {
  volumes.map(({ mokuroData, volumeName, archiveFile, files }) => {
    console.log(mokuroData, volumeName, archiveFile, files);
  })
}

export async function processFiles(fileList: FileList) {
  const files = [...fileList]
  const zipTypes = ['zip', 'rar', 'cbz']
  const volumes: Record<string, Volume> = {};

  for (const file of files) {
    const { ext, filename } = getDetails(file)
    const { type, webkitRelativePath } = file

    if (ext === 'mokuro') {
      const mokuroData = JSON.parse(await file.text())

      volumes[filename] = {
        ...volumes[filename],
        mokuroData,
        volumeName: filename
      };
      continue;
    }

    if (type === 'image/jpeg' || type === 'image/png') {
      if (webkitRelativePath) {
        const imageName = webkitRelativePath.split('/').at(-1)
        const vol = webkitRelativePath.split('/').at(-2)

        if (vol && imageName) {
          volumes[vol] = {
            ...volumes[vol],
            files: {
              ...volumes[vol]?.files,
              [imageName]: file,
            },
          };
        }
      }
      continue;
    }

    if (zipTypes.includes(ext)) {
      volumes[filename] = {
        ...volumes[filename],
        archiveFile: file
      }
      continue;
    }
  }

  const vols = Object.values(volumes);

  if (vols.length > 0) {
    await requestPersistentStorage();
    await processVolumes(vols)
    await db.catalog.put({ manga: vols })
  }
}
