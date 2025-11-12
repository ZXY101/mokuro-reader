import type { VolumeData, VolumeMetadata, Page } from '$lib/types';

/**
 * Extracts a clean title from a file or folder path
 * Examples:
 *   "My Manga Vol 1.cbz" -> { series: "My Manga", volume: "Vol 1" }
 *   "folder/Volume 03" -> { series: "folder", volume: "Volume 03" }
 *   "manga-name" -> { series: "manga-name", volume: "manga-name" }
 */
function extractTitlesFromPath(path: string): { seriesTitle: string; volumeTitle: string } {
  // Remove file extension if present
  const pathWithoutExt = path.replace(/\.(cbz|zip)$/i, '');

  // Split by path separator
  const parts = pathWithoutExt.split('/').filter(p => p.length > 0);

  if (parts.length === 0) {
    return { seriesTitle: 'Unknown', volumeTitle: 'Unknown' };
  }

  if (parts.length === 1) {
    // Single part - use as both series and volume
    const name = parts[0];

    // Try to extract volume number if present (e.g., "Series Name Vol 1")
    const volMatch = name.match(/^(.+?)\s+(vol\.?|volume|v\.?)\s*(\d+)$/i);
    if (volMatch) {
      const seriesTitle = volMatch[1].trim();
      const volumeTitle = `Volume ${volMatch[3]}`;
      return { seriesTitle, volumeTitle };
    }

    // No volume detected - use name as both
    return { seriesTitle: name, volumeTitle: name };
  }

  // Multiple parts - last is volume, rest joined as series
  const volumeTitle = parts[parts.length - 1];
  const seriesTitle = parts.slice(0, -1).join(' - ');

  return { seriesTitle, volumeTitle };
}

/**
 * Generates a UUID v4
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Gets image dimensions from a File object
 */
async function getImageDimensions(imageFile: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Creates a minimal Page object for an image without mokuro data
 */
async function createPageFromImage(
  imageFileName: string,
  imageFile: File
): Promise<Page> {
  try {
    const { width, height } = await getImageDimensions(imageFile);

    return {
      version: '', // No mokuro version for image-only pages
      img_width: width,
      img_height: height,
      blocks: [], // No OCR data
      img_path: imageFileName
    };
  } catch (error) {
    console.warn(`Failed to get dimensions for ${imageFileName}, using defaults:`, error);
    // Fallback dimensions if image loading fails
    return {
      version: '',
      img_width: 1920,
      img_height: 1080,
      blocks: [],
      img_path: imageFileName
    };
  }
}

/**
 * Generates volume metadata and data for images without a .mokuro file
 */
export async function generateFallbackVolumeData(
  path: string,
  imageFiles: Record<string, File>
): Promise<{
  metadata: Partial<VolumeMetadata>;
  data: Partial<VolumeData>;
  seriesUuid: string;
}> {
  const { seriesTitle, volumeTitle } = extractTitlesFromPath(path);

  // Generate UUIDs
  const seriesUuid = generateUUID();
  const volumeUuid = generateUUID();

  // Sort image files naturally (1.jpg, 2.jpg, 10.jpg instead of 1.jpg, 10.jpg, 2.jpg)
  const sortedFileNames = Object.keys(imageFiles).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  // Create Page objects for each image
  const pages: Page[] = await Promise.all(
    sortedFileNames.map((fileName) => createPageFromImage(fileName, imageFiles[fileName]))
  );

  const metadata: Partial<VolumeMetadata> = {
    mokuro_version: '', // Empty string indicates image-only volume
    series_title: seriesTitle,
    series_uuid: seriesUuid,
    volume_title: volumeTitle,
    volume_uuid: volumeUuid,
    page_count: pages.length,
    character_count: 0 // No OCR data means no characters
  };

  const data: Partial<VolumeData> = {
    volume_uuid: volumeUuid,
    pages: pages,
    files: imageFiles
  };

  return {
    metadata,
    data,
    seriesUuid
  };
}
