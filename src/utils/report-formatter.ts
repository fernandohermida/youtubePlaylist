import type { SyncResult } from '../types';

export interface SyncSummary {
  success: boolean;
  executionTimeMs: number;
  totalPlaylists: number;
  results: SyncResult[];
  summary: {
    totalLiveStreamsFound: number;
    totalVideosAdded: number;
    totalVideosRemoved: number;
    totalErrors: number;
  };
}

export class ReportFormatter {
  private static readonly LINE_WIDTH = 80;
  private static readonly DOUBLE_LINE = '='.repeat(ReportFormatter.LINE_WIDTH);
  private static readonly SINGLE_LINE = '-'.repeat(ReportFormatter.LINE_WIDTH);

  /**
   * Format execution summary for Vercel logs
   */
  static formatSyncReport(data: SyncSummary): string {
    const sections: string[] = [];

    // Header
    sections.push(this.DOUBLE_LINE);
    sections.push(this.centerText('YOUTUBE LIVE PLAYLIST SYNC REPORT'));
    sections.push(this.DOUBLE_LINE);

    // Executive Summary
    sections.push(this.formatExecutiveSummary(data));
    sections.push('');

    // Per-Playlist Details
    data.results.forEach((result, index) => {
      sections.push(this.formatPlaylistResult(result));
      if (index < data.results.length - 1) {
        sections.push('');
      }
    });

    // Footer
    sections.push(this.DOUBLE_LINE);
    sections.push(this.centerText('END OF REPORT'));
    sections.push(this.DOUBLE_LINE);

    return sections.join('\n');
  }

  private static formatExecutiveSummary(data: SyncSummary): string {
    const executionTimeSec = (data.executionTimeMs / 1000).toFixed(2);
    const status = data.success ? 'SUCCESS' : 'FAILED';

    return [
      `Execution Time: ${executionTimeSec}s`,
      `Status: ${status}`,
      `Total Playlists: ${data.totalPlaylists}`,
      `Total Live Streams Found: ${data.summary.totalLiveStreamsFound}`,
      `Total Videos Added: ${data.summary.totalVideosAdded}`,
      `Total Videos Removed: ${data.summary.totalVideosRemoved}`,
      `Total Errors: ${data.summary.totalErrors}`,
    ].join('\n');
  }

  private static formatPlaylistResult(result: SyncResult): string {
    const sections: string[] = [];

    // Playlist header
    sections.push(this.SINGLE_LINE);
    sections.push(`PLAYLIST: ${result.playlistName}`);
    sections.push(this.SINGLE_LINE);
    sections.push(`Live Streams Found: ${result.liveStreamsFound}`);
    sections.push(`Videos Added: ${result.videosAdded}`);
    sections.push(`Videos Removed: ${result.videosRemoved}`);
    sections.push('');

    // Added videos
    if (result.addedVideos && result.addedVideos.length > 0) {
      sections.push('  [+] ADDED:');
      result.addedVideos.forEach((video) => {
        sections.push(this.formatVideoDetail(video, '      '));
      });
      sections.push('');
    }

    // Removed videos
    if (result.removedVideos && result.removedVideos.length > 0) {
      sections.push('  [-] REMOVED:');
      result.removedVideos.forEach((video) => {
        sections.push(this.formatVideoDetail(video, '      ', true));
      });
      sections.push('');
    }

    // Errors
    if (result.errors.length > 0) {
      sections.push(`Errors: ${result.errors.length}`);
      result.errors.forEach((error) => {
        sections.push(`  ! ${error}`);
      });
    } else {
      sections.push('Errors: None');
    }

    return sections.join('\n');
  }

  private static formatVideoDetail(
    video: { videoId: string; title?: string; channelId?: string; channelName?: string },
    indent: string,
    isRemoval: boolean = false
  ): string {
    const lines: string[] = [];

    if (video.title && video.channelName) {
      lines.push(`${indent}* "${video.title}" by ${video.channelName} (${video.channelId || 'unknown'})`);
      lines.push(`${indent}  https://youtube.com/watch?v=${video.videoId}`);
      if (video.channelId) {
        lines.push(`${indent}  Channel: https://youtube.com/channel/${video.channelId}`);
      }
    } else if (isRemoval) {
      // For removals, we often don't have full details
      lines.push(`${indent}* Video ID: ${video.videoId} (Stream ended)`);
    } else {
      // Fallback for additions without full details
      lines.push(`${indent}* Video ID: ${video.videoId}`);
      lines.push(`${indent}  https://youtube.com/watch?v=${video.videoId}`);
    }

    return lines.join('\n');
  }

  private static centerText(text: string): string {
    const padding = Math.max(0, Math.floor((this.LINE_WIDTH - text.length) / 2));
    return ' '.repeat(padding) + text;
  }
}

/**
 * Check if sync report is enabled via environment variable
 */
export function isReportEnabled(): boolean {
  const envValue = process.env.ENABLE_SYNC_REPORT;
  // Default to true if not set
  if (envValue === undefined || envValue === '') {
    return true;
  }
  return envValue.toLowerCase() === 'true';
}
