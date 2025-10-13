import { writable, get } from 'svelte/store';
import type { VolumeMetadata, VolumeData } from '$lib/types';
import { progressTrackerStore } from './progress-tracker';
import { WorkerPool, type WorkerTask } from './worker-pool';
import type { VolumeMetadata as WorkerVolumeMetadata } from './worker-pool';
import { tokenManager } from './google-drive/token-manager';
import { showSnackbar } from './snackbar';
import { db } from '$lib/catalog/db';
import { generateThumbnail } from '$lib/catalog/thumbnails';
import { driveApiClient } from './google-drive/api-client';
import { driveFilesCache } from './google-drive/drive-files-cache';
import { miscSettings } from '$lib/settings/misc';
import { unifiedCloudManager } from './sync/unified-cloud-manager';
import { getCloudFileId, getCloudProvider, getCloudSize, getCloudModifiedTime } from './cloud-fields';
import type { ProviderType } from './sync/provider-interface';
import { BlobReader, ZipReader, Uint8ArrayWriter } from '@zip.js/zip.js';

export interface QueueItem {
	volumeUuid: string;
	cloudFileId: string;
	cloudProvider: ProviderType;
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

interface MokuroData {
	version: string;
	title: string;
	title_uuid: string;
	pages: any[];
	chars: number;
	volume: string;
	volume_uuid: string;
}

interface DecompressedEntry {
	filename: string;
	data: ArrayBuffer;
}

// Internal queue state
const queueStore = writable<QueueItem[]>([]);

// Shared worker pool for all downloads
let workerPool: WorkerPool | null = null;
let processingStarted = false;

// Subscribe to queue changes and update progress tracker
queueStore.subscribe(queue => {
	const totalCount = queue.length;

	if (totalCount > 0) {
		progressTrackerStore.addProcess({
			id: 'download-queue-overall',
			description: 'Download Queue',
			status: `${totalCount} in queue`,
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
	const cloudFileId = getCloudFileId(volume);
	const cloudProvider = getCloudProvider(volume);

	console.log('[Download Queue] queueVolume called:', {
		isPlaceholder: volume.isPlaceholder,
		volumeTitle: volume.volume_title,
		cloudFileId,
		cloudProvider,
		volumeCloudProvider: volume.cloudProvider,
		volumeDriveFileId: volume.driveFileId
	});

	if (!volume.isPlaceholder || !cloudFileId || !cloudProvider) {
		console.warn('Can only queue placeholder volumes with cloud file IDs');
		return;
	}

	const queue = get(queueStore);

	// Check for duplicates by volumeUuid or cloudFileId
	const isDuplicate = queue.some(
		item => item.volumeUuid === volume.volume_uuid || item.cloudFileId === cloudFileId
	);

	if (isDuplicate) {
		console.log(`Volume ${volume.volume_title} already in queue`);
		return;
	}

	const queueItem: QueueItem = {
		volumeUuid: volume.volume_uuid,
		cloudFileId,
		cloudProvider,
		seriesTitle: volume.series_title,
		volumeTitle: volume.volume_title,
		volumeMetadata: volume,
		status: 'queued'
	};

	queueStore.update(q => [...q, queueItem]);

	// Always call processQueue to handle newly added items
	// It will only process items with status 'queued'
	processQueue();
}

/**
 * Add multiple volumes from a series to the queue
 */
export function queueSeriesVolumes(volumes: VolumeMetadata[]): void {
	const placeholders = volumes.filter(v => {
		const cloudFileId = getCloudFileId(v);
		return v.isPlaceholder && cloudFileId;
	});

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
 * Initialize worker pool with settings from miscSettings
 */
function initializeWorkerPool(): WorkerPool {
	if (workerPool) {
		return workerPool;
	}

	let maxWorkers: number;
	let memoryLimitMB: number;

	// Get throttle setting
	let throttleSetting = false;
	miscSettings.subscribe(value => {
		throttleSetting = value.throttleDownloads;
	})();

	if (throttleSetting) {
		// Throttled mode with reasonable limits
		maxWorkers = Math.min(navigator.hardwareConcurrency || 4, 6);
		memoryLimitMB = 500; // 500 MB memory threshold
		console.log(`Download queue: Throttled mode - ${maxWorkers} workers, ${memoryLimitMB}MB limit`);
	} else {
		// Unthrottled mode, use more workers and disable memory limits
		maxWorkers = Math.min(navigator.hardwareConcurrency || 4, 12);
		memoryLimitMB = 100000; // Very high memory limit (100GB) effectively disables the constraint
		console.log(`Download queue: Unthrottled mode - ${maxWorkers} workers, no memory limit`);
	}

	workerPool = new WorkerPool(undefined, maxWorkers, memoryLimitMB);
	return workerPool;
}

/**
 * Decompress a CBZ file blob into entries
 */
async function decompressCbz(blob: Blob): Promise<DecompressedEntry[]> {
	const reader = new BlobReader(blob);
	const zipReader = new ZipReader(reader);
	const entries = await zipReader.getEntries();

	const decompressed: DecompressedEntry[] = [];
	for (const entry of entries) {
		if (entry.directory || !entry.getData) continue;

		const uint8Array = await entry.getData(new Uint8ArrayWriter());
		decompressed.push({
			filename: entry.filename,
			data: uint8Array.buffer as ArrayBuffer
		});
	}

	await zipReader.close();
	return decompressed;
}

/**
 * Get provider credentials for worker downloads
 */
function getProviderCredentials(provider: ProviderType): any {
	if (provider === 'google-drive') {
		let token = '';
		tokenManager.token.subscribe(value => {
			token = value;
		})();
		return { accessToken: token };
	} else if (provider === 'webdav') {
		// Get WebDAV credentials from localStorage
		const serverUrl = localStorage.getItem('webdav_server_url');
		const username = localStorage.getItem('webdav_username');
		const password = localStorage.getItem('webdav_password');
		return { webdavUrl: serverUrl, webdavUsername: username, webdavPassword: password };
	}
	return {};
}

/**
 * Process mokuro data and save volume to IndexedDB
 */
async function processVolumeData(
	entries: DecompressedEntry[],
	placeholder: VolumeMetadata
): Promise<void> {
	// Find .mokuro file
	const mokuroEntry = entries.find(e => e.filename.endsWith('.mokuro'));
	if (!mokuroEntry) {
		throw new Error('No .mokuro file found in CBZ');
	}

	// Parse mokuro JSON
	const mokuroText = new TextDecoder().decode(mokuroEntry.data);
	const mokuroData: MokuroData = JSON.parse(mokuroText);

	// Create VolumeMetadata from mokuro data
	const metadata: VolumeMetadata = {
		mokuro_version: mokuroData.version,
		series_title: mokuroData.title,
		series_uuid: mokuroData.title_uuid,
		volume_title: mokuroData.volume,
		volume_uuid: mokuroData.volume_uuid,
		page_count: mokuroData.pages.length,
		character_count: mokuroData.chars
	};

	// Convert image entries to File objects
	const files: Record<string, File> = {};
	for (const entry of entries) {
		if (!entry.filename.endsWith('.mokuro') && !entry.filename.includes('__MACOSX')) {
			const blob = new Blob([entry.data]);
			files[entry.filename] = new File([blob], entry.filename);
		}
	}

	// Create VolumeData
	const volumeData: VolumeData = {
		volume_uuid: mokuroData.volume_uuid,
		pages: mokuroData.pages,
		files
	};

	// Generate thumbnail from first image
	const fileNames = Object.keys(files).sort((a, b) =>
		a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
	);
	if (fileNames.length > 0) {
		metadata.thumbnail = await generateThumbnail(files[fileNames[0]]);
	}

	// Save to IndexedDB
	const existingVolume = await db.volumes.where('volume_uuid').equals(metadata.volume_uuid).first();

	if (!existingVolume) {
		await db.transaction('rw', db.volumes, db.volumes_data, async () => {
			await db.volumes.add(metadata);
			await db.volumes_data.add(volumeData);
		});
	}

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


					// Also update driveFilesCache
					driveFilesCache.updateFileDescription(cloudFileId, newDescription);
						// Update unified cloud manager cache
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
}

/**
 * Handle download errors consistently
 */
function handleDownloadError(item: QueueItem, processId: string, errorMessage: string): void {
	progressTrackerStore.updateProcess(processId, {
		progress: 0,
		status: `Error: ${errorMessage}`
	});
	showSnackbar(`Failed to download ${item.volumeTitle}: ${errorMessage}`);
	queueStore.update(q => q.filter(i => i.volumeUuid !== item.volumeUuid));
	setTimeout(() => progressTrackerStore.removeProcess(processId), 3000);
}

/**
 * Check if queue is empty and terminate worker pool if so
 */
function checkAndTerminatePool(): void {
	const currentQueue = get(queueStore);
	if (currentQueue.length === 0 && workerPool) {
		workerPool.terminate();
		workerPool = null;
		processingStarted = false;
	}
}

/**
 * Process download using hybrid strategy based on provider capabilities
 * - Providers that support worker downloads (Drive, WebDAV): Workers handle download + decompress
 * - Providers that don't (MEGA): Main thread downloads, workers decompress
 */
async function processDownload(item: QueueItem, processId: string): Promise<void> {
	const provider = unifiedCloudManager.getActiveProvider();

	if (!provider) {
		handleDownloadError(item, processId, 'No cloud provider authenticated');
		return;
	}

	const pool = initializeWorkerPool();
	const fileSize = getCloudSize(item.volumeMetadata) || 0;

	// Check if provider supports worker downloads
	if (provider.supportsWorkerDownload) {
		// Strategy 1: Worker handles download + decompress (Drive, WebDAV)
		console.log(`[Download Queue] Using worker download for ${provider.name}`);

		// Get provider credentials
		const credentials = getProviderCredentials(provider.type);

		// Estimate memory requirement (download + decompress + processing overhead)
		const memoryRequirement = Math.max(fileSize * 4, 50 * 1024 * 1024);

		// Create worker metadata
		const workerMetadata: WorkerVolumeMetadata = {
			volumeUuid: item.volumeUuid,
			driveFileId: item.cloudFileId,
			seriesTitle: item.seriesTitle,
			volumeTitle: item.volumeTitle,
			driveModifiedTime: getCloudModifiedTime(item.volumeMetadata) ?? undefined,
			driveSize: getCloudSize(item.volumeMetadata) ?? undefined
		};

		// Create worker task for download+decompress
		const task: WorkerTask = {
			id: item.cloudFileId,
			memoryRequirement,
			metadata: workerMetadata,
			data: {
				mode: 'download-and-decompress',
				provider: provider.type,
				fileId: item.cloudFileId,
				fileName: item.volumeTitle + '.cbz',
				credentials,
				metadata: workerMetadata
			},
			onProgress: data => {
				const percent = Math.round((data.loaded / data.total) * 100);
				progressTrackerStore.updateProcess(processId, {
					progress: percent * 0.9, // 0-90% for download
					status: `Downloading... ${percent}%`
				});
			},
			onComplete: async (data, releaseMemory) => {
				try {
					progressTrackerStore.updateProcess(processId, {
						progress: 95,
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
	} else {
		// Strategy 2: Main thread downloads, worker decompresses (MEGA)
		// Wait for worker completion to limit downloads to 1 at a time (prevents OOM on low memory devices)
		console.log(`[Download Queue] Using main thread download for ${provider.name}`);

		try {
			// Download CBZ blob in main thread via unified cloud manager
			const blob = await unifiedCloudManager.downloadVolumeCbz(
				item.cloudFileId,
				(loaded, total) => {
					const percent = Math.round((loaded / total) * 100);
					progressTrackerStore.updateProcess(processId, {
						progress: percent * 0.7, // 0-70% for download
						status: `Downloading... ${percent}%`
					});
				}
			);

			progressTrackerStore.updateProcess(processId, {
				progress: 70,
				status: 'Preparing decompression...'
			});

			// Convert blob to ArrayBuffer for worker
			const arrayBuffer = await blob.arrayBuffer();

			// Estimate memory requirement (decompress + processing overhead)
			const memoryRequirement = Math.max(blob.size * 3, 50 * 1024 * 1024);

			// Create worker metadata
			const workerMetadata: WorkerVolumeMetadata = {
				volumeUuid: item.volumeUuid,
				driveFileId: item.cloudFileId,
				seriesTitle: item.seriesTitle,
				volumeTitle: item.volumeTitle,
				driveModifiedTime: getCloudModifiedTime(item.volumeMetadata) ?? undefined,
				driveSize: getCloudSize(item.volumeMetadata) ?? undefined
			};

			// Wait for worker to decompress before continuing to next download
			await new Promise<void>((resolve, reject) => {
				const task: WorkerTask = {
					id: item.cloudFileId,
					memoryRequirement,
					metadata: workerMetadata,
					data: {
						mode: 'decompress-only',
						fileId: item.cloudFileId,
						fileName: item.volumeTitle + '.cbz',
						blob: arrayBuffer,
						metadata: workerMetadata
					},
					onProgress: data => {
						// Decompression progress (70-95%)
						progressTrackerStore.updateProcess(processId, {
							progress: 70 + (data.progress || 0) * 0.25,
							status: 'Decompressing...'
						});
					},
					onComplete: async (data, releaseMemory) => {
						try {
							progressTrackerStore.updateProcess(processId, {
								progress: 95,
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

							resolve(); // Signal completion
						} catch (error) {
							console.error(`Failed to process ${item.volumeTitle}:`, error);
							handleDownloadError(item, processId, error instanceof Error ? error.message : 'Unknown error');
							reject(error);
						} finally {
							releaseMemory();
							checkAndTerminatePool();
						}
					},
					onError: data => {
						console.error(`Error decompressing ${item.volumeTitle}:`, data.error);
						handleDownloadError(item, processId, data.error);
						checkAndTerminatePool();
						reject(new Error(data.error));
					}
				};

				pool.addTask(task);
			});
		} catch (error) {
			console.error(`Failed to download ${item.volumeTitle}:`, error);
			handleDownloadError(item, processId, error instanceof Error ? error.message : 'Unknown error');
		}
	}
}

/**
 * Process the queue - unified download handling for all providers
 */
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

		const processId = `download-${item.cloudFileId}`;

		// Add progress tracker
		progressTrackerStore.addProcess({
			id: processId,
			description: `Downloading ${item.volumeTitle}`,
			progress: 0,
			status: 'Starting download...'
		});

		console.log('[Download Queue] Processing download:', {
			volumeTitle: item.volumeTitle,
			cloudProvider: item.cloudProvider
		});

		// Use unified download function (hybrid strategy handles provider differences)
		await processDownload(item, processId);
	}
}

// Export the store for reactive subscriptions
export const downloadQueue = {
	subscribe: queueStore.subscribe,
	queueVolume,
	queueSeriesVolumes,
	isVolumeInQueue,
	getSeriesQueueStatus
};
