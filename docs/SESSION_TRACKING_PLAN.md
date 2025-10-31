# Session-Based Reading Analytics - Implementation Plan

**Status:** Planning Phase
**Created:** 2025-01-30
**Priority:** High (enables accurate reading speed tracking and stats page)

## Executive Summary

Implement session-based reading tracking to enable:
- Accurate reading speed calculation (chars/minute)
- Time-to-finish estimates (personalized)
- Historical performance tracking
- Reread detection
- Future stats/analytics page

## Core Problems Solved

Current limitations:
- ❌ No session boundaries → can't separate struggling early attempts from later mastery
- ❌ Rereading pollutes metrics → time keeps accumulating
- ❌ Too coarse (minutes only) → can't filter "marked as read" vs actually read
- ❌ No historical view → can't show improvement over time

What we need:
- ✅ Session-level granularity with automatic boundaries
- ✅ Page-read timestamps while session is active
- ✅ Automatic compaction when session ends
- ✅ Separate reread sessions from first reads
- ✅ Accurate chars-per-minute calculation
- ✅ Time-to-finish estimates
- ✅ Historical trend data for stats page

---

## Data Structure

### Page-Level Event (Active Session Only)

```typescript
type PageReadEvent = {
  page: number;
  timestamp: number;        // Unix timestamp (4 bytes vs 24 for ISO string)
  durationSeconds: number;  // Time spent on this page
  charCount: number;        // Characters on this page (for CPM calc)
};
```

### Session Summary (Compacted Historical Data)

```typescript
type SessionSummary = {
  pagesRead: number;
  charsRead: number;
  totalSeconds: number;
  avgSecondsPerPage: number;
  charsPerMinute: number;   // Pre-calculated for quick access
  pageRange: [number, number]; // [first, last]
  completedVolume: boolean;
};
```

### Reading Session

```typescript
type ReadingSession = {
  id: string;               // UUID for uniqueness
  volumeId: string;         // Which volume this session is for
  startTime: number;        // Unix timestamp
  endTime?: number;         // Undefined if active, set when ended
  sessionNumber: number;    // 1st read, 2nd read, etc. (for reread detection)

  // Detailed events (only kept while active)
  events: PageReadEvent[];

  // Compacted summary (filled when session ends, events deleted)
  summary?: SessionSummary;
};
```

### Enhanced Volume Data

```typescript
type VolumeData = {
  // === BACKWARD COMPATIBLE: Keep existing fields ===
  progress: number;              // Current page
  chars: number;                 // Total chars read
  completed: boolean;            // Ever completed?
  timeReadInMinutes: number;     // Aggregate time (for compatibility)
  lastProgressUpdate: string;    // ISO timestamp
  settings: VolumeSettings;

  // === NEW: Session-based tracking ===
  activeSession?: ReadingSession;     // Current session (with detailed events)
  sessions: ReadingSession[];         // Historical sessions (compacted summaries)
  totalSessions: number;              // Counter for sessionNumber
};
```

### Storage Impact

- **Active session:** 200 pages × 24 bytes = ~4.8 KB (temporary)
- **Historical session:** 100 bytes (summary only, events removed)
- **10 historical sessions:** 1 KB
- **100 historical sessions:** 10 KB
- **Total per volume:** 1.5-10.5 KB
- **For 100 volumes:** 150 KB - 1 MB ✅ Very reasonable!

---

## Session Lifecycle

### 1. Session Start (Automatic Detection)

**New session starts when:**
- No `activeSession` exists
- Last activity was > 30 minutes ago (configurable)
- User navigates to volume from catalog (intentional start)
- User explicitly clicks "Start new reading session" (optional)

```typescript
function startNewSession(volumeId: string, initialPage: number) {
  const session: ReadingSession = {
    id: generateUUID(),
    volumeId,
    startTime: Date.now(),
    sessionNumber: volumes[volumeId].totalSessions + 1,
    events: [{
      page: initialPage,
      timestamp: Date.now(),
      durationSeconds: 0,
      charCount: getCharCountForPage(volumeId, initialPage)
    }]
  };

  volumes[volumeId].activeSession = session;
  volumes[volumeId].totalSessions++;
}
```

### 2. During Session (Event Tracking)

**On every page turn:**

```typescript
function onPageChange(volumeId: string, newPage: number, oldPage: number) {
  const session = volumes[volumeId].activeSession;
  if (!session) {
    startNewSession(volumeId, newPage);
    return;
  }

  const now = Date.now();
  const lastEvent = session.events[session.events.length - 1];
  const durationSeconds = (now - lastEvent.timestamp) / 1000;

  // Update last event's duration
  lastEvent.durationSeconds = durationSeconds;

  // Add new event
  session.events.push({
    page: newPage,
    timestamp: now,
    durationSeconds: 0,
    charCount: getCharCountForPage(volumeId, newPage)
  });

  // Update legacy fields for backward compat
  volumes[volumeId].progress = newPage;
  volumes[volumeId].lastProgressUpdate = new Date().toISOString();
}
```

### 3. Session End (Compaction)

**Session ends when:**
- Inactivity timeout (30+ min)
- User navigates away from volume
- User closes tab (beforeunload, best effort)
- User completes volume
- Manual trigger

```typescript
function endSession(volumeId: string) {
  const session = volumes[volumeId].activeSession;
  if (!session) return;

  session.endTime = Date.now();

  // Calculate summary stats
  const totalSeconds = session.events.reduce((sum, e) => sum + e.durationSeconds, 0);
  const totalChars = session.events.reduce((sum, e) => sum + e.charCount, 0);
  const pages = new Set(session.events.map(e => e.page)).size;

  session.summary = {
    pagesRead: pages,
    charsRead: totalChars,
    totalSeconds,
    avgSecondsPerPage: totalSeconds / pages,
    charsPerMinute: (totalChars / totalSeconds) * 60,
    pageRange: [
      Math.min(...session.events.map(e => e.page)),
      Math.max(...session.events.map(e => e.page))
    ],
    completedVolume: session.events.some(e => e.page === getLastPage(volumeId))
  };

  // COMPACTION: Remove detailed events
  delete session.events;

  // Move to historical sessions
  volumes[volumeId].sessions.push(session);
  delete volumes[volumeId].activeSession;

  // Update legacy aggregate fields
  volumes[volumeId].timeReadInMinutes += Math.ceil(totalSeconds / 60);
  volumes[volumeId].chars += totalChars;
}
```

---

## Reading Speed Calculation

### Smart Session Filtering Algorithm

```typescript
interface ReadingSpeedResult {
  charsPerMinute: number;
  isPersonalized: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  sessionsUsed: number;
  recentSessions?: SessionSummary[];
}

function calculateReadingSpeed(volumes: Volumes): ReadingSpeedResult {
  // Gather all historical sessions across all volumes
  const allSessions = Object.values(volumes)
    .flatMap(v => v.sessions)
    .filter(s => s.summary);

  // Filter out invalid sessions
  const validSessions = allSessions.filter(s => {
    const summary = s.summary!;

    // Must have read enough to be meaningful
    if (summary.pagesRead < 10) return false;

    // Must be reasonable speed (not "mark all as read")
    if (summary.avgSecondsPerPage < 5) return false;  // < 5 sec/page is suspicious

    // Must have actual reading time
    if (summary.totalSeconds < 60) return false;  // At least 1 minute

    // Reasonable CPM range (100-2000)
    if (summary.charsPerMinute < 100 || summary.charsPerMinute > 2000) return false;

    return true;
  });

  if (validSessions.length === 0) {
    return {
      charsPerMinute: 500, // Default
      isPersonalized: false,
      confidence: 'none',
      sessionsUsed: 0
    };
  }

  // Sort by end time (most recent first)
  validSessions.sort((a, b) => b.endTime! - a.endTime!);

  // Take last 5 sessions for averaging
  const recentSessions = validSessions.slice(0, 5);

  // Calculate weighted average (more recent = higher weight)
  let totalWeightedCPM = 0;
  let totalWeight = 0;

  recentSessions.forEach((session, index) => {
    const weight = 1 / (index + 1); // 1.0, 0.5, 0.33, 0.25, 0.2
    totalWeightedCPM += session.summary!.charsPerMinute * weight;
    totalWeight += weight;
  });

  const avgCPM = Math.round(totalWeightedCPM / totalWeight);

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' | 'none';
  if (recentSessions.length >= 5) confidence = 'high';
  else if (recentSessions.length >= 3) confidence = 'medium';
  else if (recentSessions.length >= 1) confidence = 'low';
  else confidence = 'none';

  return {
    charsPerMinute: avgCPM,
    isPersonalized: true,
    confidence,
    sessionsUsed: recentSessions.length,
    recentSessions: recentSessions.map(s => s.summary!)
  };
}
```

---

## Time-to-Finish Display

### In Reader (next to timer)

```svelte
<script>
  let readingSpeed = $derived(calculateReadingSpeed($volumes));
  let remainingChars = $derived(volumeData.totalChars - $volumes[volumeId].chars);
  let estimatedMinutes = $derived(
    Math.ceil(remainingChars / readingSpeed.charsPerMinute)
  );

  let displayText = $derived(() => {
    if (estimatedMinutes < 60) {
      return `~${estimatedMinutes} min left`;
    } else {
      const hours = Math.floor(estimatedMinutes / 60);
      const mins = estimatedMinutes % 60;
      return `~${hours}h ${mins}m left`;
    }
  });
</script>

<div class="timer-display">
  <p>Minutes read: {$volumeStats.timeReadInMinutes}</p>
  {#if readingSpeed.isPersonalized}
    <p class="estimate personalized" title="Based on your reading speed">
      {displayText} ⭐
    </p>
  {:else}
    <p class="estimate">{displayText}</p>
  {/if}
</div>
```

### On Series Page

```svelte
<script>
  let seriesEstimate = $derived(() => {
    const readingSpeed = calculateReadingSpeed($volumes);

    let totalRemainingChars = 0;
    seriesVolumes.forEach(volume => {
      const volumeData = $volumes[volume.volume_uuid];
      const remainingChars = volume.char_count - (volumeData?.chars || 0);
      totalRemainingChars += remainingChars;
    });

    const minutes = Math.ceil(totalRemainingChars / readingSpeed.charsPerMinute);
    const hours = Math.floor(minutes / 60);

    return { hours, minutes: minutes % 60 };
  });
</script>

<div class="series-header">
  <h1>{seriesTitle}</h1>
  <p class="series-stats">
    {volumesComplete}/{totalVolumes} volumes complete
    {#if seriesEstimate.hours > 0}
      • ~{seriesEstimate.hours}h {seriesEstimate.minutes}m remaining
    {/if}
  </p>
</div>
```

---

## Future Stats Page Features

### MVP Stats Page Route: `/stats`

**Overall Statistics:**
- Total volumes completed
- Total pages read
- Total characters read
- Total time spent reading
- Current reading speed (CPM)
- All-time fastest/slowest sessions

**Reading Speed Trends:**
- Line chart: CPM over time (last 30 sessions)
- X-axis: Session date
- Y-axis: Characters per minute
- Trend line indicating improvement

**Volume Performance:**
- Bar chart: Sessions per volume
- Show which volumes took multiple attempts
- Tooltip: Session details (date, duration, CPM)

**Recent Activity:**
- List of last 10 sessions with details

**Achievements/Milestones:**
- "Speed Demon" - Read at 1000+ CPM
- "Marathon Reader" - 3+ hour session
- "Dedicated" - 10 volumes completed
- "Improving" - 20% speed increase over last 10 sessions

---

## Implementation Phases

### Phase 1: Core Session Tracking (Week 1)
- [ ] Update `VolumeData` type with session fields
- [ ] Add session start/end logic to reader
- [ ] Implement page event tracking
- [ ] Add automatic compaction on session end
- [ ] Migration script for existing data
- [ ] Backward compatibility tests

### Phase 2: Reading Speed & Estimates (Week 2)
- [ ] Create `reading-speed.ts` utility
- [ ] Implement smart session filtering
- [ ] Add time-to-finish to reader UI
- [ ] Add time-to-finish to series page
- [ ] Add personalized indicator tooltips

### Phase 3: Stats Page (Week 3)
- [ ] Create `/stats` route
- [ ] Implement overall statistics display
- [ ] Add CPM trend chart (using Chart.js)
- [ ] Add volume performance visualization
- [ ] Add recent activity list
- [ ] Polish UI and responsive design

### Phase 4: Advanced Features (Future)
- [ ] Reading goals & challenges
- [ ] Export stats as CSV/JSON
- [ ] Comparison with other readers (anonymized, opt-in)
- [ ] Series difficulty ratings based on community CPM
- [ ] Reading streaks and calendar view

---

## Success Metrics

**Technical:**
- ✅ Session data < 10 KB per volume
- ✅ No performance degradation in reader
- ✅ 100% backward compatibility
- ✅ Reliable session end detection (>95%)

**User Experience:**
- ✅ Time estimates within 20% accuracy
- ✅ Visible improvement trend after 5+ sessions
- ✅ Stats page loads < 500ms
- ✅ Clear "personalized" vs "default" indicators

---

## Open Questions / Decisions Needed

1. **Session timeout duration:** 30 minutes reasonable? Or make it configurable?
2. **Minimum session validity:** 10 pages + 5 sec/page + 1 min total? Adjust thresholds?
3. **Stats page priority:** Build now or after Phase 2 feedback?
4. **Data retention:** Keep all sessions forever, or cap at 100 most recent?
5. **Reread detection:** Manual trigger button, or automatic based on completion status?
6. **Export feature:** Important for early adopters, or can wait?

---

## Files to Modify

### New Files
- `src/lib/util/reading-speed.ts` - Reading speed calculation logic
- `src/lib/util/session-tracking.ts` - Session lifecycle management
- `src/routes/stats/+page.svelte` - Stats page (Phase 3)

### Modified Files
- `src/lib/settings/volume-data.ts` - Add session fields to VolumeData
- `src/lib/components/Reader/Reader.svelte` - Integrate session tracking
- `src/lib/components/Reader/Timer.svelte` - Add time-to-finish display
- `src/routes/[manga]/+page.svelte` - Add series time estimate
- `src/routes/[manga]/[volume]/text/+page.svelte` - Use personalized estimates

---

## Notes

- **Backward compatibility is critical** - users must not lose existing data
- **Migration strategy:** Add new fields as optional, populate gradually
- **Performance:** Session compaction happens on end, not during reading
- **Privacy:** All data stays local, no telemetry unless user opts in
- **Testing:** Need comprehensive tests for edge cases (very fast, very slow, rereads)

---

**Next Steps:** Prioritize Phase 1 implementation after text view PR is merged.
