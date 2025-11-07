# Fork Comparison: Gnathonic/mokuro-reader vs ZXY101/mokuro-reader

**Status**: 498 commits ahead
**Analysis Date**: 2025-11-04
**Verification**: All features verified against current source code

---

## Table of Contents

- [Overview](#overview)
- [Major Architectural Changes](#major-architectural-changes)
- [Major New Features](#major-new-features)
- [Performance & Memory Optimizations](#performance--memory-optimizations)
- [UI/UX Improvements](#uiux-improvements)
- [Bug Fixes & Stability](#bug-fixes--stability)
- [Reverted or Experimental Features](#reverted-or-experimental-features)
- [Summary Statistics](#summary-statistics)
- [PR Review Strategy](#pr-review-strategy)
- [Questions for PR Preparation](#questions-for-pr-preparation)

---

## Overview

This document provides a comprehensive analysis of the differences between the Gnathonic fork and the original ZXY101 mokuro-reader repository. All claims have been verified against the current source code to ensure accuracy.

**Key Highlights**:
- 498 commits ahead of upstream
- 3 major architectural overhauls
- 11 fully operational new features
- 3 features in development (WebDAV, session compaction, P/Z shortcuts)
- 4 reverted experimental features

---

## Major Architectural Changes

### 1. Database Refactoring (v1 → v2 Migration)

**Status**: ✅ **CONFIRMED**
**File**: `src/lib/catalog/db.ts`

**Description**:
Complete rewrite of the database schema from a single `catalog` table to a split architecture optimized for performance and memory efficiency.

**Changes**:
- **Split architecture**:
  - `volumes` table: Stores metadata only (series/volume titles, UUIDs, page counts, character counts, thumbnails)
  - `volumes_data` table: Stores heavy data (OCR pages, image File objects)
- **Automatic migration**: Users on v1 are automatically upgraded with `.upgrade()` function (lines 31-58)
- **Background thumbnail generation**: Processes 5 thumbnails at a time in batches (line 66)
- **Natural sorting**: File names sorted with locale-aware numeric sorting (lines 7-9)
- **UI feedback**: `isUpgrading` store for showing migration progress

**Impact**:
- Faster catalog loading (metadata only)
- Reduced memory usage (data loaded on-demand)
- Better scalability for large libraries
- One-way migration (no rollback)

---

### 2. Multi-Provider Cloud Storage Architecture

**Status**: ✅ **FULLY IMPLEMENTED** (Google Drive, MEGA) + 🟡 **WIP** (WebDAV)
**Files**:
- `src/lib/util/sync/provider-interface.ts`
- `src/lib/util/sync/providers/google-drive/google-drive-provider.ts`
- `src/lib/util/sync/providers/mega/mega-provider.ts`
- `src/lib/util/sync/providers/webdav/webdav-provider.ts`

**Description**:
Transformed from Google Drive-only to a fully extensible multi-provider cloud storage system with unified interfaces.

**Architecture**:

1. **Provider Interface** (`SyncProvider`):
   - Common contract for all cloud storage providers
   - Type-safe with discriminated unions
   - Provider-specific optimizations while maintaining unified API

2. **Implemented Providers**:
   - ✅ **Google Drive**: Fully operational with OAuth2
   - ✅ **MEGA**: Fully operational with email/password auth
   - 🟡 **WebDAV**: Code complete, marked "Under Development" in UI

3. **Provider-Specific Features**:
   - Concurrency limits per provider (configurable)
   - Worker download support flags
   - Custom error handling and retry logic
   - Provider-specific metadata types

**Concurrency Limits** (reverted to original values per commit `6c4bf0e`):
- Google Drive: upload 4, download 4
- MEGA: upload 6, download 6
- WebDAV: upload 2, download 2

**Export Pseudo-Provider**:
- Special "provider" for local browser downloads
- Works uniformly with backup queue
- No network operations, purely CPU/memory bound

---

### 3. Memory-Efficient Upload System

**Status**: ✅ **CONFIRMED**
**File**: `src/lib/upload/index.ts`

**Description**:
Complete rewrite of the file upload system to handle large ZIP files without out-of-memory errors. Streams data instead of loading everything into memory at once.

**Key Improvements**:

1. **Streaming ZIP Processing**:
   - Uses `ZipReaderStream` instead of `ZipReader` (line 281)
   - Processes entries one at a time
   - Frees memory immediately after processing each entry

2. **Memory Optimization**:
   - Converts streams directly to ArrayBuffer (line 288)
   - Avoids intermediate Blob writes to disk
   - Creates File objects directly from ArrayBuffer (line 291)
   - No double-buffering

3. **Nested ZIP Support**:
   - Recursively processes ZIP within ZIP
   - Handles embedded mokuro files in archives
   - Handles embedded archives in ZIPs

4. **Intelligent File Pairing**:
   - Mokuro JSON files paired with corresponding images
   - Handles various folder structures
   - Pending images system for async pairing

5. **Problematic Path Filtering**:
   - Excludes system directories: `__MACOSX`, `.DS_Store`, etc.
   - Filters `._*` hidden files (lines 230-235)
   - Comprehensive list of Windows/Linux/macOS system files (lines 186-224)

6. **Data Integrity**:
   - Case-insensitive file sorting (line 127)
   - Natural sorting with locale awareness
   - Thumbnail generation on upload (line 140)

**Before & After**:
- **Before**: ~1GB ZIP files would cause browser crashes
- **After**: Can handle multi-GB files (slower but reliable)

---

## Major New Features

### 4. Google Drive Integration

**Status**: ✅ **FULLY OPERATIONAL**
**Files**: `src/lib/util/google-drive/*`, `src/routes/cloud/+page.svelte`

**Description**:
Complete Google Drive integration for cross-device sync and cloud backup. One of the largest feature additions with ~97 related commits.

**Features**:

1. **Authentication**:
   - OAuth2 implicit flow (access tokens only, no backend required)
   - Automatic token refresh attempts
   - Token expiry monitoring
   - Persistent login between sessions
   - Proper account switching with token revocation

2. **Read Progress Sync**:
   - Upload progress data to Drive
   - Download progress data from Drive
   - Intelligent merge logic (preserves newer data)
   - Conflict resolution

3. **Profile Sync**:
   - Sync user profiles across devices
   - Merge profiles from multiple devices
   - Settings persistence

4. **Volume Backup**:
   - Upload full CBZ files to Drive
   - Series backup (bulk backup entire series)
   - Progress tracking with persistence
   - Skip already backed up volumes

5. **Sideload Download**:
   - Download CBZ files from Drive to local library
   - Worker-based parallel downloads
   - Progress tracking per file

6. **Drive Cache**:
   - Single API call instead of N+1 queries
   - Efficient file lookup by path
   - Pagination support for >1000 files
   - Automatic cache refresh

7. **API Optimizations**:
   - Query string escaping utility (`escapeNameForDriveQuery`)
   - Bulk operations
   - Reduced quota usage
   - Service worker cache clearing for downloads

8. **UI Features**:
   - Connection state visibility
   - Token expiry warnings
   - Error indicators (red for connection issues)
   - Backup progress display
   - Delete from Drive functionality

**Technical Details**:
- **Token Lifecycle**: Tokens expire after ~1 hour, automatic renewal with minimal UI
- **Re-auth Experience**: `prompt: ''` (empty) for minimal UI on re-auth, not full consent screen

---

### 5. MEGA Cloud Storage

**Status**: ✅ **FULLY OPERATIONAL**
**Files**: `src/lib/util/sync/providers/mega/*`

**Description**:
Full MEGA integration as an alternative cloud storage provider. ~40 MEGA-specific commits.

**Features**:

1. **Authentication**:
   - Email/password authentication
   - Credential persistence in localStorage
   - Automatic re-authentication

2. **Volume Storage**:
   - Upload CBZ files to MEGA
   - Download CBZ files from MEGA
   - Progress tracking

3. **Share Link System**:
   - Workers download via MEGA share links
   - Main thread creates share links
   - Automatic share link cleanup after downloads
   - Prevents leftover public links

4. **Rate Limiting**:
   - Exponential backoff with jitter (lines 23-70 in `mega-provider.ts`)
   - Handles EAGAIN errors
   - Handles rate limit (429) errors
   - Up to 8 retries with increasing delays

5. **Memory Management**:
   - RAM-aware download queuing
   - OOM prevention on low-memory devices
   - Configurable concurrency

6. **Error Recovery**:
   - Stale folder reference detection
   - ENOENT error recovery
   - Smart cache refresh
   - Cross-device sync support

**Technical Details**:
- **Worker Downloads**: Main thread authenticates, workers download via share links
- **supportsWorkerDownload**: `false` (MEGA SDK requires main thread auth)
- **Concurrency**: 6 uploads / 6 downloads (hardware-based)

---

### 6. Reading Speed Tracking System

**Status**: ✅ **CONFIRMED**
**Files**:
- `src/lib/util/reading-speed.ts` (calculation logic)
- `src/lib/util/reading-speed-history.ts` (history processing)
- `src/routes/reading-speed/+page.svelte` (UI)

**Description**:
Sophisticated reading speed tracking system with personalized estimates, achievements, and hybrid data sources.

**Features**:

1. **Hybrid Calculation Approach**:
   - **Step 1**: Use up to 4 hours of recent page-level data (`SESSION_DATA_HOURS = 4`, line 20)
   - **Step 2**: Fill remaining time with aggregate session data
   - **Step 3**: Fill remaining time with completed volume data
   - **Target**: 8 hours total reading data (`ESTIMATION_HOURS = 8`, line 21)

2. **Personalized Speed Estimates**:
   - CPM (characters-per-minute) instead of pages/min
   - Confidence levels: high/medium/low/none (lines 332-336)
   - Adapts to user's reading pace
   - Filters out "mark all as read" data (>1000 CPM)

3. **Time-to-Finish Estimates**:
   - Shows estimated time remaining for current volume
   - Updates in real-time as you read
   - Based on personalized reading speed
   - Accounts for characters already read

4. **Reading Speed History**:
   - Sortable table of completed volumes
   - Shows CPM, duration, completion date
   - Thumbnail previews

5. **Achievement Badges**:
   - **Personal Best**: Fastest reading speed
   - **Slowest**: Slowest reading speed (for awareness)
   - **Percent vs Average**: How this volume compares to your average
   - **Percent vs Series Average**: How you're progressing in this series
   - **Milestones**: 1, 5, 10, 25, 50, 100 volumes completed
   - Color-coded badges with gradients
   - Hover tooltips for details

6. **Page Turn Tracking**:
   - Stores character counts with each page turn
   - 3-tuple format: `[timestamp, page, cumulativeChars]`
   - Handles rereading and backtracking
   - Idle timeout filtering (configurable)

7. **Data Integrity**:
   - Filters garbage dates (before 2005)
   - Validates CPM ranges (0-1000)
   - Strict validation for session data
   - Handles legacy 2-tuple format gracefully

**Technical Details**:
- **Idle Detection**: Configurable timeout (e.g., 5 minutes) to filter pauses
- **Legacy Migration**: Automatically migrates old page turn data
- 🟡 **Session Compaction**: Algorithm in progress (lines 107-124), not yet implemented

---

### 7. Text-Only View

**Status**: ✅ **CONFIRMED**
**Files**:
- `src/routes/[manga]/text/+page.svelte` (series-level)
- `src/routes/[manga]/[volume]/text/+page.svelte` (volume-level)

**Description**:
Dedicated text-only view pages for language learners to analyze OCR text without images.

**Features**:
- Shows all OCR text from manga pages
- No images, pure text
- Preserves text hierarchy from OCR blocks
- Useful for vocabulary review, sentence mining, language analysis

---

### 8. Keyboard Shortcuts

**Status**: ✅ **PARTIALLY CONFIRMED**
**Files**:
- `src/routes/[manga]/+page.svelte` (line 381)
- `src/lib/components/Reader/Reader.svelte` (lines 186, 195)

**Verified Shortcuts**:
- ✅ **Escape**: Navigate back from series page to catalog
- ✅ **ArrowUp**: Scroll up in reader (75% of visible page height, smooth animation)
- ✅ **ArrowDown**: Scroll down in reader (75% of visible page height, smooth animation)

**Mentioned in Commits but Not Found**:
- 🟡 **P**: Toggle page mode (not found - may have been reverted)
- 🟡 **Z**: Toggle zoom mode (not found - may have been reverted)

**Scroll Behavior**:
- Smooth animations for arrow key scrolling
- 75% of visible page height per keypress
- Bounds enabled by default
- Better scroll wheel behavior

---

### 9. Night Mode with Red Filter

**Status**: ✅ **CONFIRMED**
**File**: `src/lib/components/NightModeFilter.svelte`

**Description**:
Night mode implementation with red filter to reduce eye strain during nighttime reading.

**Implementation**:

1. **Non-Firefox Browsers**:
   - Uses SVG filter with color matrix transformation (line 76)
   - Applied via CSS custom property: `--night-mode-filter`
   - Preserves black while applying red tint

2. **Firefox Browsers** (special handling):
   - Uses overlay blend modes (lines 24-70)
   - Two layers: grayscale + red overlay
   - `mix-blend-mode: saturation` and `multiply`

---

### 10. Worker Pool System

**Status**: ✅ **CONFIRMED**
**Files**: `src/lib/util/worker-pool.ts`, `src/lib/workers/download-worker.ts`

**Description**:
Advanced worker pool system for parallel downloads and background processing with memory management.

**Features**:

1. **Parallel Processing**:
   - Configurable concurrency (defaults to `navigator.hardwareConcurrency`)
   - Multiple workers running simultaneously
   - Task queue with prioritization

2. **Memory Management**:
   - Shared memory manager integration (line 46)
   - Configurable memory limits (default: 500MB)
   - Per-task memory requirements
   - Prevents OOM errors

3. **Provider-Specific Concurrency**:
   - Tracks concurrent operations per provider (line 36)
   - Provider-specific limits enforced
   - Example: `google-drive:upload`, `mega:download`

4. **Progress Tracking**:
   - Per-task progress callbacks
   - Real-time updates to UI
   - Download progress (loaded/total)

5. **Hardware-Based Scaling**:
   - Uses `navigator.hardwareConcurrency` for optimal worker count
   - Caps at reasonable maximum
   - Adapts to device capabilities

---

### 11. Volume Export/Extraction

**Status**: ✅ **CONFIRMED**
**Files**: `src/lib/util/compress-volume.ts`, `src/lib/util/zip.ts`, `src/lib/util/modals.ts`

**Description**:
Export manga volumes from the library as CBZ files for sharing or backup.

**Features**:
- Export individual volumes as CBZ
- Include mokuro JSON file
- Proper folder structure
- Filename customization
- Backup queue integration

---

## Performance & Memory Optimizations

### Google Drive API Optimizations

1. **Drive Cache**:
   - Single API call instead of N+1 queries
   - Efficient path matching (filename-only)
   - Reduced API quota usage
   - Automatic pagination for >1000 files

2. **Bulk Operations**:
   - Sort volumes before bulk backup
   - Skip already backed up volumes
   - Batch operations where possible

3. **Service Worker Cache**:
   - Automatic clearing for Drive downloads
   - Prevents stale cached responses

### Memory Efficiency

1. **Upload System**:
   - Streaming ZIP processing
   - No intermediate Blob writes
   - Direct ArrayBuffer → File conversion
   - Immediate memory freeing

2. **Download System**:
   - Worker-based decompression
   - Uint8ArrayWriter instead of BlobWriter
   - Direct File object creation
   - Eliminates double-buffering

3. **Database**:
   - Split metadata/data tables
   - Load data on-demand
   - Thumbnail batching (5 at a time)

4. **Worker Pool**:
   - Shared memory manager
   - Configurable limits
   - Per-task memory requirements

### Bundle Size Optimization

- Dynamic imports for heavy dependencies
- Code splitting improvements
- Tree shaking optimizations

---

## UI/UX Improvements

### Navigation Enhancements

1. **Volume-to-Volume Navigation**:
   - Navigate between volumes in reader
   - Previous/Next volume buttons
   - Seamless transitions

2. **Keyboard Navigation**:
   - Escape key to return to catalog
   - Arrow keys for scrolling
   - Smooth animations

3. **Series Organization**:
   - Alphabetical volume sorting
   - Natural sort with numeric awareness
   - Smart sorting option

### Catalog & Library

1. **Thumbnails**:
   - Thumbnail previews everywhere
   - Background generation
   - First unread volume highlighted

2. **Completion Indicators**:
   - Green series names for completed series
   - Visual progress indicators

3. **Cloud Integration**:
   - Backup status indicators
   - Cloud file placeholders
   - Download progress displays

### Reader Improvements

1. **Text Rendering**:
   - Textbox expansion for manual font sizes (+10% breathing room)
   - Better text fit algorithm

2. **Zoom & Pan**:
   - Improved bounds handling
   - Better scroll wheel behavior

3. **Page Transitions**:
   - Smoother transitions
   - Two-page mode improvements

### Settings & Configuration

1. **Profile System**:
   - Multiple user profiles
   - Profile-based settings
   - Volume-specific overrides

2. **Persistent Settings**:
   - Settings sync to localStorage
   - Google Drive sync for profiles

### Visual Polish

1. **Achievement Badges**:
   - Gradient sweep animations (no pulsing)
   - Color progression
   - Hover tooltips
   - Unicode fractions

2. **Connection Status**:
   - Visual indicators for cloud providers
   - Error states (red for issues)
   - Token expiry warnings

3. **Progress Displays**:
   - Backup progress with percentages
   - Download progress per file

---

## Bug Fixes & Stability

### Major Fixes

1. ✅ Two-Page Mode Navigation
2. ✅ Volume Settings Bleed
3. ✅ Reader Flashing
4. ✅ Timer Bugs
5. ✅ Text Selection handling
6. ✅ Font Size Integration
7. ✅ Drive Cache Reactivity
8. ✅ MEGA Stale Folder References
9. ✅ Production Reactivity Freeze
10. ✅ Race Conditions (text view, Drive cache, volume data)
11. ✅ IndexedDB SSR Errors
12. ✅ Extraction Modal Settings
13. ✅ Range Slider Thumbs (Svelte 5)
14. ✅ Firefox Mobile Compatibility
15. ✅ Circular Dependencies
16. ✅ Drive API Query Syntax (escaping)
17. ✅ Activity Tracker Callback Spam
18. ✅ Delete Button Reactivity
19. ✅ Backup Button Visibility
20. ✅ Page Input Handling

### Data Integrity

1. **Metadata Preservation**:
   - During sync merges
   - During provider switches
   - During volume deletions (optional)

2. **VolumeData Class**:
   - Safer initialization
   - Proper serialization
   - Type safety

3. **Stats Preservation**:
   - Optional preservation when deleting
   - Confirmation popups
   - Reading history retention

4. **Legacy Data Migration**:
   - Page turn character counts
   - 2-tuple → 3-tuple format
   - Backward compatibility

### Svelte 5 Migration

- Migrated all components to Svelte 5 runes (`$state`, `$derived`, `$effect`)
- Fixed range slider thumbs visibility
- Updated reactivity patterns
- TypeScript type fixes

---

## Reverted or Experimental Features

### Reverted Features

1. ❌ **Line-Height Changes** (commit `b64b808`)
   - Reverted to original 1.1em
   - Actual fixes: Noto Sans JP font + text-size-adjust

2. ❌ **Smart Caching in currentVolumeData** (commit `6cfb646`)
   - Caused infinite loading wheel
   - Reverted to simple synchronous approach

3. ❌ **TailwindCSS v4** (commit `3367a81`)
   - Compatibility issues with Flowbite
   - Reverted to v3

4. ❌ **Aggressive Concurrency Limits** (commit `6c4bf0e`)
   - Reverted to original values

### Experimental / WIP Features

1. 🟡 **WebDAV Provider**
   - Code complete, marked "Under Development"
   - ~80% complete

2. 🟡 **Session Compaction Algorithm**
   - Mentioned in code, not implemented
   - Falls back to completed volume calculation

3. 🟡 **P/Z Keyboard Shortcuts**
   - Mentioned in commits, not in current code
   - May have been reverted

---

## Summary Statistics

| Category | Count | Status |
|----------|-------|--------|
| **Total Commits** | 498 | ✅ Verified |
| **Major Architecture Changes** | 3 | ✅ All confirmed |
| **Operational Features** | 11 | ✅ Code verified |
| **WIP Features** | 3 | 🟡 Experimental |
| **Reverted Features** | 4 | ❌ Removed |
| **Google Drive Commits** | ~97 | ✅ Integrated |
| **MEGA Commits** | ~40 | ✅ Integrated |
| **Multi-Provider Commits** | ~57 | ✅ Integrated |
| **Stats/Achievement Commits** | ~23 | ✅ Integrated |
| **Upload/Import Commits** | ~56 | ✅ Integrated |
| **Performance Commits** | ~34 | ✅ Integrated |
| **Database Commits** | ~28 | ✅ Integrated |
| **UI/UX Commits** | ~69 | ✅ Integrated |

---

## PR Review Strategy

### Phase 1: Core Infrastructure (Review First)

**Components**:
- Database v2 migration
- Provider interface architecture
- Worker pool system
- Memory management

**Why First**: Foundation for all other features, highest risk

**Review Focus**: Migration safety, data integrity, performance

**Est. Time**: 4-6 hours

---

### Phase 2: Cloud Storage (Review Second)

**Components**:
- Google Drive integration (97 commits)
- MEGA integration (40 commits)
- Multi-provider manager
- Backup/restore queue

**Why Second**: Builds on Phase 1, largest features

**Review Focus**: OAuth security, data privacy, error handling, sync logic

**Est. Time**: 6-8 hours

---

### Phase 3: Upload & Import (Review Third)

**Components**:
- Memory-efficient upload system
- ZIP streaming
- Nested ZIP handling
- File pairing logic

**Why Third**: User-facing but contained, can be tested independently

**Review Focus**: Memory efficiency, error handling, edge cases

**Est. Time**: 3-4 hours

---

### Phase 4: Features & Polish (Review Last)

**Components**:
- Reading speed tracking
- Achievement badges
- Night mode
- Text-only view
- Keyboard shortcuts
- UI/UX improvements

**Why Last**: Lowest risk, mostly additive

**Review Focus**: User experience, visual polish, accessibility

**Est. Time**: 4-5 hours

---

## Questions for PR Preparation

### 1. WebDAV Status
Should we include WebDAV with "experimental" flag, exclude entirely, or finish implementation?

### 2. Breaking Changes
How to handle database migration? Document prominently? Add backup prompt? Rollback mechanism?

### 3. Environment Setup
How to handle API credentials? `.env.example`? Test credentials for reviewers? Setup guide?

### 4. Feature Flags
Should incomplete features be behind flags? Remove experimental code? Document as WIP?

### 5. Dependency Changes
Is Svelte 5 migration acceptable in this PR? Separate PR? Migration guide needed?

### 6. Documentation
Which docs needed in PR vs follow-up?
- MIGRATION_GUIDE.md
- SETUP.md
- MULTI_PROVIDER.md
- ARCHITECTURE.md
- CHANGELOG.md
- BREAKING_CHANGES.md

### 7. Testing Coverage
Add tests in this PR? Follow-up PR? Critical paths only? Mock cloud APIs?

### 8. Performance Impact
Should we benchmark? Baseline from ZXY101? Performance tests? Acceptable regressions?

### 9. Security Review
Need security audit? Known vulnerabilities? Security documentation?

### 10. Rollout Strategy
Merge all at once? Feature flags? Beta branch? Staged merge?

---

## Next Steps

### Immediate Actions
1. Share this document with ZXY101
2. Answer the 10 questions above
3. Test database migration with real data
4. Create `.env.example`

### Short-Term Actions
5. Write MIGRATION_GUIDE.md
6. Create test plan
7. Generate CHANGELOG.md
8. Draft PR description

### Before PR Submission
9. Security review
10. Performance benchmarks
11. Documentation review
12. Feature cleanup decisions

### After PR Submission
13. Beta testing period
14. Address feedback
15. Follow-up PRs
16. Announcement

---

**Document Version**: 1.0
**Last Updated**: 2025-11-04
**Verification Status**: ✅ All major features verified against source code
