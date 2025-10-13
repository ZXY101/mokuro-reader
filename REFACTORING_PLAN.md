# Cloud Storage Refactoring Plan

## Executive Summary

**The Problem:** We attempted to create a unified cache that normalizes all cloud providers (Google Drive, MEGA, WebDAV) into a single `CloudVolumeMetadata` format. This approach is failing because:
- Provider-specific metadata gets lost (Drive's `modifiedTime`, `capabilities`, file IDs)
- Provider-specific features break (Drive duplicate detection, MEGA deduplication)
- Excessive transformation overhead (provider format → unified format → provider format)
- Components need provider-specific features that don't fit the unified model

**The Solution:** Provider-specific caches with a unified interface layer.

## Current Architecture (Problematic)

```
Components → Unified Cache (CloudVolumeMetadata[]) → Providers
                   ↓
          (Forces normalization)
          (Loses provider features)
```

## New Architecture (Better)

```
Components → Unified Interface → Provider-Specific Caches → Provider APIs
                ↓
         (Routes to correct provider)
         (Preserves all features)

Provider-Specific Caches:
├── driveFilesCache (Map<path, DriveFileMetadata>)
├── megaCache (built-in MEGA cache)
└── webdavCache (TBD)
```

## Key Principles

1. **Keep Provider-Specific Caches** - Don't try to normalize what shouldn't be normalized
2. **Unified Interface, Not Unified Cache** - Abstract the common operations, not the data
3. **Reactive Everywhere** - All caches should be Svelte stores for reactivity
4. **Feature Preservation** - Provider-specific features are first-class citizens
5. **Gradual Migration** - Can use the interface for common ops while keeping direct access available

## What We've Done (To Be Reverted)

### Files Modified (Need Review/Revert)
1. ✅ **backup.ts** - Removed driveFilesCache, may need some of it back
2. ✅ **sync-service.ts** - Refactored to query Drive API directly (keep this)
3. ✅ **drive-state.ts** - Simplified (keep this)
4. ✅ **index.ts** - Removed driveFilesCache exports (revert this)
5. ✅ **update-drive-descriptions.ts** - Removed cache manipulation (revert this)
6. ✅ **download-queue.ts** - Removed cache manipulation (revert this)
7. ❌ **drive-files-cache.ts** - DELETED (needs restoration from git)

### Files Blocked
1. **src/routes/[manga]/+page.svelte** - Has extensive driveFilesCache usage for:
   - Duplicate Drive file detection (lines 320-357)
   - Drive backup checking (lines 72-77, 210)
   - Cache manipulation when cleaning duplicates (line 381)

## Implementation Plan

### Phase 1: Restore Foundation (Priority 1)

#### 1.1 Restore driveFilesCache
```bash
# Restore from git history
git show HEAD~N:src/lib/util/google-drive/drive-files-cache.ts > src/lib/util/google-drive/drive-files-cache.ts
```

**Why:** We need the Drive-specific cache with all its metadata and features.

#### 1.2 Re-export driveFilesCache in index.ts
```typescript
// src/lib/util/google-drive/index.ts
export { driveFilesCache } from './drive-files-cache';
```

**Why:** Components need access to Drive-specific features.

#### 1.3 Restore Cache Manipulation in Key Files
- **update-drive-descriptions.ts**: Add back `driveFilesCache.updateFileDescription()`
- **download-queue.ts**: Add back cache updates after downloads

**Why:** Cache should stay synchronized with Drive state.

### Phase 2: Create Unified Interface Layer (Priority 2)

#### 2.1 Define Cloud Cache Interface
```typescript
// src/lib/util/sync/cloud-cache-interface.ts

export interface CloudCacheEntry {
  id: string;
  path: string;
  name: string;
  size?: number;
  modifiedTime?: string;
  // Provider-specific metadata is preserved in the raw cache
}

export interface CloudCache {
  // Common operations
  store: Readable<Map<string, any>>; // Reactive store
  has(path: string): boolean;
  get(path: string): any | null;
  getAll(): any[];
  getBySeries(seriesTitle: string): any[];

  // Lifecycle
  fetch(): Promise<void>;
  clear(): void;

  // Updates (optional, not all providers need this)
  update?(id: string, updates: Partial<any>): void;
  remove?(id: string): void;
}
```

**Why:** Define a common contract without forcing normalization.

#### 2.2 Adapt driveFilesCache to Interface
```typescript
// src/lib/util/google-drive/drive-files-cache.ts

export class DriveFilesCache implements CloudCache {
  // Existing implementation stays mostly the same
  // Just ensure it matches the CloudCache interface

  store = writable<Map<string, DriveFileMetadata>>(new Map());

  has(path: string): boolean {
    return this.cache.has(path);
  }

  get(path: string): DriveFileMetadata | null {
    return this.cache.get(path) || null;
  }

  getAll(): DriveFileMetadata[] {
    return Array.from(this.cache.values());
  }

  getBySeries(seriesTitle: string): DriveFileMetadata[] {
    return this.getDriveFilesBySeries(seriesTitle);
  }

  // ... existing methods remain ...
}

export const driveFilesCache = new DriveFilesCache();
```

**Why:** Make driveFilesCache compatible with interface while preserving all features.

#### 2.3 Create Cache Manager
```typescript
// src/lib/util/sync/cache-manager.ts

class CacheManager {
  private caches = new Map<ProviderType, CloudCache>();

  // Register provider-specific caches
  registerCache(provider: ProviderType, cache: CloudCache) {
    this.caches.set(provider, cache);
  }

  // Route to correct cache
  getCache(provider: ProviderType): CloudCache | null {
    return this.caches.get(provider) || null;
  }

  // Convenience methods that route to default provider
  has(path: string): boolean {
    const provider = this.getDefaultProvider();
    return this.getCache(provider)?.has(path) ?? false;
  }

  get(path: string): any | null {
    const provider = this.getDefaultProvider();
    return this.getCache(provider)?.get(path) ?? null;
  }

  // Subscribe to all cache updates (merged reactive store)
  allFiles: Readable<any[]> = derived(
    // Combine all provider cache stores
    [driveFilesCache.store, /* megaCache.store, etc */],
    ([$drive, /* $mega */]) => {
      return [...$drive.values(), /* ...$mega.values() */];
    }
  );

  private getDefaultProvider(): ProviderType {
    // Return first authenticated provider
    return providerManager.getDefaultProvider()?.type ?? 'google-drive';
  }
}

export const cacheManager = new CacheManager();

// Register caches
cacheManager.registerCache('google-drive', driveFilesCache);
// cacheManager.registerCache('mega', megaCache); // When implemented
```

**Why:** Central routing point while preserving direct access to provider caches.

### Phase 3: Update Components (Priority 3)

#### 3.1 Update [manga]/+page.svelte
The series page needs both common and Drive-specific features:

```typescript
// For common operations (checking backups)
let allFiles = $state<any[]>([]);
$effect(() => {
  return cacheManager.allFiles.subscribe(value => {
    allFiles = value;
  });
});

// For Drive-specific features (duplicate detection)
let driveCache = $state(new Map());
$effect(() => {
  return driveFilesCache.store.subscribe(value => {
    driveCache = value;
  });
});

// Duplicate detection uses Drive-specific cache directly
let duplicateDriveFiles = $derived.by(() => {
  const seriesTitle = manga[0].series_title;
  const driveFilesForSeries = driveFilesCache.getDriveFilesBySeries(seriesTitle);
  // ... duplicate detection logic using Drive-specific metadata ...
});
```

**Why:** Use interface for common ops, direct cache access for provider-specific features.

#### 3.2 Update Other Components
- **BackupButton**: Can use cacheManager for checking if backed up
- **PlaceholderVolumeItem**: Can use provider-specific cache for download button
- **Cloud page**: Continue using provider-specific interfaces as needed

### Phase 4: Simplify Unified Cloud Manager (Priority 4)

The `unified-cloud-manager` should become simpler - it's now just a router, not a cache:

```typescript
// src/lib/util/sync/unified-cloud-manager.ts

class UnifiedCloudManager {
  // Remove the cloudFiles store and cache
  // Keep the provider routing logic

  async uploadVolumeCbz(provider: ProviderType, path: string, blob: Blob) {
    const result = await this.providers[provider].uploadFile(path, blob);

    // Update the provider-specific cache
    const cache = cacheManager.getCache(provider);
    if (cache) {
      await cache.fetch(); // Refresh cache after upload
    }

    return result;
  }

  async downloadVolumeCbz(fileId: string, onProgress?: ProgressCallback) {
    const provider = this.detectProviderFromFileId(fileId);
    return await this.providers[provider].downloadFile(fileId, onProgress);
  }

  async deleteFile(fileId: string) {
    const provider = this.detectProviderFromFileId(fileId);
    await this.providers[provider].deleteFile(fileId);

    // Update cache
    const cache = cacheManager.getCache(provider);
    cache?.remove?.(fileId);
  }

  // Remove the CloudVolumeMetadata transformation logic
  // Providers return their native formats, consumers use cacheManager
}
```

**Why:** Simpler, doesn't try to maintain its own cache, just routes operations.

## Benefits of This Approach

1. **Preserves All Features**: Drive duplicates, MEGA deduplication, etc. all work
2. **Simpler Mental Model**: Each provider has its cache, interface routes to it
3. **Less Refactoring**: Work with existing structures, not against them
4. **Easier to Extend**: New providers just implement CloudCache interface
5. **Reactive**: Svelte stores at the cache level provide reactivity
6. **Gradual Migration**: Can migrate to interface incrementally

## Migration Strategy

### Immediate (Get Building Again)
1. Restore driveFilesCache.ts from git
2. Re-export in index.ts
3. Restore cache manipulation in download-queue.ts and update-drive-descriptions.ts
4. Build should succeed

### Short-term (This Week)
1. Create CloudCache interface
2. Adapt driveFilesCache to interface
3. Create CacheManager
4. Update [manga]/+page.svelte to use both interface and direct cache

### Medium-term (Next Sprint)
1. Simplify unified-cloud-manager
2. Update other components to use cacheManager
3. Add MEGA cache implementation
4. Add WebDAV cache implementation

## Files to Create/Modify

### New Files
- `src/lib/util/sync/cloud-cache-interface.ts` - Interface definition
- `src/lib/util/sync/cache-manager.ts` - Central cache router

### Files to Restore
- `src/lib/util/google-drive/drive-files-cache.ts` - From git history

### Files to Modify
- `src/lib/util/google-drive/index.ts` - Re-export driveFilesCache
- `src/lib/util/google-drive/drive-files-cache.ts` - Implement CloudCache interface
- `src/lib/util/sync/unified-cloud-manager.ts` - Simplify to router only
- `src/lib/util/download-queue.ts` - Restore cache updates
- `src/lib/util/update-drive-descriptions.ts` - Restore cache updates
- `src/routes/[manga]/+page.svelte` - Use cacheManager + direct cache access

### Files That Worked (Keep As-Is)
- `src/lib/util/google-drive/sync-service.ts` - Direct API queries are good
- `src/lib/util/google-drive/drive-state.ts` - Simplified state is good
- `src/lib/util/sync/provider-manager.ts` - Works well

## Success Criteria

1. ✅ Application builds without errors
2. ✅ Google Drive placeholders appear in catalog
3. ✅ Drive duplicate detection works
4. ✅ Can download volumes from Drive
5. ✅ Can backup volumes to Drive
6. ✅ Can delete volumes from Drive
7. ✅ MEGA continues to work (when implemented)
8. ✅ All provider-specific features preserved

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Components                           │
│  ([manga]/+page, BackupButton, PlaceholderItem, etc.)   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├─ Common operations (check backup, list files)
                 │  ↓
      ┌──────────▼──────────────────┐
      │     CacheManager             │
      │  (Routes to provider cache)  │
      └──────────┬──────────────────┘
                 │
      ┌──────────┴───────────┬────────────────┐
      │                      │                 │
┌─────▼────────┐  ┌─────────▼───────┐  ┌─────▼─────────┐
│ driveFiles   │  │   megaCache     │  │  webdavCache  │
│   Cache      │  │  (MEGA built-in)│  │     (TBD)     │
│              │  │                 │  │               │
│ Store:       │  │  Store:         │  │  Store:       │
│ Map<path,    │  │  Map<...>       │  │  Map<...>     │
│  DriveFile>  │  │                 │  │               │
└──────┬───────┘  └────────┬────────┘  └───────┬───────┘
       │                   │                    │
┌──────▼───────────────────▼────────────────────▼───────┐
│            Unified Cloud Manager                       │
│         (Routes API operations to providers)           │
└────────────────────┬───────────────────────────────────┘
                     │
      ┌──────────────┴────────────────┬──────────────────┐
      │                               │                   │
┌─────▼──────────┐       ┌───────────▼────┐    ┌────────▼────────┐
│ Google Drive   │       │  MEGA Provider │    │ WebDAV Provider │
│   Provider     │       │                │    │                 │
└────────────────┘       └────────────────┘    └─────────────────┘
```

## Notes

- **Reactive by Design**: Each cache is a Svelte store, components subscribe and get automatic updates
- **Feature Parity**: Provider-specific features (Drive duplicates) work because we keep native formats
- **Gradual Adoption**: Components can start using cacheManager incrementally
- **Direct Access OK**: For provider-specific features, direct cache access is encouraged

## Next Steps

1. Review this plan
2. Start with Phase 1: Restore foundation
3. Get the build working again
4. Implement Phase 2: Create interface layer
5. Migrate components gradually (Phase 3)

---

*Last Updated: 2025-01-XX*
*Status: Planning - Ready for Implementation*
