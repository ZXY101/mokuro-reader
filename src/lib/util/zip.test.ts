import { describe, it, expect, vi, beforeEach } from 'vitest';
import { zipManga } from './zip';
import { db } from '$lib/catalog/db';

// Mock the database
vi.mock('$lib/catalog/db', () => ({
  db: {
    volumes_data: {
      get: vi.fn()
    }
  }
}));

// Mock the DOM APIs
global.URL.createObjectURL = vi.fn(() => 'blob:test');
global.URL.revokeObjectURL = vi.fn();

// Mock document.createElement
document.createElement = vi.fn().mockImplementation((tag) => {
  if (tag === 'a') {
    return {
      href: '',
      download: '',
      click: vi.fn()
    };
  }
  return {};
});

describe('zipManga', () => {
  const mockVolume = {
    volume_uuid: 'test-uuid',
    series_uuid: 'series-uuid',
    series_title: 'Test Manga',
    volume_title: 'Volume 1',
    mokuro_version: '1.0',
    character_count: 100
  };

  const mockVolumeData = {
    pages: [{ width: 100, height: 100 }],
    files: {
      'page1.jpg': new Blob(['test'], { type: 'image/jpeg' })
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    db.volumes_data.get.mockResolvedValue(mockVolumeData);
  });

  it('should call zipAllVolumes when individualVolumes is false', async () => {
    const result = await zipManga([mockVolume], false, false, true);
    expect(result).toBe(false);
    expect(document.createElement).toHaveBeenCalledWith('a');
    const link = document.createElement('a');
    expect(link.download).toContain('.zip');
  });

  it('should call zipSingleVolume when individualVolumes is true', async () => {
    const result = await zipManga([mockVolume], false, true, true);
    expect(result).toBe(false);
    expect(document.createElement).toHaveBeenCalledWith('a');
    const link = document.createElement('a');
    expect(link.download).toContain('.zip');
  });

  it('should use cbz extension when asCbz is true', async () => {
    const result = await zipManga([mockVolume], true, false, true);
    expect(result).toBe(false);
    expect(document.createElement).toHaveBeenCalledWith('a');
    const link = document.createElement('a');
    expect(link.download).toContain('.cbz');
  });
  
  it('should include series title in filename when includeSeriesTitle is true', async () => {
    const result = await zipManga([mockVolume], false, true, true);
    expect(result).toBe(false);
    expect(document.createElement).toHaveBeenCalledWith('a');
    const link = document.createElement('a');
    expect(link.download).toContain('Test Manga - Volume 1');
  });
  
  it('should exclude series title from filename when includeSeriesTitle is false', async () => {
    const result = await zipManga([mockVolume], false, true, false);
    expect(result).toBe(false);
    expect(document.createElement).toHaveBeenCalledWith('a');
    const link = document.createElement('a');
    expect(link.download).not.toContain('Test Manga -');
    expect(link.download).toContain('Volume 1');
  });
});