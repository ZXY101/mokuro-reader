import { describe, it, expect } from 'vitest';
import type { VolumeMetadata } from '$lib/types';

// Import the sortVolumes function - we need to extract it from index.ts
// For now, we'll copy the function here for testing
function sortVolumes(a: VolumeMetadata, b: VolumeMetadata) {
  if (a.volume_title < b.volume_title) {
    return -1;
  }
  if (a.volume_title > b.volume_title) {
    return 1;
  }
  return 0;
}

// Helper function to create mock volume metadata
function createMockVolume(title: string): VolumeMetadata {
  return {
    mokuro_version: '0.4.11',
    series_title: 'からかい上手の高木さん',
    series_uuid: 'test-series-uuid',
    volume_title: title,
    volume_uuid: `test-volume-${title}`,
    page_count: 200,
    character_count: 1000,
    page_char_counts: [50, 100, 150, 200]
  };
}

describe('sortVolumes', () => {
  it('should sort Japanese volumes with numbers correctly (current behavior)', () => {
    const volumes = [
      createMockVolume('からかい上手の高木さん　１'),
      createMockVolume('からかい上手の高木さん　２'),
      createMockVolume('からかい上手の高木さん　10')
    ];

    // Shuffle the array to test actual sorting
    const shuffled = [volumes[2], volumes[0], volumes[1]]; // 10, 1, 2
    const sorted = shuffled.sort(sortVolumes);

    // Current implementation uses string comparison, so "10" comes before "2"
    expect(sorted.map((v) => v.volume_title)).toEqual([
      'からかい上手の高木さん　10', // This comes first alphabetically!
      'からかい上手の高木さん　１',
      'からかい上手の高木さん　２'
    ]);
  });

  it('should demonstrate the alphabetical sorting issue with numbers', () => {
    const volumes = [
      createMockVolume('Volume 1'),
      createMockVolume('Volume 2'),
      createMockVolume('Volume 10'),
      createMockVolume('Volume 11'),
      createMockVolume('Volume 3')
    ];

    const sorted = volumes.sort(sortVolumes);

    // String comparison puts "10" and "11" before "2" and "3"
    expect(sorted.map((v) => v.volume_title)).toEqual([
      'Volume 1',
      'Volume 10', // This should come after Volume 9 in natural order
      'Volume 11', // This should come after Volume 9 in natural order
      'Volume 2',
      'Volume 3'
    ]);
  });

  it('should handle identical titles', () => {
    const volumes = [createMockVolume('Same Title'), createMockVolume('Same Title')];

    const sorted = volumes.sort(sortVolumes);
    expect(sorted.map((v) => v.volume_title)).toEqual(['Same Title', 'Same Title']);
  });

  it('should sort basic alphabetical titles correctly', () => {
    const volumes = [
      createMockVolume('Charlie'),
      createMockVolume('Alpha'),
      createMockVolume('Bravo')
    ];

    const sorted = volumes.sort(sortVolumes);
    expect(sorted.map((v) => v.volume_title)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });
});
