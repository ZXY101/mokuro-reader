# Multi-Provider Cloud Storage Migration

## Overview
Migrating from Drive-only to multi-provider (Drive, MEGA, WebDAV) cloud storage architecture.

## Current Status ✅

### Completed:
1. ✅ Extended `SyncProvider` interface with volume storage methods
2. ✅ Updated `VolumeMetadata` type with backward-compatible cloud fields
3. ✅ Created `cloud-fields.ts` helper utilities for migration

### Type Changes:
```typescript
// VolumeMetadata now has:
cloudProvider?: 'google-drive' | 'mega' | 'webdav';  // New
cloudFileId?: string;                                // New
cloudModifiedTime?: string;                          // New
cloudSize?: number;                                  // New

// Legacy fields (kept for backward compatibility):
driveFileId?: string;        // Auto-migrates to cloudFileId
driveModifiedTime?: string;  // Auto-migrates to cloudModifiedTime
driveSize?: number;          // Auto-migrates to cloudSize
```

### New Provider Methods:
```typescript
interface SyncProvider {
  // ... existing methods ...

  // Volume storage (NEW):
  listCloudVolumes(): Promise<CloudVolumeMetadata[]>;
  uploadVolumeCbz(path: string, blob: Blob, description?: string): Promise<string>;
  downloadVolumeCbz(fileId: string, onProgress?: (loaded, total) => void): Promise<Blob>;
  deleteVolumeCbz(fileId: string): Promise<void>;
}
```

## Remaining Work 🚧

### Phase 1: Implement Provider Methods
- [ ] MEGA volume storage (upload/download/list/delete CBZ files)
- [ ] WebDAV volume storage (upload/download/list/delete CBZ files)
- [ ] Google Drive provider wrapper (wrap existing Drive code)

### Phase 2: Unified Cloud Manager
- [ ] Create `unified-cloud-manager.ts`
  - Aggregates files from all providers
  - Handles caching
  - Provides provider lookup by fileId

### Phase 3: Update Consumers
- [ ] Update `placeholders.ts` - use unified manager
- [ ] Update `download-queue.ts` - route by cloudProvider
- [ ] Update `backup.ts` - upload to all providers
- [ ] Update `PlaceholderVolumeItem.svelte` - use cloud fields
- [ ] Update `BackupButton.svelte` - multi-provider upload
- [ ] Update `Catalog.svelte` - unified cloud state

### Phase 4: UI/State Updates
- [ ] Create `unified-sync-state.ts` store
- [ ] Update `NavBar.svelte` - unified cloud status
- [ ] Update all components using `driveFileId` → use `getCloudFileId()`

## Migration Strategy

### Backward Compatibility:
All existing Drive data continues working:
- Legacy `driveFileId` fields are automatically treated as `google-drive` provider
- Helper functions (`getCloudFileId`, `getCloudProvider`) handle both formats
- No database migration needed - happens lazily at runtime

### Testing Plan:
1. Test Drive → still works with legacy fields
2. Test Drive → works with new fields
3. Test MEGA → works with new fields
4. Test WebDAV → works with new fields
5. Test mixed → user has volumes in both Drive and MEGA

## File Impact Matrix

| File | Change Type | Complexity |
|------|-------------|------------|
| `provider-interface.ts` | ✅ Done | Low |
| `types/index.ts` | ✅ Done | Low |
| `cloud-fields.ts` | ✅ Done | Low |
| `mega-provider.ts` | Implement methods | Medium |
| `webdav-provider.ts` | Implement methods | Medium |
| `google-drive-provider.ts` | NEW - wrap existing | Medium |
| `unified-cloud-manager.ts` | NEW - create | High |
| `placeholders.ts` | Update logic | Medium |
| `download-queue.ts` | Add routing | Medium |
| `backup.ts` | Multi-provider | Medium |
| `PlaceholderVolumeItem.svelte` | Use helpers | Low |
| `BackupButton.svelte` | Use helpers | Low |
| `Catalog.svelte` | Use helpers | Low |
| `NavBar.svelte` | Unified state | Medium |
| 10+ other components | Use helpers | Low each |

## Rollout Approach

### Option A: Big Bang (Current Path)
- Implement everything in one PR
- Test thoroughly before merge
- Single deployment

### Option B: Incremental
- Commit foundation (DONE ✅)
- Implement providers only
- Implement manager
- Update consumers
- Multiple PRs, easier to review

### Recommendation: Option B
Current checkpoint is a good place to commit. Changes are:
- Non-breaking (backward compatible)
- Foundation only (no behavior changes)
- Well-documented

## Next Steps

1. **Commit current changes:**
   ```bash
   git add -A
   git commit -m "feat: Add multi-provider foundation for cloud storage

   - Add volume storage methods to SyncProvider interface
   - Update VolumeMetadata with generic cloud fields (backward compatible)
   - Add cloud-fields helper utilities for seamless migration

   This is foundation work - no behavior changes yet."
   ```

2. **Continue implementation** in next session or continue now

3. **Test incrementally** as each provider is implemented
