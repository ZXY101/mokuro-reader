import { derived, type Readable } from 'svelte/store';
import { tokenManager } from './token-manager';
import { driveFilesCache } from './drive-files-cache';

export interface DriveState {
	isAuthenticated: boolean;
	isCacheLoading: boolean;
	isCacheLoaded: boolean;
	isFullyConnected: boolean;
}

export const driveState: Readable<DriveState> = derived(
	[tokenManager.token, driveFilesCache.isFetchingState, driveFilesCache.cacheLoaded],
	([$token, $isFetching, $cacheLoaded]) => {
		const isAuthenticated = $token !== '';
		return {
			isAuthenticated,
			isCacheLoading: $isFetching,
			isCacheLoaded: $cacheLoaded,
			isFullyConnected: isAuthenticated && $cacheLoaded
		};
	}
);
