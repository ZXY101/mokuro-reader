import { writable, get } from 'svelte/store';
import type { VolumeMetadata } from '$lib/types';
import { downloadVolumeFromDrive } from './download-from-drive';
import { progressTrackerStore } from './progress-tracker';

export interface QueueItem {
	volumeUuid: string;
	driveFileId: string;
	seriesTitle: string;
	volumeTitle: string;
	volumeMetadata: VolumeMetadata;
	status: 'queued' | 'downloading';
}

interface SeriesQueueStatus {
	hasQueued: boolean;
	hasDownloading: boolean;
	queuedCount: number;
	downloadingCount: number;
}

// Internal queue state
const queueStore = writable<QueueItem[]>([]);
let isProcessing = false;

// Subscribe to queue changes and update progress tracker
queueStore.subscribe(queue => {
	const queuedCount = queue.filter(item => item.status === 'queued').length;
	const downloadingCount = queue.filter(item => item.status === 'downloading').length;
	const totalCount = queuedCount + downloadingCount;

	if (totalCount > 0) {
		progressTrackerStore.addProcess({
			id: 'download-queue-overall',
			description: 'Download Queue',
			status: `${queuedCount} in queue, ${downloadingCount} downloading`,
			progress: 0 // Progress bar won't show meaningful data for growing queue
		});
	} else {
		progressTrackerStore.removeProcess('download-queue-overall');
	}
});

/**
 * Add a single volume to the download queue
 */
export function queueVolume(volume: VolumeMetadata): void {
	if (!volume.isPlaceholder || !volume.driveFileId) {
		console.warn('Can only queue placeholder volumes with Drive file IDs');
		return;
	}

	const queue = get(queueStore);

	// Check for duplicates by volumeUuid or driveFileId
	const isDuplicate = queue.some(
		item => item.volumeUuid === volume.volume_uuid || item.driveFileId === volume.driveFileId
	);

	if (isDuplicate) {
		console.log(`Volume ${volume.volume_title} already in queue`);
		return;
	}

	const queueItem: QueueItem = {
		volumeUuid: volume.volume_uuid,
		driveFileId: volume.driveFileId,
		seriesTitle: volume.series_title,
		volumeTitle: volume.volume_title,
		volumeMetadata: volume,
		status: 'queued'
	};

	queueStore.update(q => [...q, queueItem]);

	// Start processing if not already running
	if (!isProcessing) {
		processQueue();
	}
}

/**
 * Add multiple volumes from a series to the queue
 */
export function queueSeriesVolumes(volumes: VolumeMetadata[]): void {
	const placeholders = volumes.filter(v => v.isPlaceholder && v.driveFileId);

	if (placeholders.length === 0) {
		console.warn('No placeholder volumes to queue');
		return;
	}

	// Sort alphabetically by series title first, then by volume title
	placeholders.sort((a, b) => {
		const seriesCompare = a.series_title.localeCompare(b.series_title, undefined, {
			numeric: true,
			sensitivity: 'base'
		});
		if (seriesCompare !== 0) {
			return seriesCompare;
		}
		return a.volume_title.localeCompare(b.volume_title, undefined, {
			numeric: true,
			sensitivity: 'base'
		});
	});

	// Add each volume individually (duplicate check happens in queueVolume)
	placeholders.forEach(volume => queueVolume(volume));
}

/**
 * Check if a specific volume is in the queue
 */
export function isVolumeInQueue(volumeUuid: string): boolean {
	const queue = get(queueStore);
	return queue.some(item => item.volumeUuid === volumeUuid);
}

/**
 * Get queue status for an entire series
 */
export function getSeriesQueueStatus(seriesTitle: string): SeriesQueueStatus {
	const queue = get(queueStore);
	const seriesItems = queue.filter(item => item.seriesTitle === seriesTitle);

	return {
		hasQueued: seriesItems.some(item => item.status === 'queued'),
		hasDownloading: seriesItems.some(item => item.status === 'downloading'),
		queuedCount: seriesItems.filter(item => item.status === 'queued').length,
		downloadingCount: seriesItems.filter(item => item.status === 'downloading').length
	};
}

/**
 * Process the queue sequentially (one download at a time)
 */
async function processQueue(): Promise<void> {
	if (isProcessing) {
		return;
	}

	isProcessing = true;

	while (true) {
		const queue = get(queueStore);

		// Find first queued item (not downloading)
		const nextItem = queue.find(item => item.status === 'queued');

		if (!nextItem) {
			// Queue is empty or all items are downloading
			break;
		}

		// Mark as downloading
		queueStore.update(q =>
			q.map(item =>
				item.volumeUuid === nextItem.volumeUuid
					? { ...item, status: 'downloading' as const }
					: item
			)
		);

		try {
			// Download the volume
			await downloadVolumeFromDrive(nextItem.volumeMetadata);
		} catch (error) {
			console.error(`Failed to download ${nextItem.volumeTitle}:`, error);
		}

		// Remove from queue after completion (success or failure)
		queueStore.update(q => q.filter(item => item.volumeUuid !== nextItem.volumeUuid));
	}

	isProcessing = false;
}

// Export the store for reactive subscriptions
export const downloadQueue = {
	subscribe: queueStore.subscribe,
	queueVolume,
	queueSeriesVolumes,
	isVolumeInQueue,
	getSeriesQueueStatus
};
