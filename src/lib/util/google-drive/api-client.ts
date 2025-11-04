import { GOOGLE_DRIVE_CONFIG, type DriveFile } from './constants';
import { tokenManager } from './token-manager';

/**
 * Escapes special characters in file/folder names for use in Google Drive API queries.
 *
 * Google Drive query syntax requires:
 * - Backslashes to be escaped as \\
 * - Single quotes to be escaped as \'
 *
 * @param name The file or folder name to escape
 * @returns The escaped name safe for use in Drive API queries
 *
 * @example
 * escapeNameForDriveQuery("Haven't You Heard") // returns "Haven\'t You Heard"
 * escapeNameForDriveQuery("Path\\to\\file") // returns "Path\\\\to\\\\file"
 */
export function escapeNameForDriveQuery(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export class DriveApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly isNetworkError = false
  ) {
    super(message);
    this.name = 'DriveApiError';
  }
}

class DriveApiClient {
  private isInitialized = false;

  /**
   * Wait for gapi global to be available (loaded from script tag)
   */
  private async waitForGapi(): Promise<void> {
    if (typeof gapi !== 'undefined' && gapi?.load) return;

    console.log('⏳ Waiting for Google API (gapi) to load...');
    const maxWait = 10000; // 10 seconds
    const start = Date.now();

    while (typeof gapi === 'undefined' || !gapi?.load) {
      if (Date.now() - start > maxWait) {
        throw new Error('Timeout waiting for Google API (gapi) to load');
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log('✅ Google API (gapi) loaded');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Wait for gapi to be available first
    await this.waitForGapi();

    return new Promise((resolve, reject) => {
      gapi.load('client:picker', async () => {
        try {
          await gapi.client.init({
            apiKey: GOOGLE_DRIVE_CONFIG.API_KEY,
            discoveryDocs: [GOOGLE_DRIVE_CONFIG.DISCOVERY_DOC]
          });

          await tokenManager.initTokenClient();
          this.isInitialized = true;
          resolve();
        } catch (error) {
          reject(new DriveApiError('Failed to initialize Google Drive API', undefined, true));
        }
      });
    });
  }

  private async handleApiCall<T>(apiCall: () => Promise<T>, retryOnAuth = true): Promise<T> {
    try {
      return await apiCall();
    } catch (error: any) {
      console.error('Drive API error caught:', error);
      console.error('Error details - status:', error.status, 'message:', error.message);

      const isNetworkError = error.message?.toLowerCase().includes('network') ||
        error.message?.toLowerCase().includes('offline') ||
        error.status === 0;

      // Handle authentication errors
      if (!isNetworkError && (error.status === 401 || error.status === 403)) {
        console.log('API call failed with auth error, token may be expired');

        // Clear the expired token
        tokenManager.clearToken();

        // If retry is enabled and we haven't retried yet, prompt for re-auth
        if (retryOnAuth) {
          throw new DriveApiError(
            'Authentication expired. Please sign in again.',
            error.status,
            false
          );
        }
      }

      throw new DriveApiError(
        error.message || 'Unknown API error',
        error.status,
        isNetworkError
      );
    }
  }

  async listFiles(query: string, fields = 'files(id, name, mimeType)'): Promise<DriveFile[]> {
    return this.handleApiCall(async () => {
      const allFiles: DriveFile[] = [];
      let pageToken: string | undefined = undefined;

      do {
        const { result } = await gapi.client.drive.files.list({
          q: query,
          fields: `nextPageToken, ${fields}`,
          pageSize: 1000,
          pageToken
        });

        if (result.files) {
          allFiles.push(...(result.files as DriveFile[]));
        }

        pageToken = result.nextPageToken;
      } while (pageToken);

      return allFiles;
    });
  }

  async createFolder(name: string, parentId?: string): Promise<string> {
    return this.handleApiCall(async () => {
      const resource: any = {
        mimeType: GOOGLE_DRIVE_CONFIG.MIME_TYPES.FOLDER,
        name
      };

      if (parentId) {
        resource.parents = [parentId];
      }

      const { result } = await gapi.client.drive.files.create({
        resource,
        fields: 'id'
      });

      return result.id || '';
    });
  }

  async getFileContent(fileId: string): Promise<string> {
    return this.handleApiCall(async () => {
      const { body } = await gapi.client.drive.files.get({
        fileId,
        alt: 'media'
      });
      return body;
    });
  }

  async uploadFile(
    content: string,
    metadata: { name: string; mimeType: string; parents?: string[] },
    fileId?: string
  ): Promise<{ id: string }> {
    return this.handleApiCall(async () => {
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: metadata.mimeType }));
      form.append('file', new Blob([content], { type: metadata.mimeType }));

      const url = `https://www.googleapis.com/upload/drive/v3/files${fileId ? `/${fileId}` : ''}?uploadType=multipart`;
      const token = tokenManager.isAuthenticated() ? this.getCurrentToken() : null;

      if (!token) {
        throw new DriveApiError('No valid token available');
      }

      const response = await fetch(url, {
        method: fileId ? 'PATCH' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: form
      });

      if (!response.ok) {
        throw new DriveApiError(`Upload failed: ${response.statusText}`, response.status);
      }

      return await response.json();
    });
  }

  async trashFile(fileId: string): Promise<void> {
    return this.handleApiCall(async () => {
      await gapi.client.drive.files.update({
        fileId,
        resource: { trashed: true }
      });
    });
  }

  async deleteFile(fileId: string): Promise<void> {
    return this.handleApiCall(async () => {
      await gapi.client.drive.files.delete({
        fileId
      });
    });
  }

  async trashFiles(fileIds: string[]): Promise<void> {
    // Batch delete by trashing each file
    const promises = fileIds.map(fileId => this.trashFile(fileId));
    await Promise.all(promises);
  }

  /**
   * Check if the current user can edit a file
   * Returns false for viewer-only shared files
   */
  async canEditFile(fileId: string): Promise<boolean> {
    return this.handleApiCall(async () => {
      const { result } = await gapi.client.drive.files.get({
        fileId,
        fields: 'capabilities/canEdit'
      });
      return result.capabilities?.canEdit ?? false;
    });
  }

  /**
   * Get file metadata
   * @param fileId The file ID
   * @param fields Comma-separated list of fields to retrieve (e.g., 'description', 'name,description')
   */
  async getFileMetadata(fileId: string, fields: string): Promise<any> {
    return this.handleApiCall(async () => {
      const { result } = await gapi.client.drive.files.get({
        fileId,
        fields
      });
      return result;
    });
  }

  /**
   * Update a file's description field
   * Used to store verified series title for sideloaded files
   */
  async updateFileDescription(fileId: string, description: string): Promise<void> {
    return this.handleApiCall(async () => {
      await gapi.client.drive.files.update({
        fileId,
        resource: { description },
        fields: 'id,description'
      });
    });
  }

  private getCurrentToken(): string {
    let token = '';
    tokenManager.token.subscribe(value => { token = value; })();
    return token;
  }
}

export const driveApiClient = new DriveApiClient();
