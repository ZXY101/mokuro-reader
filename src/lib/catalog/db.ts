import type { VolumeData, VolumeMetadata } from '$lib/types';
import Dexie, { type Table } from 'dexie';

async function generateThumbnail(
  file: File,
  maxWidth = 250,
  maxHeight = 350
): Promise<File> {
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
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }
  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  // Set canvas size and draw the image
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  // Convert canvas to blob using the same type as the input file
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), file.type));

  // Create and return a new File with the same type
  return new File([blob], `thumbnail_${file.name}`, { type: file.type });
}

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export class CatalogDexie extends Dexie {
  volumes!: Table<VolumeMetadata>;
  volumes_data!: Table<VolumeData>;
  catalog!: Table<{ id: string; manga: any[] }>;

  constructor() {
    super('mokuro');
    this.version(1).stores({
      catalog: 'id, manga'
    });

    // Add volumes table with all fields from MokuroData and Volume types
    this.version(2)
      .stores({
        volumes_data: 'volume_uuid',
        volumes: 'volume_uuid, series_uuid',
        catalog: null // Remove old catalog table
      })
      .upgrade(async (tx) => {
        const oldCatalog = await tx.table('catalog').toArray();
        const volumes: VolumeMetadata[] = [];
        const volumes_data: VolumeData[] = [];

        for (const entry of oldCatalog) {
          for (const volume of entry.manga) {
            volumes.push({
              mokuro_version: volume.mokuroData.version,
              series_title: volume.mokuroData.title,
              series_uuid: volume.mokuroData.title_uuid,
              volume_title: volume.mokuroData.volume,
              volume_uuid: volume.mokuroData.volume_uuid,
            });
            volumes_data.push({
              volume_uuid: volume.mokuroData.volume_uuid,
              pages: volume.mokuroData.pages,
              files: volume.files
            });
          }
        }

        await tx.table('volumes').bulkAdd(volumes);
        await tx.table('volumes_data').bulkAdd(volumes_data);
      });
  }

  async processThumbnails(batchSize: number = 5): Promise<void> {
    // Get volumes without thumbnails and not currently being processed
    const volumes = await this.volumes
      .filter((volume) => !volume.thumbnail)
      .and((volume) => !volume.thumbnailProcessing)
      .limit(batchSize)
      .toArray();

    if (volumes.length === 0) return;

    // Process thumbnails in parallel
    await Promise.all(
      volumes.map(async (volume) => {
        // Mark as processing
        db.volumes_data.get({ volume_uuid: volume.volume_uuid }).then(async (data) => {
          if (data && data.files) {
            try {
              // Get the first image file when sorted naturally
              const fileNames = Object.keys(data.files).sort(naturalSort);
              const firstImageFile = fileNames.length > 0 ? data.files[fileNames[0]] : null;

              if (firstImageFile) {
                const thumbnail = await generateThumbnail(firstImageFile);
                // Update the volume with the thumbnail
                await this.volumes.where('volume_uuid').equals(volume.volume_uuid).modify({
                  thumbnail
                });
              }
            } catch (error) {
              console.error('Failed to generate thumbnail for volume:', volume.volume_uuid, error);
            }
          }
        });
      })
    );

    // Continue processing remaining volumes
    await this.processThumbnails(batchSize);
  }
}

export const db = new CatalogDexie();

// Start thumbnail processing in the background
let thumbnailProcessingStarted = true;

export function startThumbnailProcessing(): void {
  if (thumbnailProcessingStarted) return;
  thumbnailProcessingStarted = true;

  // Process thumbnails in the background
  setTimeout(() => {
    db.processThumbnails().catch((error) => {
      console.error('Error in thumbnail processing:', error);
      thumbnailProcessingStarted = false; // Allow restart on error
    });
  }, 1000); // Start after 1 second delay to let the app initialize
}
