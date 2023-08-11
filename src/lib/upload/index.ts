import { db } from "$lib/catalog/db";
import type { Volume } from "$lib/types";
import { showSnackbar } from "$lib/util/snackbar";
import { requestPersistentStorage } from "$lib/util/upload";
import { BlobReader, ZipReader, BlobWriter, getMimeType } from "@zip.js/zip.js";

export async function unzipManga(file: File) {
  const zipFileReader = new BlobReader(file);
  const zipReader = new ZipReader(zipFileReader);

  const entries = await zipReader.getEntries()
  const unzippedFiles: Record<string, File> = {};


  for (const entry of entries) {
    const mime = getMimeType(entry.filename);
    if (mime === 'image/jpeg' || mime === 'image/png') {
      const blob = await entry.getData?.(new BlobWriter(mime))
      if (blob) {
        const file = new File([blob], entry.filename, { type: mime })
        unzippedFiles[entry.filename] = file
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
  }
}


// export async function processVolumes(volumes: Volume[]) {
//   for (const { mokuroData, volumeName, archiveFile, files } of volumes) {
//     const { title_uuid } = mokuroData
//   }


// }

export async function processFiles(fileList: FileList) {
  const files = [...fileList]
  const zipTypes = ['zip', 'cbz']
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
      const unzippedFiles = await unzipManga(file)

      volumes[filename] = {
        ...volumes[filename],
        files: unzippedFiles
      }

      continue;
    }
  }

  const vols = Object.values(volumes);

  if (vols.length > 0) {
    const valid = vols.map((vol) => {
      const { files, mokuroData, volumeName } = vol
      if (!mokuroData || !volumeName) {
        showSnackbar('Missing .mokuro file')
        return false;
      }

      if (!files) {
        showSnackbar('Missing image files')
        return false;
      }

      return true
    })

    if (!valid.includes(false)) {
      await requestPersistentStorage();
      await db.catalog.put({ id: vols[0].mokuroData.title_uuid, manga: vols })
      showSnackbar('Catalog updated successfully')
    }
  }
}
