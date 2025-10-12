import { browser } from '$app/environment';
import type { SyncProvider, ProviderCredentials, ProviderStatus } from '../../provider-interface';
import { ProviderError } from '../../provider-interface';
import { Storage } from 'megajs';

interface MegaCredentials {
	email: string;
	password: string;
}

const STORAGE_KEYS = {
	EMAIL: 'mega_email',
	PASSWORD: 'mega_password',
	FOLDER_PATH: 'mega_folder_path'
};

const MOKURO_FOLDER = 'mokuro-reader';
const VOLUME_DATA_FILE = 'volume-data.json';
const PROFILES_FILE = 'profiles.json';

export class MegaProvider implements SyncProvider {
	readonly type = 'mega' as const;
	readonly name = 'MEGA';

	private storage: any = null;
	private mokuroFolder: any = null;

	constructor() {
		if (browser) {
			this.loadPersistedCredentials();
		}
	}

	isAuthenticated(): boolean {
		return this.storage !== null;
	}

	getStatus(): ProviderStatus {
		return {
			isAuthenticated: this.isAuthenticated(),
			needsAttention: false,
			statusMessage: this.isAuthenticated() ? 'Connected to MEGA' : 'Not connected'
		};
	}

	async login(credentials?: ProviderCredentials): Promise<void> {
		if (!credentials || !credentials.email || !credentials.password) {
			throw new ProviderError('Email and password are required', 'mega', 'INVALID_CREDENTIALS');
		}

		const { email, password } = credentials as MegaCredentials;

		try {
			// Initialize MEGA storage
			this.storage = await new Promise((resolve, reject) => {
				const storage = new Storage(
					{
						email,
						password
					},
					(error: Error | null) => {
						if (error) {
							reject(error);
						} else {
							resolve(storage);
						}
					}
				);
			});

			// Wait for storage to be ready
			await this.waitForReady();

			// Ensure mokuro folder exists
			await this.ensureMokuroFolder();

			// Store credentials in localStorage
			if (browser) {
				localStorage.setItem(STORAGE_KEYS.EMAIL, email);
				localStorage.setItem(STORAGE_KEYS.PASSWORD, password);
			}

			console.log('✅ MEGA login successful');
		} catch (error) {
			this.storage = null;
			this.mokuroFolder = null;

			throw new ProviderError(
				`MEGA login failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'mega',
				'LOGIN_FAILED',
				true
			);
		}
	}

	async logout(): Promise<void> {
		this.storage = null;
		this.mokuroFolder = null;

		if (browser) {
			localStorage.removeItem(STORAGE_KEYS.EMAIL);
			localStorage.removeItem(STORAGE_KEYS.PASSWORD);
			localStorage.removeItem(STORAGE_KEYS.FOLDER_PATH);
		}

		console.log('MEGA logged out');
	}

	async uploadVolumeData(data: any): Promise<void> {
		if (!this.isAuthenticated()) {
			throw new ProviderError('Not authenticated', 'mega', 'NOT_AUTHENTICATED', true);
		}

		try {
			await this.ensureMokuroFolder();
			const content = JSON.stringify(data);
			await this.uploadFile(VOLUME_DATA_FILE, content);
			console.log('✅ Volume data uploaded to MEGA');
		} catch (error) {
			throw new ProviderError(
				`Failed to upload volume data: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'mega',
				'UPLOAD_FAILED',
				false,
				true
			);
		}
	}

	async downloadVolumeData(): Promise<any | null> {
		if (!this.isAuthenticated()) {
			throw new ProviderError('Not authenticated', 'mega', 'NOT_AUTHENTICATED', true);
		}

		try {
			await this.ensureMokuroFolder();
			const content = await this.downloadFile(VOLUME_DATA_FILE);
			if (!content) return null;

			return JSON.parse(content);
		} catch (error) {
			// File not found is not an error, just return null
			if (error instanceof Error && error.message.includes('not found')) {
				return null;
			}

			throw new ProviderError(
				`Failed to download volume data: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'mega',
				'DOWNLOAD_FAILED',
				false,
				true
			);
		}
	}

	async uploadProfiles(data: any): Promise<void> {
		if (!this.isAuthenticated()) {
			throw new ProviderError('Not authenticated', 'mega', 'NOT_AUTHENTICATED', true);
		}

		try {
			await this.ensureMokuroFolder();
			const content = JSON.stringify(data);
			await this.uploadFile(PROFILES_FILE, content);
			console.log('✅ Profiles uploaded to MEGA');
		} catch (error) {
			throw new ProviderError(
				`Failed to upload profiles: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'mega',
				'UPLOAD_FAILED',
				false,
				true
			);
		}
	}

	async downloadProfiles(): Promise<any | null> {
		if (!this.isAuthenticated()) {
			throw new ProviderError('Not authenticated', 'mega', 'NOT_AUTHENTICATED', true);
		}

		try {
			await this.ensureMokuroFolder();
			const content = await this.downloadFile(PROFILES_FILE);
			if (!content) return null;

			return JSON.parse(content);
		} catch (error) {
			// File not found is not an error, just return null
			if (error instanceof Error && error.message.includes('not found')) {
				return null;
			}

			throw new ProviderError(
				`Failed to download profiles: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'mega',
				'DOWNLOAD_FAILED',
				false,
				true
			);
		}
	}

	private async loadPersistedCredentials(): Promise<void> {
		if (!browser) return;

		const email = localStorage.getItem(STORAGE_KEYS.EMAIL);
		const password = localStorage.getItem(STORAGE_KEYS.PASSWORD);

		if (email && password) {
			try {
				await this.login({ email, password });
				console.log('Restored MEGA session from stored credentials');
			} catch (error) {
				console.error('Failed to restore MEGA session:', error);
				// Clear invalid credentials
				this.logout();
			}
		}
	}

	private waitForReady(): Promise<void> {
		return new Promise((resolve, reject) => {
			// If storage is already ready, resolve immediately
			if (this.storage.ready) {
				resolve();
				return;
			}

			// Wait for ready event
			const timeout = setTimeout(() => {
				reject(new Error('Timeout waiting for MEGA storage to be ready'));
			}, 30000); // 30 second timeout

			this.storage.once('ready', () => {
				clearTimeout(timeout);
				resolve();
			});

			// Also listen for error events
			this.storage.once('error', (error: Error) => {
				clearTimeout(timeout);
				reject(error);
			});
		});
	}

	private async ensureMokuroFolder(): Promise<void> {
		if (this.mokuroFolder) return;

		try {
			// Access root folder using storage.files object
			// In megajs, all files are available via storage.files
			const files = Object.values(this.storage.files || {});

			// Find root folder (has no parent)
			const rootFiles = files.filter((f: any) => !f.parent && f.directory);

			// Find mokuro-reader folder in root
			let mokuroFolder = files.find(
				(f: any) => f.name === MOKURO_FOLDER && f.directory && !f.parent
			);

			if (!mokuroFolder) {
				// Create folder using storage.mkdir
				mokuroFolder = await this.createFolder(MOKURO_FOLDER);
				console.log('Created mokuro-reader folder in MEGA');
			}

			this.mokuroFolder = mokuroFolder;
		} catch (error) {
			console.error('ensureMokuroFolder error:', error);
			throw new ProviderError(
				`Failed to ensure mokuro folder exists: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'mega',
				'FOLDER_ERROR'
			);
		}
	}

	private listFolder(folder: any): Promise<any[]> {
		return new Promise((resolve, reject) => {
			// Get all files from storage
			const files = Object.values(this.storage.files || {});

			// Filter files that are children of this folder
			const children = files.filter((f: any) => f.parent === folder);
			resolve(children);
		});
	}

	private createFolder(name: string): Promise<any> {
		return new Promise((resolve, reject) => {
			this.storage.mkdir(name, (error: Error | null, folder: any) => {
				if (error) {
					reject(error);
				} else {
					resolve(folder);
				}
			});
		});
	}

	private async uploadFile(filename: string, content: string): Promise<void> {
		await this.ensureMokuroFolder();

		return new Promise(async (resolve, reject) => {
			try {
				// Check if file already exists using storage.files
				const children = await this.listFolder(this.mokuroFolder);
				const existingFile = children.find((f: any) => f.name === filename && !f.directory);

				const uploadNew = () => {
					// Convert string to Uint8Array (browser-compatible)
					const encoder = new TextEncoder();
					const contentBuffer = encoder.encode(content);

					this.mokuroFolder.upload(
						{
							name: filename,
							size: contentBuffer.length
						},
						contentBuffer,
						(error: Error | null) => {
							if (error) reject(error);
							else resolve();
						}
					);
				};

				if (existingFile) {
					// Delete existing file first
					existingFile.delete(true, (deleteError: Error | null) => {
						if (deleteError) {
							reject(deleteError);
						} else {
							uploadNew();
						}
					});
				} else {
					uploadNew();
				}
			} catch (error) {
				reject(error);
			}
		});
	}

	private async downloadFile(filename: string): Promise<string | null> {
		await this.ensureMokuroFolder();

		const children = await this.listFolder(this.mokuroFolder);
		const file = children.find((f: any) => f.name === filename && !f.directory);

		if (!file) {
			return null;
		}

		return new Promise((resolve, reject) => {
			file.download((error: Error | null, data: Uint8Array) => {
				if (error) {
					reject(error);
				} else {
					// Convert Uint8Array to string (browser-compatible)
					const decoder = new TextDecoder('utf-8');
					const text = decoder.decode(data);
					resolve(text);
				}
			});
		});
	}
}

export const megaProvider = new MegaProvider();
