import { get } from 'svelte/store';
import { showSnackbar } from './snackbar';
import { browser } from '$app/environment';
import { currentView } from './hash-router';

export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

export function isReader() {
  return get(currentView).type === 'reader';
}

export function isCatalog() {
  return get(currentView).type === 'catalog';
}

let timer: any;

export function debounce(func: () => void, timeout = 50) {
  if (!timer) {
    timer = setTimeout(() => {
      func();
      clearTimeout(timer);
      timer = undefined;
    }, timeout);
  } else {
    clearTimeout(timer);
    timer = undefined;
  }
}

export function toClipboard(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  const text = target.textContent?.trim() || '';
  if (text) {
    navigator.clipboard.writeText(text);
    showSnackbar('Copied to clipboard');
  }
}

type ExtaticPayload = {
  title: string;
  volumeName: string;
  currentCharCount: number;
  totalCharCount: number;
  currentPage: number;
  totalPages: number;
  currentLineCount: number;
  totalLineCount: number;
};

type ExtaticEvent = 'mokuro-reader:page.change' | 'mokuro-reader:reader.closed';

export function fireExstaticEvent(event: ExtaticEvent, payload: ExtaticPayload) {
  if (browser) {
    document.dispatchEvent(new CustomEvent(event, { detail: payload }));
  }
}

/**
 * Reset document scroll position back to origin.
 * This is needed because scrolling in overlays (like settings menu) can
 * affect the underlying document scroll position, which cannot be scrolled
 * back manually due to input overrides.
 */
export function resetScrollPosition() {
  if (window.scrollX !== 0 || window.scrollY !== 0) {
    window.scrollTo(0, 0);
  }
  if (document.documentElement.scrollLeft !== 0 || document.documentElement.scrollTop !== 0) {
    document.documentElement.scrollLeft = 0;
    document.documentElement.scrollTop = 0;
  }
  if (document.body.scrollLeft !== 0 || document.body.scrollTop !== 0) {
    document.body.scrollLeft = 0;
    document.body.scrollTop = 0;
  }
}

/**
 * Normalize a filename/path by decoding URL-encoded characters.
 * ZIP libraries may encode Unicode filenames (e.g., %E3%82%A2 -> ア).
 * This ensures consistent keys when storing/looking up files.
 */
export function normalizeFilename(filename: string): string {
  try {
    return decodeURIComponent(filename);
  } catch {
    // If decoding fails (invalid encoding), return as-is
    return filename;
  }
}

/**
 * Extract basename from a path (handles both / and \ separators)
 */
export function getBasename(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/**
 * Remove extension from a filename
 */
export function removeExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

/**
 * Remap page img_path values to match actual file names.
 * Handles cases where image formats have been converted (e.g., png->webp, jpg->avif).
 *
 * Returns the pages array with updated img_path values, or the original if no remapping needed.
 */
export function remapPagePaths<T extends { img_path: string }>(
  pages: T[],
  files: Record<string, unknown>
): T[] {
  const fileNames = Object.keys(files);

  // Build lookup maps for matching strategies
  const normalizedToActual = new Map<string, string>();
  const pathNoExtToActual = new Map<string, string>();
  const basenameToActual = new Map<string, string>();
  const basenameNoExtToActual = new Map<string, string>();

  for (const fileName of fileNames) {
    const normalized = normalizeFilename(fileName);
    normalizedToActual.set(normalized, fileName);

    const pathNoExt = normalizeFilename(removeExtension(fileName));
    pathNoExtToActual.set(pathNoExt, fileName);

    const basename = normalizeFilename(getBasename(fileName));
    basenameToActual.set(basename, fileName);

    const basenameNoExt = normalizeFilename(removeExtension(getBasename(fileName)));
    basenameNoExtToActual.set(basenameNoExt, fileName);
  }

  // Check if any remapping is needed
  let needsRemapping = false;
  for (const page of pages) {
    const imgPath = page.img_path;
    // If exact match exists, no remapping needed for this page
    if (files[imgPath] || normalizedToActual.has(normalizeFilename(imgPath))) {
      continue;
    }
    // Check if we can find a match by path without ext, basename, or basename without extension
    const pathNoExt = normalizeFilename(removeExtension(imgPath));
    const basename = normalizeFilename(getBasename(imgPath));
    const basenameNoExt = normalizeFilename(removeExtension(getBasename(imgPath)));
    if (
      pathNoExtToActual.has(pathNoExt) ||
      basenameToActual.has(basename) ||
      basenameNoExtToActual.has(basenameNoExt)
    ) {
      needsRemapping = true;
      break;
    }
  }

  if (!needsRemapping) {
    return pages;
  }

  // Remap pages
  return pages.map((page) => {
    const imgPath = page.img_path;

    // Strategy 1: Exact match (with normalization)
    if (files[imgPath]) {
      return page;
    }
    const normalized = normalizeFilename(imgPath);
    if (normalizedToActual.has(normalized)) {
      return { ...page, img_path: normalizedToActual.get(normalized)! };
    }

    // Strategy 2: Basename match
    const basename = normalizeFilename(getBasename(imgPath));
    if (basenameToActual.has(basename)) {
      return { ...page, img_path: basenameToActual.get(basename)! };
    }

    // Strategy 3: Path without extension (handles format conversions with same path)
    const pathNoExt = normalizeFilename(removeExtension(imgPath));
    if (pathNoExtToActual.has(pathNoExt)) {
      return { ...page, img_path: pathNoExtToActual.get(pathNoExt)! };
    }

    // Strategy 4: Basename without extension (handles format conversions)
    const basenameNoExt = normalizeFilename(removeExtension(getBasename(imgPath)));
    if (basenameNoExtToActual.has(basenameNoExt)) {
      return { ...page, img_path: basenameNoExtToActual.get(basenameNoExt)! };
    }

    // No match found, keep original
    return page;
  });
}

/**
 * Result of comparing mokuro pages to actual files
 */
export interface FileMatchResult {
  matched: number;
  missingFiles: string[]; // Pages in mokuro that couldn't be matched to any file
  extraFiles: string[]; // Files that don't match any mokuro page
}

/**
 * Compare mokuro page paths against actual file names.
 * Uses the same matching strategies as remapPagePaths.
 *
 * @param pagePaths - Array of img_path values from mokuro pages
 * @param fileNames - Array of actual downloaded file names
 * @returns Object with matched count, missing files, and extra files
 */
export function comparePagePathsToFiles(pagePaths: string[], fileNames: string[]): FileMatchResult {
  // Build lookup maps for matching strategies (same as remapPagePaths)
  const normalizedToActual = new Map<string, string>();
  const pathNoExtToActual = new Map<string, string>();
  const basenameToActual = new Map<string, string>();
  const basenameNoExtToActual = new Map<string, string>();

  const unmatchedFiles = new Set<string>(fileNames);

  for (const fileName of fileNames) {
    const normalized = normalizeFilename(fileName);
    normalizedToActual.set(normalized, fileName);

    const pathNoExt = normalizeFilename(removeExtension(fileName));
    pathNoExtToActual.set(pathNoExt, fileName);

    const basename = normalizeFilename(getBasename(fileName));
    basenameToActual.set(basename, fileName);

    const basenameNoExt = normalizeFilename(removeExtension(getBasename(fileName)));
    basenameNoExtToActual.set(basenameNoExt, fileName);
  }

  const missingFiles: string[] = [];
  let matched = 0;

  for (const imgPath of pagePaths) {
    let matchedFile: string | undefined;

    // Strategy 1: Exact match (with normalization)
    const normalized = normalizeFilename(imgPath);
    if (normalizedToActual.has(normalized)) {
      matchedFile = normalizedToActual.get(normalized)!;
    }

    // Strategy 2: Basename match
    if (!matchedFile) {
      const basename = normalizeFilename(getBasename(imgPath));
      if (basenameToActual.has(basename)) {
        matchedFile = basenameToActual.get(basename)!;
      }
    }

    // Strategy 3: Path without extension
    if (!matchedFile) {
      const pathNoExt = normalizeFilename(removeExtension(imgPath));
      if (pathNoExtToActual.has(pathNoExt)) {
        matchedFile = pathNoExtToActual.get(pathNoExt)!;
      }
    }

    // Strategy 4: Basename without extension
    if (!matchedFile) {
      const basenameNoExt = normalizeFilename(removeExtension(getBasename(imgPath)));
      if (basenameNoExtToActual.has(basenameNoExt)) {
        matchedFile = basenameNoExtToActual.get(basenameNoExt)!;
      }
    }

    if (matchedFile) {
      matched++;
      unmatchedFiles.delete(matchedFile);
    } else {
      missingFiles.push(imgPath);
    }
  }

  return {
    matched,
    missingFiles,
    extraFiles: Array.from(unmatchedFiles)
  };
}
