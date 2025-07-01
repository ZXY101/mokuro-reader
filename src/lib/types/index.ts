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

export type MokuroData = {
  version: string;
  title: string;
  title_uuid: string;
  volume: string;
  volume_uuid: string;
  pages: Page[];
};

type FileWithBlob = File & { blob?: string };

export type Volume = {
  mokuroData: MokuroData;
  volumeName: string;
  files: Record<string, FileWithBlob>;
};
