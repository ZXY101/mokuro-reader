import type { Page } from '$lib/types';
import Dexie, { type Table } from 'dexie';

export interface VolumeEntry {
  version: string;
  title: string;
  title_uuid: string;
  volume: string;
  volume_uuid: string;
  pages: Page[];
  files: Record<string, File>;
  thumbnail?: File;
}

async function generateThumbnail(file: File, maxSize: number = 300): Promise<File> {
  // Create a canvas element
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Create an image element and load the file
  const img = new Image();
  const imgUrl = URL.createObjectURL(file);
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imgUrl;
  });
  URL.revokeObjectURL(imgUrl);

  // Calculate thumbnail dimensions maintaining aspect ratio
  let width = img.width;
  let height = img.height;
  if (width > height) {
    if (width > maxSize) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    }
  } else {
    if (height > maxSize) {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
  }

  // Set canvas size and draw the image
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  // Convert canvas to blob using the same type as the input file
  const blob = await new Promise<Blob>((resolve) => 
    canvas.toBlob((b) => resolve(b!), file.type)
  );

  // Create and return a new File with the same type
  return new File([blob], `thumbnail_${file.name}`, { type: file.type });
}

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export class CatalogDexie extends Dexie {
  volumes!: Table<VolumeEntry>;
  catalog!: Table<{ id: string; manga: any[] }>;

  constructor() {
    super('mokuro');
    this.version(1).stores({
      catalog: 'id, manga'
    });

    // Add volumes table with all fields from MokuroData and Volume types
    this.version(2).stores({
      volumes: 'volume_uuid, title_uuid, title, volume',
      catalog: null // Remove old catalog table
    }).upgrade(async tx => {
      const oldCatalog = await tx.table('catalog').toArray();
      const volumes: VolumeEntry[] = [];
      
      for (const entry of oldCatalog) {
        for (const volume of entry.manga) {
          // Get the first image file when sorted naturally
          const files = volume.files;
          const fileNames = Object.keys(files).sort(naturalSort);
          const firstImageFile = fileNames.length > 0 ? files[fileNames[0]] : null;

          // Generate thumbnail if we have an image
          let thumbnail: File | undefined;
          if (firstImageFile) {
            try {
              thumbnail = await generateThumbnail(firstImageFile);
            } catch (error) {
              console.error('Failed to generate thumbnail:', error);
            }
          }

          volumes.push({
            version: volume.mokuroData.version,
            title: volume.mokuroData.title,
            title_uuid: volume.mokuroData.title_uuid,
            volume: volume.mokuroData.volume,
            volume_uuid: volume.mokuroData.volume_uuid,
            pages: volume.mokuroData.pages,
            files: volume.files,
            thumbnail
          });
        }
      }

      await tx.table('volumes').bulkAdd(volumes);
    });
  }
}

export const db = new CatalogDexie();
