export type Volume = {
  title: string;
  cover: string;
  currentPage: number;
  totalPages: number;
}

export type Manga = {
  title: string;
  cover: string;
  volumes: Volume[];
};