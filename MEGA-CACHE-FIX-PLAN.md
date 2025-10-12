# MEGA Cache & UI Integration Fix Plan

## 🔍 **ROOT CAUSE ANALYSIS**

After deep analysis, all 5 reported issues stem from **2 core problems**:

### **Problem 1: Cache Not Fetched After Login** ❌ CRITICAL
**File**: `src/routes/cloud/+page.svelte` (line 754-766)

**Current Flow**:
```typescript
async function handleMegaLogin() {
    await megaProvider.login({ email: megaEmail, password: megaPassword });
    showSnackbar('Connected to MEGA');
    providerManager.updateStatus();  // ❌ Doesn't fetch cloud files!
}
```

**What's missing**: After successful MEGA login, `unifiedCloudManager.fetchAllCloudVolumes()` is **NEVER called**. This means:
- Cache remains empty (`cloudFilesStore` = `[]`)
- `listCloudVolumes()` is never invoked on MEGA provider
- UI has no data to display
- Backup buttons don't know what's already uploaded
- Multiple folder creation occurs because cache check fails

**Compare with Drive** (working flow):
- Drive auth triggers automatic cache fetch via `driveState` subscriptions
- MEGA has no equivalent trigger

---

### **Problem 2: Cloud Page Doesn't Subscribe to Cache** ❌ CRITICAL
**File**: `src/routes/cloud/+page.svelte`

**Current state**: Cloud page shows "Backup all series" button (line 1103-1119) BUT:
- No subscription to `unifiedCloudManager.cloudFiles` store
- No UI to **display** what's in cloud
- No way to see uploaded volumes
- Button calls `backupAllSeries()` which DOES fetch cache (line 917) but **after** the backup completes, not before/during UI render

**What's missing**: UI components to show cloud files from all providers

---

## 🎯 **COMPREHENSIVE FIX PLAN**

### **Task 1: Fetch Cache After MEGA/WebDAV Login** ⭐ HIGHEST PRIORITY

**File**: `src/routes/cloud/+page.svelte` (lines 754-798)

**Changes**:
```typescript
// MEGA handlers
async function handleMegaLogin() {
    megaLoading = true;
    try {
        await megaProvider.login({ email: megaEmail, password: megaPassword });
        showSnackbar('Connected to MEGA');
        providerManager.updateStatus();

        // ✅ NEW: Fetch cloud volumes immediately after login
        await unifiedCloudManager.fetchAllCloudVolumes();
        showSnackbar('MEGA connected - loading cloud files...');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        showSnackbar(message);
    } finally {
        megaLoading = false;
    }
}

async function handleWebDAVLogin() {
    webdavLoading = true;
    try {
        await webdavProvider.login({
            serverUrl: webdavUrl,
            username: webdavUsername,
            password: webdavPassword
        });
        showSnackbar('Connected to WebDAV');
        providerManager.updateStatus();

        // ✅ NEW: Fetch cloud volumes immediately after login
        await unifiedCloudManager.fetchAllCloudVolumes();
        showSnackbar('WebDAV connected - loading cloud files...');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        showSnackbar(message);
    } finally {
        webdavLoading = false;
    }
}
```

**Why this fixes**:
- ✅ Cache populated after login → Backup buttons know what exists
- ✅ `listCloudVolumes()` called → Folder detection works
- ✅ Multiple folder creation prevented → Cache knows folder exists
- ✅ Upload status accurate → UI reflects reality

**Complexity**: LOW
**Impact**: CRITICAL (fixes 4 out of 5 issues)

---

### **Task 2: Subscribe to Cloud Files Store in Cloud Page** ⭐ HIGH PRIORITY

**File**: `src/routes/cloud/+page.svelte`

**Add reactive store subscription** (around line 70):
```typescript
// Subscribe to cloud files from unified manager
let cloudFiles = $state<CloudVolumeWithProvider[]>([]);
let isFetchingCloud = $state(false);

$effect(() => {
    const unsubscribers = [
        // ...existing subscriptions...
        unifiedCloudManager.cloudFiles.subscribe(value => { cloudFiles = value; }),
        unifiedCloudManager.isFetching.subscribe(value => { isFetchingCloud = value; })
    ];
    return () => unsubscribers.forEach(unsub => unsub());
});
```

**Add UI to display cloud files** (for ALL providers, not just Drive):
```svelte
<!-- Add after line 1119 (after "Backup all series" button) -->
{#if cloudFiles && cloudFiles.length > 0}
    <div class="mt-8 p-4 bg-gray-800 rounded-lg">
        <h3 class="font-semibold mb-3">Cloud Storage ({cloudFiles.length} files)</h3>

        <div class="text-sm space-y-2 max-h-64 overflow-y-auto">
            {#each cloudFiles as file}
                <div class="flex justify-between items-center p-2 bg-gray-700 rounded">
                    <div>
                        <div class="font-medium">{file.path}</div>
                        <div class="text-xs text-gray-400">
                            {(file.size / (1024 * 1024)).toFixed(1)} MB • {file.provider}
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </div>
{:else if isFetchingCloud}
    <div class="mt-4 text-center text-gray-400">
        Loading cloud files...
    </div>
{/if}
```

**Why this fixes**:
- ✅ Uploaded volumes visible in UI
- ✅ User can verify backup status
- ✅ Multi-provider transparency

**Complexity**: MEDIUM
**Impact**: HIGH (UX improvement, fixes issue #5)

---

### **Task 3: Show "Backup All Series" for ALL Providers** ⭐ MEDIUM PRIORITY

**File**: `src/routes/cloud/+page.svelte` (lines 1139-1202)

**Current Issue**: Backup UI only shows for Google Drive (line 1103-1119), not for MEGA/WebDAV.

**Move backup section outside Drive-specific block**:
```svelte
{:else}
    <!-- Connected Provider Interface -->

    <!-- Backup UI (shown for ALL authenticated providers) -->
    {#if hasAnyProvider}
        <div class="w-full max-w-3xl mb-8">
            <div class="flex flex-col gap-4">
                <Button
                    color="purple"
                    on:click={() => promptConfirmation('Backup all series to cloud storage?', backupAllSeries)}
                >
                    Backup all series to cloud
                </Button>

                <!-- Show cloud files list here (from Task 2) -->
                {#if cloudFiles && cloudFiles.length > 0}
                    <!-- ... cloud files UI ... -->
                {/if}
            </div>
        </div>
    {/if}

    <!-- Provider-specific sections below -->
    {#if accessToken}
        <!-- Google Drive specific UI -->
    {:else if megaProvider.isAuthenticated()}
        <!-- MEGA specific UI -->
    {:else if webdavProvider.isAuthenticated()}
        <!-- WebDAV specific UI -->
    {/if}
{/if}
```

**Why this fixes**:
- ✅ Upload series button visible for MEGA
- ✅ Consistent UX across providers
- ✅ Fixes issue #2

**Complexity**: LOW
**Impact**: HIGH (critical UX feature)

---

### **Task 4: Auto-Fetch Cache on Mount (Defensive Programming)** ⭐ LOW PRIORITY

**File**: `src/routes/cloud/+page.svelte`

**Add to existing `onMount`** (around line 702):
```typescript
onMount(async () => {
    // Clear service worker cache for Google Drive downloads
    clearServiceWorkerCache();

    // ✅ NEW: Fetch cloud files if any provider is authenticated
    if (hasAnyProvider) {
        await unifiedCloudManager.fetchAllCloudVolumes();
    }
});
```

**Why this helps**:
- ✅ Handles page refresh scenarios
- ✅ Populates cache even if login happened in previous session
- ✅ Defensive against missing fetch triggers

**Complexity**: TRIVIAL
**Impact**: MEDIUM (reliability)

---

### **Task 5: Update BackupButton After Upload** ⭐ LOW PRIORITY

**File**: `src/lib/components/BackupButton.svelte` (line 70)

**Current Issue**: After upload completes (line 71), cache is updated BUT the component might not re-check `isBackedUp` immediately.

**Ensure re-check**:
```typescript
async function handleBackup(e: MouseEvent) {
    // ...existing code...

    try {
        await backupVolumeToCloud(volume, provider, (step) => {
            currentStep = step;
        });
        showSnackbar('Backup completed successfully', 'success');

        // ✅ Refresh cloud files to show the new backup
        await unifiedCloudManager.fetchAllCloudVolumes();
    } catch (error) {
        // ...error handling...
    } finally {
        isBackingUp = false;
        currentStep = '';
    }
}
```

**Why this helps**:
- ✅ Immediate UI feedback after upload
- ✅ Button state changes from "Backup" → "Delete from [provider]"

**Complexity**: TRIVIAL
**Impact**: LOW (UX polish)

---

## 📊 **SUMMARY TABLE**

| Task | Priority | Complexity | Impact | Fixes Issues |
|------|----------|------------|--------|--------------|
| **1. Fetch cache after login** | ⭐⭐⭐ CRITICAL | LOW | CRITICAL | #1, #3, #4 |
| **2. Subscribe to cache in UI** | ⭐⭐ HIGH | MEDIUM | HIGH | #5 |
| **3. Show backup for all providers** | ⭐⭐ HIGH | LOW | HIGH | #2 |
| **4. Auto-fetch on mount** | ⭐ LOW | TRIVIAL | MEDIUM | Defensive |
| **5. Update after upload** | ⭐ LOW | TRIVIAL | LOW | Polish |

---

## 🔧 **IMPLEMENTATION ORDER**

### **Phase 1: Critical Fixes** (Do First)
1. **Task 1**: Add `fetchAllCloudVolumes()` after login → **Fixes 3/5 issues**
2. **Task 3**: Move backup UI to all providers → **Fixes issue #2**

**Test**: Login to MEGA → Should see files populate + backup button

### **Phase 2: UX Improvements** (Do Second)
3. **Task 2**: Add cloud files display UI → **Shows uploaded files**
4. **Task 4**: Auto-fetch on mount → **Handles refresh**

**Test**: Backup a volume → Should appear in UI immediately

### **Phase 3: Polish** (Optional)
5. **Task 5**: Force refresh after upload → **Immediate feedback**

---

## 🧪 **TESTING CHECKLIST**

After implementing Phase 1:
- [ ] Login to MEGA → Console shows "✅ Listed X CBZ files from MEGA"
- [ ] Login to MEGA → "Backup all series" button appears
- [ ] Upload a volume → No duplicate mokuro folders created
- [ ] Refresh page → Cloud files still visible
- [ ] Upload second volume → Folder reused correctly

After implementing Phase 2:
- [ ] Login to MEGA → Cloud files list appears
- [ ] Upload a volume → Appears in list immediately
- [ ] BackupButton shows "Delete from MEGA" after upload

---

## 📝 **ESTIMATED EFFORT**

- **Phase 1**: 15 minutes (2 simple changes)
- **Phase 2**: 30 minutes (UI component + subscriptions)
- **Phase 3**: 5 minutes (one-liner change)
- **Total**: ~50 minutes

---

## 💡 **KEY INSIGHTS**

The MEGA provider code is **actually correct**. All methods work:
- `listCloudVolumes()` ✅ Works
- `uploadVolumeCbz()` ✅ Works
- `ensureMokuroFolder()` ✅ Works

The issue is **purely integration-level**:
- Code exists but is never called at the right time
- UI exists but doesn't subscribe to the right stores
- Features work in isolation but aren't wired together

This is a **classic integration bug**, not a provider bug.
