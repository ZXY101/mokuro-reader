export async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Persisted storage granted: ${isPersisted}`);
  }
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

async function getFile(fileEntry: FileSystemFileEntry) {
  try {
    return new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));
  } catch (err) {
    console.log(err);
  }
}

export async function scanFiles(item: FileSystemEntry, files: Promise<File | undefined>[]) {
  if (item.isDirectory) {
    const directoryReader = (item as FileSystemDirectoryEntry).createReader();
    await new Promise<void>((resolve) => {
      directoryReader.readEntries((entries) => {
        entries.forEach((entry) => {
          if (entry.isFile) {
            files.push(getFile(entry as FileSystemFileEntry))
            resolve()
          }
          scanFiles(entry, files);
        });
      });
    });
  }

}