import { writable, get } from 'svelte/store';
import type { VolumeMetadata } from '$lib/types';
import { progressTrackerStore } from './progress-tracker';
import { WorkerPool, type WorkerTask } from './worker-pool';
import { tokenManager } from './google-drive/token-manager';
import { showSnackbar } from './snackbar';
import { db } from '$lib/catalog/db';
import { miscSettings } from '$lib/settings/misc';
import { unifiedCloudManager } from './sync/unified-cloud-manager';
import type { ProviderType } from './sync/provider-interface';
import UploadWorker from '$lib/workers/upload-worker.ts?worker';

export interface BackupQueueItem {
	volumeUuid: string;
	seriesTitle: string;
	volumeTitle: string;
	provider: ProviderType;
	volumeMetadata: VolumeMetadata;
	status: 'queued' | 'backing-up';
}

interface SeriesQueueStatus {
	hasQueued: boolean;
	hasBackingUp: boolean;
	queuedCount: number;
	backingUpCount: number;
}

// Internal queue state
const queueStore = writable<BackupQueueItem[]>([]);

// Shared worker pool for all backups
let workerPool: WorkerPool | null = null;
let processingStarted = false;

// Subscribe to queue changes and update progress tracker
queueStore.subscribe(queue => {
	const totalCount = queue.length;

	if (totalCount > 0) {
		progressTrackerStore.addProcess({
			id: 'backup-queue-overall',
			description: 'Backup Queue',
			status: `${totalCount} in queue`,
			progress: 0
		});
	} else {
		progressTrackerStore.removeProcess('backup-queue-overall');
	}
});

/**
 * Add a single volume to the backup queue
 */
export function queueVolumeForBackup(volume: VolumeMetadata, provider?: ProviderType): void {
	console.log('[Backup Queue] queueVolumeForBackup called:', {
		volumeTitle: volume.volume_title,
		provider
	});

	// Get default provider if not specified
	const targetProvider = provider || unifiedCloudManager.getDefaultProvider()?.type;
	if (!targetProvider) {
		console.warn('No cloud provider available for backup');
		showSnackbar('Please connect to a cloud storage provider first', 'error');
		return;
	}

	const queue = get(queueStore);

	// Check for duplicates by volumeUuid
	const isDuplicate = queue.some(item => item.volumeUuid === volume.volume_uuid);

	if (isDuplicate) {
		console.log(`Volume ${volume.volume_title} already in backup queue`);
		return;
	}

	const queueItem: BackupQueueItem = {
		volumeUuid: volume.volume_uuid,
		seriesTitle: volume.series_title,
		volumeTitle: volume.volume_title,
		provider: targetProvider,
		volumeMetadata: volume,
		status: 'queued'
	};

	queueStore.update(q => [...q, queueItem]);

	// Always call processQueue to handle newly added items
	processQueue();
}

/**
 * Add multiple volumes to the backup queue
 */
export function queueSeriesVolumesForBackup(volumes: VolumeMetadata[], provider?: ProviderType): void {
	// Get default provider if not specified
	const targetProvider = provider || unifiedCloudManager.getDefaultProvider()?.type;
	if (!targetProvider) {
		console.warn('No cloud provider available for backup');
		showSnackbar('Please connect to a cloud storage provider first', 'error');
		return;
	}

	if (volumes.length === 0) {
		console.warn('No volumes to queue for backup');
		return;
	}

	// Sort alphabetically by series title first, then by volume title
	const sorted = [...volumes].sort((a, b) => {
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

	// Add each volume individually (duplicate check happens in queueVolumeForBackup)
	sorted.forEach(volume => queueVolumeForBackup(volume, targetProvider));
}

/**
 * Check if a specific volume is in the backup queue
 */
export function isVolumeInBackupQueue(volumeUuid: string): boolean {
	const queue = get(queueStore);
	return queue.some(item => item.volumeUuid === volumeUuid);
}

/**
 * Get queue status for an entire series
 */
export function getSeriesBackupQueueStatus(seriesTitle: string): SeriesQueueStatus {
	const queue = get(queueStore);
	const seriesItems = queue.filter(item => item.seriesTitle === seriesTitle);

	return {
		hasQueued: seriesItems.some(item => item.status === 'queued'),
		hasBackingUp: seriesItems.some(item => item.status === 'backing-up'),
		queuedCount: seriesItems.filter(item => item.status === 'queued').length,
		backingUpCount: seriesItems.filter(item => item.status === 'backing-up').length
	};
}

/**
 * Initialize worker pool based on user-configured RAM setting
 */
function initializeWorkerPool(): WorkerPool {
	if (workerPool) {
		return workerPool;
	}

	// Fixed worker count - cloud upload speeds are the bottleneck, not CPU
	const maxWorkers = 4;
	let memoryLimitMB: number;

	// Get user's RAM configuration
	let deviceRamGB = 4; // Default
	miscSettings.subscribe(value => {
		deviceRamGB = value.deviceRamGB;
	})();

	// Memory limit: 1/8th of configured RAM (e.g., 16GB = 2048MB limit)
	memoryLimitMB = (deviceRamGB * 1024) / 8;

	console.log(`Backup queue: ${maxWorkers} workers, ${memoryLimitMB}MB limit (${deviceRamGB}GB configured)`);

	workerPool = new WorkerPool(UploadWorker, maxWorkers, memoryLimitMB);
	return workerPool;
}

/**
 * Get provider credentials for worker uploads
 */
async function getProviderCredentials(provider: ProviderType): Promise<any> {
	if (provider === 'google-drive') {
		let token = '';
		tokenManager.token.subscribe(value => {
			token = value;
		})();
		return { accessToken: token };
	} else if (provider === 'webdav') {
		const serverUrl = localStorage.getItem('webdav_server_url');
		const username = localStorage.getItem('webdav_username');
		const password = localStorage.getItem('webdav_password');
		return { webdavUrl: serverUrl, webdavUsername: username, webdavPassword: password };
	} else if (provider === 'mega') {
		// MEGA credentials need to be passed to worker (can't access localStorage in worker)
		const email = localStorage.getItem('mega_email');
		const password = localStorage.getItem('mega_password');
		return { megaEmail: email, megaPassword: password };
	}
	return {};
}

/**
 * Read volume data from IndexedDB and prepare for worker
 */
async function prepareVolumeDataForWorker(volumeUuid: string): Promise<{
	metadata: any;
	filesData: { filename: string; data: ArrayBuffer }[];
}> {
	// Get volume metadata and data
	const volume = await db.volumes.where('volume_uuid').equals(volumeUuid).first();
	const volumeData = await db.volumes_data.where('volume_uuid').equals(volumeUuid).first();

	if (!volume || !volumeData) {
		throw new Error('Volume not found in database');
	}

	// Prepare mokuro metadata
	const metadata = {
		version: volume.mokuro_version,
		title: volume.series_title,
		title_uuid: volume.series_uuid,
		volume: volume.volume_title,
		volume_uuid: volume.volume_uuid,
		pages: volumeData.pages,
		chars: volume.character_count
	};

	// Convert File objects to ArrayBuffers for transfer
	const filesData: { filename: string; data: ArrayBuffer }[] = [];
	if (volumeData.files) {
		for (const [filename, file] of Object.entries(volumeData.files)) {
			const arrayBuffer = await file.arrayBuffer();
			filesData.push({ filename, data: arrayBuffer });
		}
	}

	return { metadata, filesData };
}

/**
 * Handle backup errors consistently
 */
function handleBackupError(item: BackupQueueItem, processId: string, errorMessage: string): void {
	progressTrackerStore.updateProcess(processId, {
		progress: 0,
		status: `Error: ${errorMessage}`
	});
	showSnackbar(`Failed to backup ${item.volumeTitle}: ${errorMessage}`);
	queueStore.update(q => q.filter(i => i.volumeUuid !== item.volumeUuid));
	setTimeout(() => progressTrackerStore.removeProcess(processId), 3000);
}

/**
 * Check if queue is empty and terminate worker pool if so
 */
async function checkAndTerminatePool(): Promise<void> {
	const currentQueue = get(queueStore);
	if (currentQueue.length === 0 && workerPool) {
		const provider = unifiedCloudManager.getActiveProvider();

		workerPool.terminate();
		workerPool = null;
		processingStarted = false;

		// For MEGA, delay cache refresh to allow server propagation
		// Manual cache additions have already made files visible in UI
		if (provider?.type === 'mega') {
			console.log('[Backup Queue] All uploads complete, waiting 3s before refreshing MEGA cache...');
			setTimeout(async () => {
				await unifiedCloudManager.fetchAllCloudVolumes();
				console.log('[Backup Queue] MEGA cache refreshed with server data');
			}, 3000);
		} else {
			// For other providers, refresh immediately
			console.log('[Backup Queue] All uploads complete, refreshing cloud cache...');
			await unifiedCloudManager.fetchAllCloudVolumes();
		}
	}
}

/**
 * Process backup using workers for all providers
 * Data loading is deferred until worker is ready to prevent memory pressure
 */
async function processBackup(item: BackupQueueItem, processId: string): Promise<void> {
	const provider = unifiedCloudManager.getActiveProvider();

	if (!provider) {
		handleBackupError(item, processId, 'No cloud provider authenticated');
		return;
	}

	const pool = initializeWorkerPool();

	// Estimate volume size (rough estimate: page count * 0.5MB average per page)
	const estimatedSize = (item.volumeMetadata.page_count || 10) * 0.5 * 1024 * 1024;
	// Estimate memory requirement (compression + upload buffer)
	const memoryRequirement = Math.max(estimatedSize * 2.8, 50 * 1024 * 1024);

	try {
		// Create worker task with lazy data loading
		const task: WorkerTask = {
			id: item.volumeUuid,
			memoryRequirement,
			// Defer data loading until worker is ready
			prepareData: async () => {
				// This will only be called when a worker is actually available
				progressTrackerStore.updateProcess(processId, {
					progress: 5,
					status: 'Reading volume data...'
				});

				const { metadata, filesData } = await prepareVolumeDataForWorker(item.volumeUuid);
				const credentials = await getProviderCredentials(provider.type);

				return {
					mode: 'compress-and-upload',
					provider: provider.type,
					volumeTitle: item.volumeTitle,
					seriesTitle: item.seriesTitle,
					metadata,
					filesData,
					credentials
				};
			},
			onProgress: data => {
				// Progress: 0-30% compression, 30-100% upload
				const percent = Math.round(data.progress);
				progressTrackerStore.updateProcess(processId, {
					progress: percent,
					status: data.phase === 'compressing' ? 'Compressing...' : 'Uploading...'
				});
			},
			onComplete: async (data, releaseMemory) => {
				try {
					progressTrackerStore.updateProcess(processId, {
						progress: 100,
						status: 'Backup complete'
					});

					showSnackbar(`Backed up ${item.volumeTitle} successfully`);
					queueStore.update(q => q.filter(i => i.volumeUuid !== item.volumeUuid));

					// For MEGA, manually add the uploaded file to cache for immediate UI update
					// (Worker uses separate MEGA instance, so main thread needs to be notified)
					if (provider.type === 'mega' && data?.fileId) {
						const { megaCache } = await import('./sync/providers/mega/mega-cache');
						const path = `${item.seriesTitle}/${item.volumeTitle}.cbz`;
						// Cache is keyed by series title, not full path
						megaCache.add(item.seriesTitle, {
							fileId: data.fileId,
							path,
							modifiedTime: new Date().toISOString(),
							size: 0 // Size unknown at this point, will be updated on next full fetch
						});
						console.log(`✅ Added ${path} to MEGA cache (series: ${item.seriesTitle})`);
					}

					// Note: Full cache refresh is deferred until all uploads complete (see checkAndTerminatePool)
					// to prevent overlapping fetches from overwriting manual cache additions

					setTimeout(() => progressTrackerStore.removeProcess(processId), 3000);
				} catch (error) {
					console.error(`Failed to finalize backup for ${item.volumeTitle}:`, error);
					handleBackupError(item, processId, error instanceof Error ? error.message : 'Unknown error');
				} finally {
					releaseMemory();
					checkAndTerminatePool();
				}
			},
			onError: data => {
				console.error(`Error backing up ${item.volumeTitle}:`, data.error);
				handleBackupError(item, processId, data.error);
				checkAndTerminatePool();
			}
		};

		pool.addTask(task);
	} catch (error) {
		console.error(`Failed to prepare backup for ${item.volumeTitle}:`, error);
		handleBackupError(item, processId, error instanceof Error ? error.message : 'Unknown error');
		checkAndTerminatePool();
	}
}

/**
 * Process the queue - unified backup handling for all providers
 * Processes all queued items concurrently (respecting worker pool limits)
 */
function processQueue(): void {
	const queue = get(queueStore);
	const queuedItems = queue.filter(item => item.status === 'queued');

	// Mark processing as started if we have queued items
	if (queuedItems.length > 0) {
		processingStarted = true;
	}

	// Process each queued item (worker pool will handle concurrency limits)
	queuedItems.forEach(item => {
		// Mark as backing-up
		queueStore.update(q =>
			q.map(i => (i.volumeUuid === item.volumeUuid ? { ...i, status: 'backing-up' as const } : i))
		);

		const processId = `backup-${item.volumeUuid}`;

		// Add progress tracker
		progressTrackerStore.addProcess({
			id: processId,
			description: `Backing up ${item.volumeTitle}`,
			progress: 0,
			status: 'Starting backup...'
		});

		console.log('[Backup Queue] Processing backup:', {
			volumeTitle: item.volumeTitle,
			provider: item.provider
		});

		// Start backup (worker pool handles concurrency)
		processBackup(item, processId);
	});
}

// Export the store for reactive subscriptions
export const backupQueue = {
	subscribe: queueStore.subscribe,
	queueVolumeForBackup,
	queueSeriesVolumesForBackup,
	isVolumeInBackupQueue,
	getSeriesBackupQueueStatus
};
