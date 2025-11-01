import { derived } from 'svelte/store';
import { volumes } from './volume-data';
import { calculateReadingSpeed, type ReadingSpeedResult } from '$lib/util/reading-speed';
import { db } from '$lib/catalog/db';
import type { Page } from '$lib/types';

/**
 * Personalized reading speed derived from hybrid approach:
 * - Prioritizes up to 4 hours of recent page-level session data
 * - Fills remaining time (up to 8 hours total) with completed volume data
 */
export const personalizedReadingSpeed = derived(
  volumes,
  ($volumes, set) => {
    // Start with a default value synchronously
    const defaultResult: ReadingSpeedResult = {
      charsPerMinute: 100,
      isPersonalized: false,
      confidence: 'none',
      sessionsUsed: 0
    };
    set(defaultResult);

    // Identify volumes that have sessions (need page data)
    const volumesWithSessions = Object.entries($volumes)
      .filter(([_, data]) => data.sessions && data.sessions.length > 0)
      .map(([volumeId]) => volumeId);

    // If no sessions exist, just use completed volumes (no need to load pages)
    if (volumesWithSessions.length === 0) {
      const result = calculateReadingSpeed($volumes, []);
      set(result);
      return;
    }

    // Load page data for volumes with sessions
    Promise.all(
      volumesWithSessions.map(async (volumeId) => {
        const volumeData = await db.volumes_data.get(volumeId);
        if (volumeData && volumeData.pages) {
          return {
            volume_uuid: volumeId,
            pages: volumeData.pages as Page[]
          };
        }
        return null;
      })
    ).then((results) => {
      // Filter out null results
      const allVolumesPages = results.filter((r): r is { volume_uuid: string; pages: Page[] } => r !== null);

      // Calculate with loaded page data
      const result = calculateReadingSpeed($volumes, allVolumesPages);
      set(result);
    }).catch((error) => {
      console.error('[Reading Speed] Failed to load page data:', error);
      // Fall back to completed volumes only
      const result = calculateReadingSpeed($volumes, []);
      set(result);
    });
  },
  // Initial value (typed)
  {
    charsPerMinute: 100,
    isPersonalized: false,
    confidence: 'none' as const,
    sessionsUsed: 0
  }
);
