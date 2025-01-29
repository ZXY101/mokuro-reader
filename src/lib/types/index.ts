export type Block = {
  box: number[];
  vertical: boolean;
  font_size: number;
  lines: string[];
};

export type Page = {
  version: string;
  img_width: number;
  img_height: number;
  blocks: Block[];
  img_path: string;
};

export interface VolumeEntry {
  version: string;
  title: string;
  title_uuid: string;
  volume: string;
  volume_uuid: string;
  pages: Page[];
  files: Record<string, File>;
  thumbnail?: File;
  thumbnailProcessing?: boolean;
}

/** @deprecated Use VolumeEntry instead */
export type MokuroData = {
  version: string;
  title: string;
  title_uuid: string;
  volume: string;
  volume_uuid: string;
  pages: Page[];
};

/** @deprecated Use VolumeEntry instead */
export type Volume = {
  mokuroData: MokuroData;
  volumeName: string;
  files: Record<string, File>;
};

/** Convert deprecated Volume type to VolumeEntry */
export function volumeToVolumeEntry(volume: Volume): VolumeEntry {
  return {
    version: volume.mokuroData.version,
    title: volume.mokuroData.title,
    title_uuid: volume.mokuroData.title_uuid,
    volume: volume.mokuroData.volume,
    volume_uuid: volume.mokuroData.volume_uuid,
    pages: volume.mokuroData.pages,
    files: volume.files
  };
}

/** Convert VolumeEntry to deprecated Volume type */
export function volumeEntryToVolume(entry: VolumeEntry): Volume {
  return {
    mokuroData: {
      version: entry.version,
      title: entry.title,
      title_uuid: entry.title_uuid,
      volume: entry.volume,
      volume_uuid: entry.volume_uuid,
      pages: entry.pages
    },
    volumeName: entry.volume,
    files: entry.files
  };
}
