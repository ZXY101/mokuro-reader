<script lang="ts">
  import { onMount } from 'svelte';
  import { derived } from 'svelte/store';
  import {
    processVolumeSpeedData,
    calculateReadingSpeedStats,
    getSeriesSpeedInfo,
    formatDuration,
    formatRelativeDate,
    type VolumeSpeedData
  } from '$lib/util/reading-speed-history';
  import { volumes, clearVolumeSpeedData } from '$lib/settings/volume-data';
  import { volumes as catalogStore } from '$lib/catalog';
  import { personalizedReadingSpeed } from '$lib/settings/reading-speed';
  import { Badge, Card, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, Button, Modal } from 'flowbite-svelte';
  import {
    AwardSolid,
    FireSolid,
    ClockSolid,
    BookSolid,
    ArrowUpOutline,
    ArrowDownOutline,
    ChartLineUpOutline,
    TrashBinSolid
  } from 'flowbite-svelte-icons';

  import type { VolumeMetadata } from '$lib/types';
  import Chart from 'chart.js/auto';

  // Reactive state
  let chartCanvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  let sortBy: 'date' | 'speed' | 'series' = 'date';
  let sortDirection: 'asc' | 'desc' = 'desc';

  // Delete confirmation modal
  let deleteModalOpen = false;
  let volumeToDelete: VolumeSpeedData | null = null;

  // Derived stores
  const volumeSpeedData = derived(
    [volumes, catalogStore],
    ([$volumes, $catalogStore]) => {
      const catalog = Object.values($catalogStore);
      return processVolumeSpeedData($volumes, catalog);
    }
  );

  const stats = derived(
    [volumeSpeedData, personalizedReadingSpeed],
    ([$volumeSpeedData, $personalizedSpeed]) => {
      return calculateReadingSpeedStats($volumeSpeedData, $personalizedSpeed.charsPerMinute);
    }
  );

  const seriesInfo = derived(volumeSpeedData, ($volumeSpeedData) => {
    return getSeriesSpeedInfo($volumeSpeedData);
  });

  // Sorted volume list
  const sortedVolumes = derived(volumeSpeedData, ($volumeSpeedData) => {
    let sorted = [...$volumeSpeedData];

    switch (sortBy) {
      case 'date':
        sorted.sort((a, b) => {
          const comparison = b.completionDate.getTime() - a.completionDate.getTime();
          return sortDirection === 'asc' ? -comparison : comparison;
        });
        break;
      case 'speed':
        sorted.sort((a, b) => {
          const comparison = b.charsPerMinute - a.charsPerMinute;
          return sortDirection === 'asc' ? -comparison : comparison;
        });
        break;
      case 'series':
        sorted.sort((a, b) => {
          const comparison = a.seriesTitle.localeCompare(b.seriesTitle);
          return sortDirection === 'asc' ? comparison : -comparison;
        });
        break;
    }

    return sorted;
  });

  function toggleSort(column: 'date' | 'speed' | 'series') {
    if (sortBy === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = column;
      sortDirection = 'desc';
    }
  }

  function createChart(data: VolumeSpeedData[]) {
    if (!chartCanvas || data.length === 0) return;

    // Destroy existing chart
    if (chart) {
      chart.destroy();
    }

    // Sort data by date (oldest first for chart)
    const sortedData = [...data].sort((a, b) => a.completionDate.getTime() - b.completionDate.getTime());

    // Generate colors for each series
    const seriesColors = new Map<string, string>();
    const colorPalette = [
      '#3b82f6', // blue
      '#ef4444', // red
      '#10b981', // green
      '#f59e0b', // amber
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
    ];

    let colorIndex = 0;
    sortedData.forEach(vol => {
      if (!seriesColors.has(vol.seriesId)) {
        seriesColors.set(vol.seriesId, colorPalette[colorIndex % colorPalette.length]);
        colorIndex++;
      }
    });

    // Calculate trend line (linear regression)
    const n = sortedData.length;
    const xValues = sortedData.map((_, i) => i);
    const yValues = sortedData.map(v => v.charsPerMinute);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const trendData = xValues.map(x => slope * x + intercept);

    chart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: sortedData.map(v => v.completionDate.toLocaleDateString()),
        datasets: [
          {
            label: 'Reading Speed',
            data: sortedData.map(v => v.charsPerMinute),
            backgroundColor: sortedData.map(v => seriesColors.get(v.seriesId) || '#3b82f6'),
            borderColor: sortedData.map(v => seriesColors.get(v.seriesId) || '#3b82f6'),
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            tension: 0.1,
            fill: false
          },
          {
            label: 'Trend',
            data: trendData,
            borderColor: 'rgba(156, 163, 175, 0.5)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: '#9ca3af',
              filter: (item) => item.text === 'Trend' // Only show trend in legend
            }
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#f3f4f6',
            bodyColor: '#d1d5db',
            borderColor: '#374151',
            borderWidth: 1,
            callbacks: {
              title: (items) => {
                const index = items[0].dataIndex;
                return sortedData[index].volumeTitle;
              },
              label: (context) => {
                if (context.datasetIndex === 1) return ''; // Skip trend line tooltip
                const index = context.dataIndex;
                const vol = sortedData[index];
                return [
                  `Series: ${vol.seriesTitle}`,
                  `Speed: ${Math.round(vol.charsPerMinute)} chars/min`,
                  `Date: ${formatRelativeDate(vol.completionDate)}`,
                  `Duration: ${formatDuration(vol.durationMinutes)}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: 'rgba(75, 85, 99, 0.2)'
            },
            ticks: {
              color: '#9ca3af',
              maxRotation: 45,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: 10
            }
          },
          y: {
            display: true,
            grid: {
              color: 'rgba(75, 85, 99, 0.2)'
            },
            ticks: {
              color: '#9ca3af',
              callback: (value) => `${value} cpm`
            },
            title: {
              display: true,
              text: 'Characters per Minute',
              color: '#9ca3af'
            }
          }
        }
      }
    });
  }

  // Update chart when data changes
  $: if (chartCanvas && $volumeSpeedData) {
    createChart($volumeSpeedData);
  }

  onMount(() => {
    return () => {
      if (chart) {
        chart.destroy();
      }
    };
  });

  function formatNumber(num: number): string {
    return new Intl.NumberFormat().format(Math.round(num));
  }

  function getBadgeColor(badge: string): string {
    switch (badge) {
      case 'Speed Demon': return 'red';
      case 'Consistent Reader': return 'blue';
      case 'Improving Fast': return 'green';
      case 'Marathon Reader': return 'purple';
      case 'Veteran Reader': return 'yellow';
      default: return 'dark';
    }
  }

  function getTrendIcon(trend: number) {
    if (trend > 10) return ArrowUpOutline;
    if (trend < -10) return ArrowDownOutline;
    return null;
  }

  function confirmDelete(volume: VolumeSpeedData) {
    volumeToDelete = volume;
    deleteModalOpen = true;
  }

  function deleteVolumeData() {
    if (!volumeToDelete) return;

    clearVolumeSpeedData(volumeToDelete.volumeId);

    deleteModalOpen = false;
    volumeToDelete = null;
  }
</script>

<svelte:head>
  <title>Reading Speed History</title>
</svelte:head>

<div class="p-4 min-h-[90svh] w-full mx-auto">
  <h1 class="text-3xl font-bold mb-6">Reading Speed History</h1>

  {#if $volumeSpeedData.length === 0}
    <!-- Empty State -->
    <Card class="text-center py-12">
      <BookSolid size="xl" class="mx-auto mb-4 text-gray-500" />
      <h2 class="text-xl font-semibold mb-2 text-gray-300">No Reading History Yet</h2>
      <p class="text-gray-400">
        Complete your first volume to start tracking your reading speed and progress!
      </p>
    </Card>
  {:else}
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 max-w-7xl">
      <!-- Current Speed -->
      <Card>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400 mb-1">Current Speed</p>
            <p class="text-2xl font-bold">{Math.round($stats.currentSpeed)}</p>
            <p class="text-xs text-gray-500">chars/min</p>
          </div>
          <FireSolid size="lg" class="text-orange-500" />
        </div>
      </Card>

      <!-- Average Speed -->
      <Card>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400 mb-1">Average Speed</p>
            <p class="text-2xl font-bold">{Math.round($stats.averageSpeed)}</p>
            <p class="text-xs text-gray-500">chars/min</p>
          </div>
          <ChartLineUpOutline size="lg" class="text-blue-500" />
        </div>
      </Card>

      <!-- Volumes Completed -->
      <Card>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400 mb-1">Volumes Completed</p>
            <p class="text-2xl font-bold">{$stats.volumesCompleted}</p>
            <p class="text-xs text-gray-500">{formatNumber($stats.totalCharsRead)} chars read</p>
          </div>
          <BookSolid size="lg" class="text-green-500" />
        </div>
      </Card>

      <!-- Total Time -->
      <Card>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-400 mb-1">Total Time</p>
            <p class="text-2xl font-bold">{formatDuration($stats.totalTimeMinutes)}</p>
            {#if $stats.speedTrend !== 0}
              <div class="flex items-center gap-1 text-xs mt-1">
                {#if getTrendIcon($stats.speedTrend)}
                  <svelte:component this={getTrendIcon($stats.speedTrend)} size="xs"
                    class={$stats.speedTrend > 0 ? 'text-green-500' : 'text-red-500'} />
                {/if}
                <span class={$stats.speedTrend > 0 ? 'text-green-500' : 'text-red-500'}>
                  {Math.abs(Math.round($stats.speedTrend))}% {$stats.speedTrendLabel}
                </span>
              </div>
            {/if}
          </div>
          <ClockSolid size="lg" class="text-purple-500" />
        </div>
      </Card>
    </div>

    <!-- Achievement Badges -->
    {#if $stats.badges.length > 0}
      <Card class="mb-6 max-w-7xl">
        <div class="flex items-center gap-2 flex-wrap">
          <AwardSolid size="md" class="text-yellow-500" />
          <span class="font-semibold">Achievements:</span>
          {#each $stats.badges as badge}
            <Badge color={getBadgeColor(badge)} large>{badge}</Badge>
          {/each}
        </div>
      </Card>
    {/if}

    <!-- Chart -->
    <Card class="mb-6 max-w-7xl">
      <h2 class="text-xl font-semibold mb-4">Reading Speed Over Time</h2>
      <div class="w-full" style="height: 600px;">
        <canvas bind:this={chartCanvas}></canvas>
      </div>
    </Card>

    <!-- Series Breakdown -->
    {#if $seriesInfo.length > 0}
      <Card class="mb-6 max-w-7xl">
        <h2 class="text-xl font-semibold mb-4">Speed by Series</h2>
        <div class="overflow-x-auto">
        <Table>
          <TableHead>
            <TableHeadCell>Series</TableHeadCell>
            <TableHeadCell>Volumes</TableHeadCell>
            <TableHeadCell>Avg Speed</TableHeadCell>
            <TableHeadCell>Improvement</TableHeadCell>
          </TableHead>
          <TableBody>
            {#each $seriesInfo as series}
              <TableBodyRow>
                <TableBodyCell>{series.seriesTitle}</TableBodyCell>
                <TableBodyCell>{series.volumeCount}</TableBodyCell>
                <TableBodyCell>{Math.round(series.averageSpeed)} cpm</TableBodyCell>
                <TableBodyCell>
                  {#if series.speedImprovement > 0}
                    <span class="text-green-500 flex items-center gap-1">
                      <ArrowUpOutline size="xs" />
                      +{Math.round(series.speedImprovement)}%
                    </span>
                  {:else if series.speedImprovement < 0}
                    <span class="text-red-500 flex items-center gap-1">
                      <ArrowDownOutline size="xs" />
                      {Math.round(series.speedImprovement)}%
                    </span>
                  {:else}
                    <span class="text-gray-500">-</span>
                  {/if}
                </TableBodyCell>
              </TableBodyRow>
            {/each}
          </TableBody>
        </Table>
        </div>
      </Card>
    {/if}

    <!-- Volume History -->
    <Card class="max-w-7xl">
      <h2 class="text-xl font-semibold mb-4">Completed Volumes</h2>

      <div class="overflow-x-auto">
      <Table hoverable={true}>
        <TableHead>
          <TableHeadCell class="cursor-pointer" on:click={() => toggleSort('date')}>
            Date {sortBy === 'date' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
          </TableHeadCell>
          <TableHeadCell class="cursor-pointer" on:click={() => toggleSort('series')}>
            Series {sortBy === 'series' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
          </TableHeadCell>
          <TableHeadCell>Volume</TableHeadCell>
          <TableHeadCell class="cursor-pointer" on:click={() => toggleSort('speed')}>
            Speed {sortBy === 'speed' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
          </TableHeadCell>
          <TableHeadCell>Duration</TableHeadCell>
          <TableHeadCell>Badges</TableHeadCell>
          <TableHeadCell>Actions</TableHeadCell>
        </TableHead>
        <TableBody>
          {#each $sortedVolumes as volume}
            <TableBodyRow>
              <TableBodyCell>
                <div class="text-sm">{formatRelativeDate(volume.completionDate)}</div>
                <div class="text-xs text-gray-500">{volume.completionDate.toLocaleDateString()}</div>
              </TableBodyCell>
              <TableBodyCell>{volume.seriesTitle}</TableBodyCell>
              <TableBodyCell>{volume.volumeTitle}</TableBodyCell>
              <TableBodyCell>
                <div class="flex flex-col">
                  <span class="font-semibold">{Math.round(volume.charsPerMinute)} cpm</span>
                  <span class="text-xs" class:text-green-500={volume.percentVsAverage > 0}
                        class:text-red-500={volume.percentVsAverage < 0}>
                    {volume.percentVsAverage > 0 ? '+' : ''}{Math.round(volume.percentVsAverage)}% vs avg
                  </span>
                </div>
              </TableBodyCell>
              <TableBodyCell>
                <div class="text-sm">{formatDuration(volume.durationMinutes)}</div>
                <div class="text-xs text-gray-500">{formatNumber(volume.charsRead)} chars</div>
              </TableBodyCell>
              <TableBodyCell>
                <div class="flex flex-wrap gap-1">
                  {#if volume.isPersonalBest}
                    <Badge color="yellow">Personal Best</Badge>
                  {/if}
                  {#if volume.isSlowest}
                    <Badge color="red">Slowest</Badge>
                  {/if}
                  {#if volume.isMilestone}
                    <Badge color="purple">#{volume.isMilestone}</Badge>
                  {/if}
                  {#if volume.percentVsSeriesAvg !== undefined}
                    {#if volume.percentVsSeriesAvg > 10}
                      <Badge color="green">Series Best</Badge>
                    {:else if volume.percentVsSeriesAvg < -10}
                      <Badge color="dark">Below Series Avg</Badge>
                    {/if}
                  {/if}
                </div>
              </TableBodyCell>
              <TableBodyCell>
                <Button size="xs" color="red" on:click={() => confirmDelete(volume)}>
                  <TrashBinSolid class="w-3 h-3" />
                </Button>
              </TableBodyCell>
            </TableBodyRow>
          {/each}
        </TableBody>
      </Table>
      </div>
    </Card>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<Modal bind:open={deleteModalOpen} size="xs" autoclose={false}>
  <div class="text-center">
    <TrashBinSolid size="lg" class="mx-auto mb-4 text-gray-400 dark:text-gray-200" />
    <h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
      Are you sure you want to delete reading data for<br />
      <span class="font-semibold">{volumeToDelete?.volumeTitle}</span>?
    </h3>
    <p class="mb-5 text-sm text-gray-400">
      This will permanently remove all progress, time, and speed data for this volume.
      This action cannot be undone.
    </p>
    <div class="flex justify-center gap-4">
      <Button color="red" on:click={deleteVolumeData}>
        Yes, delete
      </Button>
      <Button color="alternative" on:click={() => { deleteModalOpen = false; volumeToDelete = null; }}>
        Cancel
      </Button>
    </div>
  </div>
</Modal>

<style>
  :global(.dark) canvas {
    filter: brightness(0.95);
  }
</style>
