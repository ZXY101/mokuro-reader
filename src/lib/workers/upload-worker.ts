// Universal worker for compressing and uploading volume backups
// Worker handles compression and upload for all cloud providers (Google Drive, WebDAV, MEGA)

import { Uint8ArrayReader, Uint8ArrayWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { Storage } from 'megajs';

// Define the worker context
const ctx: Worker = self as any;

interface CompressAndUploadMessage {
	mode: 'compress-and-upload';
	provider: 'google-drive' | 'webdav' | 'mega';
	volumeTitle: string;
	seriesTitle: string;
	metadata: any; // Mokuro metadata
	filesData: { filename: string; data: ArrayBuffer }[]; // Volume image files
	credentials: ProviderCredentials;
}

interface ProviderCredentials {
	// Google Drive
	accessToken?: string;
	seriesFolderId?: string; // Pre-created folder ID (avoids race conditions)

	// WebDAV
	webdavUrl?: string;
	webdavUsername?: string;
	webdavPassword?: string;

	// MEGA
	megaEmail?: string;
	megaPassword?: string;
}

interface ProgressMessage {
	type: 'progress';
	phase: 'compressing' | 'uploading';
	progress: number; // 0-100
}

interface CompleteMessage {
	type: 'complete';
	fileId: string;
}

interface ErrorMessage {
	type: 'error';
	error: string;
}

/**
 * Compress volume data into a CBZ file (Uint8Array)
 * Progress: 0-30% of overall process
 */
async function compressVolume(
	volumeTitle: string,
	metadata: any,
	filesData: { filename: string; data: ArrayBuffer }[],
	onProgress: (loaded: number, total: number) => void
): Promise<Uint8Array> {
	console.log(`Worker: Compressing ${volumeTitle}...`);

	// Create zip writer with Uint8Array output
	const zipWriter = new ZipWriter(new Uint8ArrayWriter());

	// Total items to add: all files + mokuro file
	const totalItems = filesData.length + 1;
	let completedItems = 0;

	// Add image files inside a folder
	const folderName = volumeTitle;
	for (const { filename, data } of filesData) {
		await zipWriter.add(`${folderName}/${filename}`, new Uint8ArrayReader(new Uint8Array(data)));
		completedItems++;
		onProgress(completedItems, totalItems);
	}

	// Add mokuro metadata file
	await zipWriter.add(`${volumeTitle}.mokuro`, new TextReader(JSON.stringify(metadata)));
	completedItems++;
	onProgress(completedItems, totalItems);

	// Close and get the compressed data
	const uint8Array = await zipWriter.close();

	console.log(`Worker: Compressed ${volumeTitle} (${uint8Array.length} bytes)`);
	return uint8Array;
}

/**
 * Upload to Google Drive using resumable upload
 * Progress: 30-100% of overall process
 */
async function uploadToGoogleDrive(
	cbzData: Uint8Array,
	filename: string,
	seriesFolderId: string,
	accessToken: string,
	onProgress: (loaded: number, total: number) => void
): Promise<string> {
	console.log(`Worker: Uploading ${filename} to Google Drive...`);

	// Use pre-created folder ID (created in backup-queue to avoid race conditions)
	const metadata = {
		name: filename,
		mimeType: 'application/x-cbz',
		parents: [seriesFolderId]
	};

	// Step 1: Initiate resumable upload session
	const initResponse = await fetch(
		'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
		{
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(metadata)
		}
	);

	if (!initResponse.ok) {
		throw new Error(`Upload init failed: ${initResponse.status} ${initResponse.statusText}`);
	}

	const uploadUrl = initResponse.headers.get('Location');
	if (!uploadUrl) {
		throw new Error('No upload URL returned');
	}

	// Step 2: Upload the actual file data with progress tracking
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', uploadUrl);
		xhr.setRequestHeader('Content-Type', 'application/x-cbz');

		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) {
				onProgress(event.loaded, event.total);
			}
		};

		xhr.onload = async () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				const result = JSON.parse(xhr.responseText);
				console.log(`Worker: Upload complete, file ID: ${result.id}`);
				resolve(result.id);
			} else {
				reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
			}
		};

		xhr.onerror = () => reject(new Error('Network error during upload'));
		xhr.ontimeout = () => reject(new Error('Upload timed out'));

		xhr.send(cbzData);
	});
}

/**
 * Helper: Get or create a folder in Google Drive
 */
async function getOrCreateFolder(
	folderName: string,
	accessToken: string,
	parentId?: string
): Promise<string> {
	// Escape single quotes and backslashes for Drive query
	const escapedName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

	// Search for existing folder
	const query = parentId
		? `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
		: `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

	const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
	const searchResponse = await fetch(searchUrl, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});

	if (!searchResponse.ok) {
		throw new Error(`Folder search failed: ${searchResponse.statusText}`);
	}

	const searchData = await searchResponse.json();
	if (searchData.files && searchData.files.length > 0) {
		return searchData.files[0].id;
	}

	// Create folder if it doesn't exist
	const metadata = {
		name: folderName,
		mimeType: 'application/vnd.google-apps.folder',
		...(parentId && { parents: [parentId] })
	};

	const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${accessToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(metadata)
	});

	if (!createResponse.ok) {
		throw new Error(`Folder creation failed: ${createResponse.statusText}`);
	}

	const createData = await createResponse.json();
	return createData.id;
}

/**
 * Upload to WebDAV server
 * Progress: 30-100% of overall process
 */
async function uploadToWebDAV(
	cbzData: Uint8Array,
	filename: string,
	seriesTitle: string,
	serverUrl: string,
	username: string,
	password: string,
	onProgress: (loaded: number, total: number) => void
): Promise<string> {
	console.log(`Worker: Uploading ${filename} to WebDAV...`);

	// Ensure folder exists
	const seriesFolderPath = `mokuro-reader/${seriesTitle}`;
	await createWebDAVFolderRecursive(seriesFolderPath, serverUrl, username, password);

	// Upload file
	const filePath = `${seriesFolderPath}/${filename}`;
	const fileUrl = `${serverUrl}${filePath}`;
	const authHeader = 'Basic ' + btoa(`${username}:${password}`);

	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', fileUrl);
		xhr.setRequestHeader('Authorization', authHeader);
		xhr.setRequestHeader('Content-Type', 'application/x-cbz');

		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) {
				onProgress(event.loaded, event.total);
			}
		};

		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				console.log(`Worker: WebDAV upload complete`);
				resolve(filePath); // Return path as "file ID"
			} else {
				reject(new Error(`WebDAV upload failed: ${xhr.status} ${xhr.statusText}`));
			}
		};

		xhr.onerror = () => reject(new Error('Network error during WebDAV upload'));
		xhr.ontimeout = () => reject(new Error('WebDAV upload timed out'));

		xhr.send(cbzData);
	});
}

/**
 * Helper: Create WebDAV folder recursively
 */
async function createWebDAVFolderRecursive(
	path: string,
	serverUrl: string,
	username: string,
	password: string
): Promise<void> {
	const authHeader = 'Basic ' + btoa(`${username}:${password}`);
	const parts = path.split('/').filter(p => p);

	let currentPath = '';
	for (const part of parts) {
		currentPath += `/${part}`;
		const folderUrl = `${serverUrl}${currentPath}`;

		// Try to create folder (MKCOL)
		try {
			const response = await fetch(folderUrl, {
				method: 'MKCOL',
				headers: { 'Authorization': authHeader }
			});

			// 201 = created, 405 = already exists, both are OK
			if (!response.ok && response.status !== 405) {
				console.warn(`Failed to create folder ${currentPath}: ${response.status}`);
			}
		} catch (error) {
			console.warn(`Error creating folder ${currentPath}:`, error);
		}
	}
}

/**
 * Upload to MEGA
 * Progress: 30-100% of overall process
 */
async function uploadToMEGA(
	cbzData: Uint8Array,
	filename: string,
	seriesTitle: string,
	email: string,
	password: string,
	onProgress: (loaded: number, total: number) => void
): Promise<string> {
	console.log(`Worker: Uploading ${filename} to MEGA...`);

	if (!email || !password) {
		throw new Error('MEGA credentials not provided');
	}

	// Create MEGA storage instance
	const storage = new Storage({ email, password });

	// Wait for ready
	await storage.ready;

	// Ensure folder structure exists
	let currentFolder = storage.root;

	// Create/find mokuro-reader folder
	let mokuroFolder = currentFolder.children?.find(
		(child: any) => child.name === 'mokuro-reader' && child.directory
	);

	if (!mokuroFolder) {
		mokuroFolder = await currentFolder.mkdir('mokuro-reader');
	}

	// Create/find series folder
	let seriesFolder = mokuroFolder.children?.find(
		(child: any) => child.name === seriesTitle && child.directory
	);

	if (!seriesFolder) {
		seriesFolder = await mokuroFolder.mkdir(seriesTitle);
	}

	// Upload file to series folder
	console.log(`Worker: Starting MEGA upload for ${filename}, size: ${cbzData.length} bytes`);

	try {
		// Upload returns a stream - don't pass onProgress as third param (not supported)
		const uploadStream = seriesFolder.upload({ name: filename, size: cbzData.length }, cbzData);

		// Wait for upload to complete and listen for progress events
		await new Promise<void>((resolve, reject) => {
			uploadStream.on('progress', (stats: any) => {
				console.log('Worker: MEGA progress event:', stats);
				// megajs progress: { bytesLoaded, bytesUploaded, bytesTotal }
				// Use bytesUploaded for actual upload progress to server
				const uploaded = stats?.bytesUploaded || stats?.loaded || 0;
				const total = stats?.bytesTotal || stats?.total || cbzData.length;
				onProgress(uploaded, total);
			});

			uploadStream.on('complete', () => {
				console.log('Worker: MEGA upload stream completed');
				resolve();
			});

			uploadStream.on('error', (err: any) => {
				console.error('Worker: MEGA upload stream error:', err);
				reject(err);
			});
		});

		// After upload completes, find the file in the folder's children
		// The file should now be in seriesFolder.children
		const uploadedFile = seriesFolder.children?.find(
			(child: any) => child.name === filename && !child.directory
		);

		if (!uploadedFile || !uploadedFile.nodeId) {
			console.error('Worker: Could not find uploaded file in folder children');
			throw new Error('MEGA upload succeeded but could not find uploaded file');
		}

		console.log(`Worker: MEGA upload complete, file ID: ${uploadedFile.nodeId}`);
		return uploadedFile.nodeId;
	} catch (error: any) {
		console.error('Worker: MEGA upload error:', error);
		throw new Error(`MEGA upload failed: ${error.message || error}`);
	}
}

/**
 * Main message handler
 */
ctx.addEventListener('message', async (event) => {
	const message = event.data as CompressAndUploadMessage;
	console.log('Worker: Received upload message', message.mode);

	try {
		const { volumeTitle, seriesTitle, metadata, filesData, provider, credentials } = message;

		// Phase 1: Compression (0-30%)
		let compressionProgress = 0;
		const cbzData = await compressVolume(volumeTitle, metadata, filesData, (completed, total) => {
			compressionProgress = (completed / total) * 30;
			const progressMessage: ProgressMessage = {
				type: 'progress',
				phase: 'compressing',
				progress: compressionProgress
			};
			ctx.postMessage(progressMessage);
		});

		// Phase 2: Upload (30-100%)
		let fileId: string;
		const filename = `${volumeTitle}.cbz`;

		if (provider === 'google-drive') {
			if (!credentials.accessToken || !credentials.seriesFolderId) {
				throw new Error('Missing Google Drive access token or series folder ID');
			}
			fileId = await uploadToGoogleDrive(
				cbzData,
				filename,
				credentials.seriesFolderId,
				credentials.accessToken,
				(loaded, total) => {
					const uploadProgress = 30 + (loaded / total) * 70;
					const progressMessage: ProgressMessage = {
						type: 'progress',
						phase: 'uploading',
						progress: uploadProgress
					};
					ctx.postMessage(progressMessage);
				}
			);
		} else if (provider === 'webdav') {
			if (!credentials.webdavUrl || !credentials.webdavUsername || !credentials.webdavPassword) {
				throw new Error('Missing WebDAV credentials');
			}
			fileId = await uploadToWebDAV(
				cbzData,
				filename,
				seriesTitle,
				credentials.webdavUrl,
				credentials.webdavUsername,
				credentials.webdavPassword,
				(loaded, total) => {
					const uploadProgress = 30 + (loaded / total) * 70;
					const progressMessage: ProgressMessage = {
						type: 'progress',
						phase: 'uploading',
						progress: uploadProgress
					};
					ctx.postMessage(progressMessage);
				}
			);
		} else if (provider === 'mega') {
			if (!credentials.megaEmail || !credentials.megaPassword) {
				throw new Error('Missing MEGA credentials');
			}
			fileId = await uploadToMEGA(
				cbzData,
				filename,
				seriesTitle,
				credentials.megaEmail,
				credentials.megaPassword,
				(loaded, total) => {
					const uploadProgress = 30 + (loaded / total) * 70;
					const progressMessage: ProgressMessage = {
						type: 'progress',
						phase: 'uploading',
						progress: uploadProgress
					};
					ctx.postMessage(progressMessage);
				}
			);
		} else {
			throw new Error(`Unsupported provider: ${provider}`);
		}

		// Send completion message
		const completeMessage: CompleteMessage = {
			type: 'complete',
			fileId
		};
		ctx.postMessage(completeMessage);

		console.log(`Worker: Backup complete for ${volumeTitle}`);
	} catch (error) {
		console.error('Worker: Error processing backup:', error);
		const errorMessage: ErrorMessage = {
			type: 'error',
			error: error instanceof Error ? error.message : String(error)
		};
		ctx.postMessage(errorMessage);
	}
});
