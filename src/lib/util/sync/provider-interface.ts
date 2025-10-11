/**
 * Sync Provider Interface
 *
 * Defines the contract that all sync providers (Google Drive, MEGA, WebDAV) must implement.
 * This allows for a unified sync experience across different cloud storage backends.
 */

export type ProviderType = 'google-drive' | 'mega' | 'webdav';

export interface ProviderStatus {
	isAuthenticated: boolean;
	needsAttention: boolean;
	statusMessage: string;
}

export interface ProviderCredentials {
	// Google Drive: not used (OAuth)
	// MEGA: { email: string, password: string }
	// WebDAV: { serverUrl: string, username: string, password: string }
	[key: string]: any;
}

export interface SyncProvider {
	/** Provider type identifier */
	readonly type: ProviderType;

	/** Human-readable provider name */
	readonly name: string;

	/** Check if user is currently authenticated */
	isAuthenticated(): boolean;

	/** Get current provider status */
	getStatus(): ProviderStatus;

	/**
	 * Authenticate with the provider
	 * @param credentials Provider-specific credentials
	 */
	login(credentials?: ProviderCredentials): Promise<void>;

	/** Logout and clear stored credentials */
	logout(): Promise<void>;

	/**
	 * Upload volume data (read progress)
	 * @param data Volume data object to upload
	 */
	uploadVolumeData(data: any): Promise<void>;

	/**
	 * Download volume data (read progress)
	 * @returns Volume data object or null if not found
	 */
	downloadVolumeData(): Promise<any | null>;

	/**
	 * Upload profile data
	 * @param data Profile data object to upload
	 */
	uploadProfiles(data: any): Promise<void>;

	/**
	 * Download profile data
	 * @returns Profile data object or null if not found
	 */
	downloadProfiles(): Promise<any | null>;
}

export class ProviderError extends Error {
	constructor(
		message: string,
		public readonly providerType: ProviderType,
		public readonly code?: string,
		public readonly isAuthError: boolean = false,
		public readonly isNetworkError: boolean = false
	) {
		super(message);
		this.name = 'ProviderError';
	}
}
