// Universal worker for downloading and decompressing cloud volumes
// Worker downloads from provider and decompresses (Google Drive, WebDAV, MEGA)

import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader, getMimeType } from '@zip.js/zip.js';
import { File as MegaFile } from 'megajs';

// Define the worker context
const ctx: Worker = self as any;

interface VolumeMetadata {
	volumeUuid: string;
	cloudFileId: string;
	seriesTitle: string;
	volumeTitle: string;
	cloudModifiedTime?: string;
	cloudSize?: number;
}

interface DownloadAndDecompressMessage {
	mode: 'download-and-decompress';
	provider: 'google-drive' | 'webdav' | 'mega';
	fileId: string;
	fileName: string;
	credentials: ProviderCredentials;
	metadata?: VolumeMetadata;
}

interface DecompressOnlyMessage {
	mode: 'decompress-only';
	fileId: string;
	fileName: string;
	blob: ArrayBuffer;
	metadata?: VolumeMetadata;
}

type WorkerMessage = DownloadAndDecompressMessage | DecompressOnlyMessage;

interface ProviderCredentials {
	// Google Drive
	accessToken?: string;

	// WebDAV
	webdavUrl?: string;
	webdavUsername?: string;
	webdavPassword?: string;

	// MEGA
	megaShareUrl?: string;
}

interface ProgressMessage {
	type: 'progress';
	fileId: string;
	loaded: number;
	total: number;
}

interface CompleteMessage {
	type: 'complete';
	fileId: string;
	fileName: string;
	data: ArrayBuffer;
	entries: DecompressedEntry[];
	metadata?: VolumeMetadata;
}

interface ErrorMessage {
	type: 'error';
	fileId: string;
	error: string;
}

interface DecompressedEntry {
	filename: string;
	data: ArrayBuffer;
}

/**
 * Download from Google Drive using access token
 * Returns ArrayBuffer directly to avoid intermediate Blob creation and disk writes
 */
async function downloadFromGoogleDrive(
	fileId: string,
	accessToken: string,
	onProgress: (loaded: number, total: number) => void
): Promise<ArrayBuffer> {
	// First get the file size
	const sizeResponse = await fetch(
		`https://www.googleapis.com/drive/v3/files/${fileId}?fields=size`,
		{
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		}
	);

	if (!sizeResponse.ok) {
		throw new Error(`Failed to get file size: ${sizeResponse.statusText}`);
	}

	const sizeData = await sizeResponse.json();
	const totalSize = parseInt(sizeData.size, 10);

	// Now download the file with progress tracking
	const xhr = new XMLHttpRequest();
	xhr.open('GET', `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
	xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
	xhr.responseType = 'arraybuffer';

	return new Promise((resolve, reject) => {
		xhr.onprogress = (event) => {
			onProgress(event.loaded, totalSize);
		};

		xhr.onerror = () => reject(new Error('Network error during download'));
		xhr.ontimeout = () => reject(new Error('Download timed out'));
		xhr.onabort = () => reject(new Error('Download aborted'));

		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve(xhr.response as ArrayBuffer);
			} else {
				reject(new Error(`HTTP error ${xhr.status}: ${xhr.statusText}`));
			}
		};

		xhr.send();
	});
}

/**
 * Download from WebDAV server using Basic Auth
 * Returns ArrayBuffer directly to avoid intermediate Blob creation and disk writes
 */
async function downloadFromWebDAV(
	fileId: string,
	url: string,
	username: string,
	password: string,
	onProgress: (loaded: number, total: number) => void
): Promise<ArrayBuffer> {
	const fullUrl = `${url}${fileId}`;
	const authHeader = 'Basic ' + btoa(`${username}:${password}`);

	const response = await fetch(fullUrl, {
		headers: {
			'Authorization': authHeader
		}
	});

	if (!response.ok) {
		throw new Error(`WebDAV download failed: ${response.status} ${response.statusText}`);
	}

	const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);
	const reader = response.body?.getReader();

	if (!reader) {
		throw new Error('Response body is not readable');
	}

	const chunks: Uint8Array[] = [];
	let receivedLength = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		chunks.push(value);
		receivedLength += value.length;
		onProgress(receivedLength, contentLength || receivedLength);
	}

	// Combine chunks into a single ArrayBuffer
	const combinedLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
	const combined = new Uint8Array(combinedLength);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.length;
	}

	return combined.buffer;
}

/**
 * Download from MEGA using a share link via the MEGA API
 * The share link includes the decryption key, MEGA API handles download
 * Returns ArrayBuffer directly to avoid intermediate Blob creation and disk writes
 */
async function downloadFromMega(
	shareUrl: string,
	onProgress: (loaded: number, total: number) => void
): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		try {
			// Load file from share link using MEGA API
			const file = MegaFile.fromURL(shareUrl);

			// Load file metadata
			file.loadAttributes((error) => {
				if (error) {
					reject(new Error(`MEGA metadata failed: ${error.message}`));
					return;
				}

				const totalSize = file.size || 0;

				// Download file with progress tracking
				const stream = file.download();
				const chunks: Uint8Array[] = [];
				let loaded = 0;

				stream.on('data', (chunk: Uint8Array) => {
					chunks.push(chunk);
					loaded += chunk.length;
					onProgress(loaded, totalSize);
				});

				stream.on('end', () => {
					// Combine all chunks into a single ArrayBuffer
					const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
					const combined = new Uint8Array(totalLength);
					let offset = 0;
					for (const chunk of chunks) {
						combined.set(chunk, offset);
						offset += chunk.length;
					}

					resolve(combined.buffer);
				});

				stream.on('error', (error: Error) => {
					reject(new Error(`MEGA download failed: ${error.message}`));
				});
			});
		} catch (error) {
			reject(new Error(`MEGA initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
		}
	});
}

/**
 * Decompress a CBZ file from ArrayBuffer into entries
 * Keeps everything in memory without creating intermediate Blob objects
 */
async function decompressCbz(arrayBuffer: ArrayBuffer): Promise<DecompressedEntry[]> {
	console.log(`Worker: Decompressing CBZ...`);

	// Create a zip reader directly from ArrayBuffer
	const zipReader = new ZipReader(new Uint8ArrayReader(new Uint8Array(arrayBuffer)));

	// Get all entries from the zip file
	const entries = await zipReader.getEntries();

	// Process each entry
	const decompressedEntries: DecompressedEntry[] = [];

	for (const entry of entries) {
		// Skip directories
		if (entry.directory) continue;

		try {
			// Decompress directly to Uint8Array without creating intermediate Blob
			const uint8Array = await entry.getData!(new Uint8ArrayWriter());

			decompressedEntries.push({
				filename: entry.filename,
				data: uint8Array.buffer as ArrayBuffer
			});
		} catch (entryError) {
			console.error(`Worker: Error extracting entry ${entry.filename}:`, entryError);
		}
	}

	await zipReader.close();

	console.log(`Worker: Decompressed ${decompressedEntries.length} files`);
	return decompressedEntries;
}

/**
 * Main message handler
 */
ctx.addEventListener('message', async (event) => {
	const message = event.data as WorkerMessage;
	console.log('Worker: Received message', message.mode);

	try {
		let arrayBuffer: ArrayBuffer;
		let fileId: string;
		let fileName: string;
		let metadata: VolumeMetadata | undefined;

		if (message.mode === 'download-and-decompress') {
			// Mode 1: Download and decompress
			fileId = message.fileId;
			fileName = message.fileName;
			metadata = message.metadata;

			console.log(`Worker: Starting download for ${fileName} (${fileId})`);

			// Download based on provider - all return ArrayBuffer directly
			if (message.provider === 'google-drive') {
				if (!message.credentials.accessToken) {
					throw new Error('Missing access token for Google Drive');
				}
				arrayBuffer = await downloadFromGoogleDrive(
					fileId,
					message.credentials.accessToken,
					(loaded, total) => {
						const progressMessage: ProgressMessage = {
							type: 'progress',
							fileId,
							loaded,
							total
						};
						ctx.postMessage(progressMessage);
					}
				);
			} else if (message.provider === 'webdav') {
				if (!message.credentials.webdavUrl || !message.credentials.webdavUsername || !message.credentials.webdavPassword) {
					throw new Error('Missing WebDAV credentials');
				}
				arrayBuffer = await downloadFromWebDAV(
					fileId,
					message.credentials.webdavUrl,
					message.credentials.webdavUsername,
					message.credentials.webdavPassword,
					(loaded, total) => {
						const progressMessage: ProgressMessage = {
							type: 'progress',
							fileId,
							loaded,
							total
						};
						ctx.postMessage(progressMessage);
					}
				);
			} else if (message.provider === 'mega') {
				if (!message.credentials.megaShareUrl) {
					throw new Error('Missing MEGA share URL');
				}
				arrayBuffer = await downloadFromMega(
					message.credentials.megaShareUrl,
					(loaded, total) => {
						const progressMessage: ProgressMessage = {
							type: 'progress',
							fileId,
							loaded,
							total
						};
						ctx.postMessage(progressMessage);
					}
				);
			} else {
				throw new Error(`Unsupported provider: ${message.provider}`);
			}

			console.log(`Worker: Download complete for ${fileName}`);
		} else {
			// Mode 2: Decompress only (ArrayBuffer already downloaded by main thread)
			fileId = message.fileId;
			fileName = message.fileName;
			metadata = message.metadata;
			arrayBuffer = message.blob;
			console.log(`Worker: Received pre-downloaded data for ${fileName}`);
		}

		// Decompress the ArrayBuffer
		const entries = await decompressCbz(arrayBuffer);

		// Send completion message
		const completeMessage: CompleteMessage = {
			type: 'complete',
			fileId,
			fileName,
			data: new ArrayBuffer(0),
			entries,
			metadata
		};

		// Transfer ownership of ArrayBuffers to main thread
		const transferables = entries.map(entry => entry.data);
		ctx.postMessage(completeMessage, transferables);

		console.log(`Worker: Sent complete message for ${fileName}`);
	} catch (error) {
		console.error('Worker: Error processing message:', error);
		const errorMessage: ErrorMessage = {
			type: 'error',
			fileId: message.mode === 'download-and-decompress' ? message.fileId : (message as DecompressOnlyMessage).fileId,
			error: error instanceof Error ? error.message : String(error)
		};
		ctx.postMessage(errorMessage);
	}
});
