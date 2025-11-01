import type { VolumeMetadata } from '$lib/types';

export interface VolumeSpeedData {
	volumeId: string;
	volumeTitle: string;
	seriesTitle: string;
	seriesId: string;
	completionDate: Date;
	durationMinutes: number;
	charsRead: number;
	charsPerMinute: number;
	thumbnail?: string;

	// Badges
	isPersonalBest: boolean;
	isSlowest: boolean;
	percentVsAverage: number; // e.g., +15 or -5
	percentVsSeriesAvg?: number;
	isMilestone?: number; // 1, 5, 10, 25, 50, 100
}

export interface ReadingSpeedStats {
	totalTimeMinutes: number;
	averageSpeed: number;
	currentSpeed: number;
	volumesCompleted: number;
	totalCharsRead: number;
	speedTrend: number; // Percentage change
	speedTrendLabel: string; // "improving", "declining", "stable"

	// Achievements
	badges: string[];
}

export interface SeriesSpeedInfo {
	seriesId: string;
	seriesTitle: string;
	averageSpeed: number;
	volumeCount: number;
	speedImprovement: number; // First volume to latest
}

/**
 * Process volumes data into speed history data
 */
export function processVolumeSpeedData(
	volumesData: Record<string, any>,
	catalog: VolumeMetadata[]
): VolumeSpeedData[] {
	const completed: VolumeSpeedData[] = [];

	// Build a lookup map for catalog data
	const catalogMap = new Map<string, VolumeMetadata>();
	catalog.forEach((vol) => {
		catalogMap.set(vol.volume_uuid, vol);
	});

	// Filter out garbage dates (before 2005 - app didn't exist then)
	const EARLIEST_VALID_DATE = new Date('2005-01-01').getTime();

	// Process each completed volume
	// Follow same filtering rules as calculateReadingSpeed() in reading-speed.ts
	for (const [volumeId, data] of Object.entries(volumesData)) {
		// Must be marked as completed
		if (!data.completed) {
			continue;
		}

		// Must have character data
		if (data.chars === 0) {
			continue;
		}

		// Both legacy and new volumes have timeReadInMinutes
		// Legacy: 60-second granularity timer
		// New: Same field, but more accurate with session-based tracking
		const timeInMinutes = data.timeReadInMinutes || 0;

		// Must have time data
		if (timeInMinutes === 0) {
			continue;
		}

		// Calculate CPM and filter out unreasonably fast reads
		// This filters out volumes that were marked as read without actually reading them
		const cpm = data.chars / timeInMinutes;
		if (cpm <= 0 || cpm > 1000) {
			continue;
		}

		const completionDate = data.lastProgressUpdate
			? new Date(data.lastProgressUpdate)
			: new Date(0);

		// Filter out garbage dates (epoch tricks from before app existed)
		if (completionDate.getTime() < EARLIEST_VALID_DATE) {
			continue;
		}

		// Try to get catalog info, but allow volumes without it
		const volumeInfo = catalogMap.get(volumeId);

		// For volumes without catalog info, group them all together
		// under a single "[Missing Series Info]" entry
		const seriesId = volumeInfo?.series_uuid || 'missing-series-info';
		const seriesTitle = volumeInfo?.series_title || '[Missing Series Info]';

		completed.push({
			volumeId,
			// Use catalog data if available, otherwise use placeholders
			volumeTitle: volumeInfo?.volume_title || `Volume ${volumeId.slice(0, 8)}...`,
			seriesTitle,
			seriesId,
			completionDate,
			durationMinutes: timeInMinutes,
			charsRead: data.chars,
			charsPerMinute: cpm,
			thumbnail: volumeInfo?.thumbnail,
			isPersonalBest: false,
			isSlowest: false,
			percentVsAverage: 0
		});
	}

	// Sort by completion date (newest first)
	completed.sort((a, b) => b.completionDate.getTime() - a.completionDate.getTime());

	// Calculate average speed
	const avgSpeed = completed.reduce((sum, v) => sum + v.charsPerMinute, 0) / completed.length;

	// Find fastest and slowest
	const fastest = Math.max(...completed.map((v) => v.charsPerMinute));
	const slowest = Math.min(...completed.map((v) => v.charsPerMinute));

	// Assign badges and stats
	completed.forEach((vol, index) => {
		vol.isPersonalBest = vol.charsPerMinute === fastest;
		vol.isSlowest = vol.charsPerMinute === slowest;
		vol.percentVsAverage = ((vol.charsPerMinute - avgSpeed) / avgSpeed) * 100;

		// Milestone badges (1st, 5th, 10th, 25th, 50th, 100th from the END since sorted newest first)
		const position = completed.length - index;
		if ([1, 5, 10, 25, 50, 100].includes(position)) {
			vol.isMilestone = position;
		}
	});

	// Calculate series averages and assign series-level comparisons
	const seriesMap = new Map<string, VolumeSpeedData[]>();
	completed.forEach((vol) => {
		if (!seriesMap.has(vol.seriesId)) {
			seriesMap.set(vol.seriesId, []);
		}
		seriesMap.get(vol.seriesId)!.push(vol);
	});

	seriesMap.forEach((vols, seriesId) => {
		const seriesAvg = vols.reduce((sum, v) => sum + v.charsPerMinute, 0) / vols.length;
		vols.forEach((vol) => {
			vol.percentVsSeriesAvg = ((vol.charsPerMinute - seriesAvg) / seriesAvg) * 100;
		});
	});

	return completed;
}

/**
 * Calculate overall reading speed statistics
 */
export function calculateReadingSpeedStats(
	volumeData: VolumeSpeedData[],
	currentPersonalizedSpeed: number
): ReadingSpeedStats {
	if (volumeData.length === 0) {
		return {
			totalTimeMinutes: 0,
			averageSpeed: 0,
			currentSpeed: currentPersonalizedSpeed,
			volumesCompleted: 0,
			totalCharsRead: 0,
			speedTrend: 0,
			speedTrendLabel: 'stable',
			badges: []
		};
	}

	const totalTime = volumeData.reduce((sum, v) => sum + v.durationMinutes, 0);
	const totalChars = volumeData.reduce((sum, v) => sum + v.charsRead, 0);
	const avgSpeed = volumeData.reduce((sum, v) => sum + v.charsPerMinute, 0) / volumeData.length;

	// Calculate speed trend (compare recent 10 vs first 10)
	let speedTrend = 0;
	let speedTrendLabel = 'stable';

	if (volumeData.length >= 10) {
		// Most recent 10 (they're sorted newest first)
		const recent10 = volumeData.slice(0, 10);
		const recentAvg = recent10.reduce((sum, v) => sum + v.charsPerMinute, 0) / 10;

		// First 10 (last 10 in the array)
		const first10 = volumeData.slice(-10);
		const firstAvg = first10.reduce((sum, v) => sum + v.charsPerMinute, 0) / 10;

		speedTrend = ((recentAvg - firstAvg) / firstAvg) * 100;

		if (speedTrend > 10) {
			speedTrendLabel = 'improving';
		} else if (speedTrend < -10) {
			speedTrendLabel = 'declining';
		}
	}

	// Calculate badges/achievements
	const badges: string[] = [];

	// Speed-based achievements (reading speed in chars/min)
  if (currentPersonalizedSpeed > 50) {
    badges.push('⅛ Native');
  }
  if (currentPersonalizedSpeed > 100) {
    badges.push('¼ Native');
  }
  if (currentPersonalizedSpeed > 150) {
    badges.push('⅜ Native');
  }
  if (currentPersonalizedSpeed > 200) {
    badges.push('½ Native');
  }
  if (currentPersonalizedSpeed > 250) {
    badges.push('⅝ Native');
  }
  if (currentPersonalizedSpeed > 300) {
    badges.push('¾ Native');
  }
  if (currentPersonalizedSpeed > 350) {
    badges.push('⅞ Native');
  }
  if (currentPersonalizedSpeed > 400) {
    badges.push('Native');
  }
  if (currentPersonalizedSpeed > 600) {
    badges.push('Speed Reader');
  }
  if (currentPersonalizedSpeed > 800) {
    badges.push('Speed Demon');
  }

	// Volume count achievements
	if (volumeData.length >= 5) {
		badges.push('Getting Started');
	}
	if (volumeData.length >= 10) {
		badges.push('Consistent Reader');
	}
	if (volumeData.length >= 25) {
		badges.push('Dedicated Reader');
	}
  if (volumeData.length >= 50) {
    badges.push('Veteran Reader');
  }
	if (volumeData.length >= 100) {
		badges.push('Century Club');
	}
	if (volumeData.length >= 250) {
		badges.push('Master Reader');
	}
	if (volumeData.length >= 500) {
		badges.push('Bookworm');
	}
	if (volumeData.length >= 1000) {
		badges.push('Librarian');
	}

	// Character count achievements
	if (totalChars >= 100000) {
		badges.push('100K Characters');
	}
	if (totalChars >= 500000) {
		badges.push('Half Million');
	}
	if (totalChars >= 1000000) {
		badges.push('Million Character Club');
	}
	if (totalChars >= 2500000) {
		badges.push('2.5 Million Club');
	}
	if (totalChars >= 5000000) {
		badges.push('5 Million Club');
	}
	if (totalChars >= 10000000) {
		badges.push('Ten Million Club');
	}

	// Time-based achievements
	const totalHours = totalTime / 60;
	if (totalHours >= 10) {
		badges.push('10 Hour Reader');
	}
	if (totalHours >= 50) {
		badges.push('50 Hour Reader');
	}
	if (totalHours >= 100) {
		badges.push('Marathon Reader');
	}
	if (totalHours >= 500) {
		badges.push('Epic Reader');
	}
	if (totalHours >= 1000) {
		badges.push('Legendary Reader');
	}

	// Trend-based achievements
	if (speedTrend > 20) {
		badges.push('Improving Fast');
	}
	if (speedTrend < -20) {
		badges.push('Needs Practice');
	}

	return {
		totalTimeMinutes: totalTime,
		averageSpeed: avgSpeed,
		currentSpeed: currentPersonalizedSpeed,
		volumesCompleted: volumeData.length,
		totalCharsRead: totalChars,
		speedTrend,
		speedTrendLabel,
		badges
	};
}

/**
 * Get series-level speed information
 */
export function getSeriesSpeedInfo(volumeData: VolumeSpeedData[]): SeriesSpeedInfo[] {
	const seriesMap = new Map<string, VolumeSpeedData[]>();

	volumeData.forEach((vol) => {
		if (!seriesMap.has(vol.seriesId)) {
			seriesMap.set(vol.seriesId, []);
		}
		seriesMap.get(vol.seriesId)!.push(vol);
	});

	const seriesInfo: SeriesSpeedInfo[] = [];

	seriesMap.forEach((vols, seriesId) => {
		if (vols.length === 0) return;

		const avgSpeed = vols.reduce((sum, v) => sum + v.charsPerMinute, 0) / vols.length;

		// Sort by completion date to find first and last
		const sorted = [...vols].sort((a, b) => a.completionDate.getTime() - b.completionDate.getTime());
		const firstSpeed = sorted[0].charsPerMinute;
		const lastSpeed = sorted[sorted.length - 1].charsPerMinute;
		const improvement = ((lastSpeed - firstSpeed) / firstSpeed) * 100;

		seriesInfo.push({
			seriesId,
			seriesTitle: vols[0].seriesTitle,
			averageSpeed: avgSpeed,
			volumeCount: vols.length,
			speedImprovement: improvement
		});
	});

	// Sort by average speed (descending)
	seriesInfo.sort((a, b) => b.averageSpeed - a.averageSpeed);

	return seriesInfo;
}

/**
 * Format duration in a human-readable way
 */
export function formatDuration(minutes: number): string {
	if (minutes < 60) {
		return `${Math.round(minutes)} min`;
	}

	const hours = Math.floor(minutes / 60);
	const mins = Math.round(minutes % 60);

	if (mins === 0) {
		return `${hours}h`;
	}

	return `${hours}h ${mins}m`;
}

/**
 * Format a relative date
 */
export function formatRelativeDate(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		return 'Today';
	} else if (diffDays === 1) {
		return 'Yesterday';
	} else if (diffDays < 7) {
		return `${diffDays} days ago`;
	} else if (diffDays < 30) {
		const weeks = Math.floor(diffDays / 7);
		return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
	} else if (diffDays < 365) {
		const months = Math.floor(diffDays / 30);
		return months === 1 ? '1 month ago' : `${months} months ago`;
	} else {
		const years = Math.floor(diffDays / 365);
		return years === 1 ? '1 year ago' : `${years} years ago`;
	}
}
