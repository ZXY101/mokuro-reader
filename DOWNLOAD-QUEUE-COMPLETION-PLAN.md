# Download Queue Multi-Provider Completion Plan

## Current State ✅

### Completed Work:
1. ✅ Added imports: unifiedCloudManager, cloud field helpers, zip.js
2. ✅ Updated `QueueItem` interface with `cloudFileId` and `cloudProvider`
3. ✅ Updated `queueVolume()` to use `getCloudFileId()` and `getCloudProvider()`
4. ✅ Updated `queueSeriesVolumes()` to use cloud field helpers
5. ✅ Added `decompressCbz()` helper function for MEGA/WebDAV downloads

### Type Check Status:
- **Total errors**: 192 (baseline: ~185)
- **New errors from changes**: 3 errors in decompressCbz() - fixable
  - Line 215: `entry.getData` possibly undefined
  - Line 218: Type 'ArrayBufferLike' not assignable to 'ArrayBuffer'

## Remaining Work 🚧

### Task 1: Fix decompressCbz() Type Errors

**File**: `src/lib/util/download-queue.ts` (lines 206-224)

**Issue**:
```typescript
const uint8Array = await entry.getData(new Uint8ArrayWriter());  // getData possibly undefined
decompressed.push({
    filename: entry.filename,
    data: uint8Array.buffer  // ArrayBufferLike not assignable to ArrayBuffer
});
```

**Solution**:
```typescript
async function decompressCbz(blob: Blob): Promise<DecompressedEntry[]> {
    const reader = new BlobReader(blob);
    const zipReader = new ZipReader(reader);
    const entries = await zipReader.getEntries();

    const decompressed: DecompressedEntry[] = [];
    for (const entry of entries) {
        if (entry.directory || !entry.getData) continue;  // Check getData exists

        const uint8Array = await entry.getData(new Uint8ArrayWriter());
        decompressed.push({
            filename: entry.filename,
            data: uint8Array.buffer as ArrayBuffer  // Type assertion
        });
    }

    await zipReader.close();
    return decompressed;
}
```

### Task 2: Rewrite processQueue() - Hybrid Download Logic

**File**: `src/lib/util/download-queue.ts` (lines 325-475)

**Architecture**:
- **Google Drive**: Continue using worker pool (high performance parallel downloads)
- **MEGA/WebDAV**: Use `unifiedCloudManager.downloadVolumeCbz()` + `decompressCbz()` (compatibility)

**Implementation Plan**:

#### Step 2a: Update processQueue() signature and setup
```typescript
async function processQueue(): Promise<void> {
    const queue = get(queueStore);

    // Process all queued items
    for (const item of queue) {
        if (item.status !== 'queued') {
            continue;
        }

        // Mark processing as started
        processingStarted = true;

        // Mark as downloading
        queueStore.update(q =>
            q.map(i => (i.volumeUuid === item.volumeUuid ? { ...i, status: 'downloading' as const } : i))
        );

        const processId = `download-${item.cloudFileId}`;  // Changed from driveFileId

        // Add progress tracker
        progressTrackerStore.addProcess({
            id: processId,
            description: `Downloading ${item.volumeTitle}`,
            progress: 0,
            status: 'Starting download...'
        });

        // Route based on provider
        if (item.cloudProvider === 'google-drive') {
            await processDriveDownload(item, processId);
        } else {
            await processNonDriveDownload(item, processId);
        }
    }
}
```

#### Step 2b: Extract Drive download logic to helper function
```typescript
async function processDriveDownload(item: QueueItem, processId: string): Promise<void> {
    const pool = initializeWorkerPool();

    // Get access token
    let token = '';
    tokenManager.token.subscribe(value => { token = value; })();

    if (!token) {
        console.error('Download queue: No access token for Drive');
        handleDownloadError(item, processId, 'No access token available');
        return;
    }

    // Estimate memory requirement
    const fileSize = getCloudSize(item.volumeMetadata) || 0;
    const memoryRequirement = Math.max(fileSize * 3, 50 * 1024 * 1024);

    // Create worker metadata (still uses legacy Drive fields for worker)
    const workerMetadata: WorkerVolumeMetadata = {
        volumeUuid: item.volumeUuid,
        driveFileId: item.cloudFileId,  // Map cloudFileId to driveFileId for worker
        seriesTitle: item.seriesTitle,
        volumeTitle: item.volumeTitle,
        driveModifiedTime: getCloudModifiedTime(item.volumeMetadata),
        driveSize: getCloudSize(item.volumeMetadata)
    };

    // Create worker task
    const task: WorkerTask = {
        id: item.cloudFileId,
        memoryRequirement,
        metadata: workerMetadata,
        data: {
            fileId: item.cloudFileId,
            fileName: item.volumeTitle + '.cbz',
            accessToken: token,
            metadata: workerMetadata
        },
        onProgress: data => {
            const percent = Math.round((data.loaded / data.total) * 100);
            progressTrackerStore.updateProcess(processId, {
                progress: percent,
                status: `Downloading... ${percent}%`
            });
        },
        onComplete: async (data, releaseMemory) => {
            try {
                progressTrackerStore.updateProcess(processId, {
                    progress: 90,
                    status: 'Processing files...'
                });

                await processVolumeData(data.entries, item.volumeMetadata);

                progressTrackerStore.updateProcess(processId, {
                    progress: 100,
                    status: 'Download complete'
                });

                showSnackbar(`Downloaded ${item.volumeTitle} successfully`);
                queueStore.update(q => q.filter(i => i.volumeUuid !== item.volumeUuid));
                setTimeout(() => progressTrackerStore.removeProcess(processId), 3000);
            } catch (error) {
                console.error(`Failed to process ${item.volumeTitle}:`, error);
                handleDownloadError(item, processId, error instanceof Error ? error.message : 'Unknown error');
            } finally {
                releaseMemory();
                checkAndTerminatePool();
            }
        },
        onError: data => {
            console.error(`Error downloading ${item.volumeTitle}:`, data.error);
            handleDownloadError(item, processId, data.error);
            checkAndTerminatePool();
        }
    };

    pool.addTask(task);
}
```

#### Step 2c: Create non-Drive download function (MEGA/WebDAV)
```typescript
async function processNonDriveDownload(item: QueueItem, processId: string): Promise<void> {
    try {
        // Download CBZ blob via unified cloud manager
        const blob = await unifiedCloudManager.downloadVolumeCbz(
            item.cloudFileId,
            (loaded, total) => {
                const percent = Math.round((loaded / total) * 100);
                progressTrackerStore.updateProcess(processId, {
                    progress: percent * 0.9,  // Reserve 10% for processing
                    status: `Downloading... ${percent}%`
                });
            }
        );

        progressTrackerStore.updateProcess(processId, {
            progress: 90,
            status: 'Decompressing...'
        });

        // Decompress CBZ
        const entries = await decompressCbz(blob);

        progressTrackerStore.updateProcess(processId, {
            progress: 95,
            status: 'Processing files...'
        });

        // Process volume data
        await processVolumeData(entries, item.volumeMetadata);

        progressTrackerStore.updateProcess(processId, {
            progress: 100,
            status: 'Download complete'
        });

        showSnackbar(`Downloaded ${item.volumeTitle} successfully`);
        queueStore.update(q => q.filter(i => i.volumeUuid !== item.volumeUuid));
        setTimeout(() => progressTrackerStore.removeProcess(processId), 3000);

    } catch (error) {
        console.error(`Failed to download ${item.volumeTitle}:`, error);
        handleDownloadError(item, processId, error instanceof Error ? error.message : 'Unknown error');
    }
}
```

#### Step 2d: Create error handling helper
```typescript
function handleDownloadError(item: QueueItem, processId: string, errorMessage: string): void {
    progressTrackerStore.updateProcess(processId, {
        progress: 0,
        status: `Error: ${errorMessage}`
    });
    showSnackbar(`Failed to download ${item.volumeTitle}: ${errorMessage}`);
    queueStore.update(q => q.filter(i => i.volumeUuid !== item.volumeUuid));
    setTimeout(() => progressTrackerStore.removeProcess(processId), 3000);
}

function checkAndTerminatePool(): void {
    const currentQueue = get(queueStore);
    if (currentQueue.length === 0 && workerPool) {
        workerPool.terminate();
        workerPool = null;
        processingStarted = false;
    }
}
```

### Task 3: Update Description Logic (Provider-Aware)

**File**: `src/lib/util/download-queue.ts` (lines 289-319)

**Current Issue**: Only updates Drive file descriptions

**Solution**:
```typescript
// Update cloud file description if folder name doesn't match series title
const cloudFileId = getCloudFileId(placeholder);
const cloudProvider = getCloudProvider(placeholder);

if (cloudFileId && cloudProvider) {
    try {
        const folderName = placeholder.series_title;
        const actualSeriesTitle = mokuroData.title;

        if (folderName !== actualSeriesTitle && cloudProvider === 'google-drive') {
            // Only Drive supports description updates currently
            const fileMetadata = await driveApiClient.getFileMetadata(
                cloudFileId,
                'capabilities/canEdit,description'
            );
            const canEdit = fileMetadata.capabilities?.canEdit ?? false;
            const currentDescription = fileMetadata.description || '';

            if (canEdit) {
                const hasSeriesTag = /^series:\s*.+/im.test(currentDescription);

                if (!hasSeriesTag) {
                    const seriesTag = `Series: ${actualSeriesTitle}`;
                    const newDescription = currentDescription
                        ? `${seriesTag}\n${currentDescription}`
                        : seriesTag;

                    await driveApiClient.updateFileDescription(cloudFileId, newDescription);
                    driveFilesCache.updateFileDescription(cloudFileId, newDescription);

                    // Also update unified cloud manager cache
                    unifiedCloudManager.updateCacheEntry(cloudFileId, {
                        description: newDescription
                    });
                }
            }
        }
    } catch (error) {
        console.warn('Failed to update cloud file description:', error);
    }
}
```

### Task 4: Update MULTI-PROVIDER-MIGRATION.md

Mark Phase 3 download-queue task as complete:
```markdown
### Phase 3: Update Consumers
- [x] Update `placeholders.ts` - use unified manager ✅
- [x] Update `catalog/index.ts` - use unified manager ✅
- [x] Update `download-queue.ts` - route by cloudProvider ✅
- [ ] Update `backup.ts` - upload to all providers
```

## Testing Plan

### Unit Testing:
1. Test `decompressCbz()` with sample CBZ blobs
2. Test `getCloudFileId()` and `getCloudProvider()` helpers with both legacy and new formats

### Integration Testing:
1. **Drive download**: Queue and download a Drive-backed placeholder
2. **MEGA download**: Queue and download a MEGA-backed placeholder (when MEGA provider complete)
3. **Mixed queue**: Queue multiple volumes from different providers simultaneously
4. **Error handling**: Test network failures, corrupt files, missing permissions
5. **Progress tracking**: Verify progress updates work correctly for both paths

### Edge Cases:
1. Legacy volumes with only `driveFileId` (no `cloudProvider`)
2. Very large files (memory pressure)
3. Queue termination when last download completes
4. Worker pool reuse across multiple Drive downloads

## Estimated Complexity: HIGH

**Reasons**:
- Worker pool architecture tightly coupled to Drive API
- Hybrid approach requires careful orchestration
- Progress tracking must work consistently across both paths
- Error handling must be robust for all providers
- Type errors need careful resolution

**Estimated Lines Changed**: ~200 lines
