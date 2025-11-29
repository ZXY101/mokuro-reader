/**
 * Utility functions for volume state and display logic
 */

/**
 * Determines if a volume is complete based on current page and total page count
 */
export function isVolumeComplete(currentPage: number, pageCount: number): boolean {
  return currentPage === pageCount || currentPage === pageCount - 1;
}

/**
 * Gets the current page for a volume from the progress store
 */
export function getCurrentPage(
  volumeUuid: string,
  progress: Record<string, number> | undefined
): number {
  return progress?.[volumeUuid] ?? 1;
}

/**
 * Formats the progress display string (e.g., "5 / 200")
 * Handles the edge case where page_count-1 should show as page_count
 */
export function getProgressDisplay(
  currentPage: number,
  pageCount: number,
  defaultPage: number = 1
): string {
  const displayPage = currentPage === pageCount - 1 ? pageCount : currentPage || defaultPage;
  return `${displayPage} / ${pageCount}`;
}
