import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { SyncService } from '../src/services/sync.service';
import { YouTubeService } from '../src/services/youtube.service';
import { OAuthClient } from '../src/auth/oauth-client';
import { loadConfig } from '../src/config/schema';
import { logger } from '../src/utils/logger';
import { ReportFormatter, isReportEnabled } from '../src/utils/report-formatter';
import type { Channel, ChannelConfig, SyncSnapshot } from '../src/types';

function normalizeChannel(ch: ChannelConfig): Channel {
  return typeof ch === 'string' ? { id: ch } : { id: ch.id, name: ch.name };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info('Starting YouTube Live Playlist sync job');

    const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    const refreshToken = process.env.YOUTUBE_OAUTH_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      logger.error('OAuth environment variables not configured');
      res.status(500).json({
        success: false,
        error: 'OAuth credentials not configured. Please set YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET, and YOUTUBE_OAUTH_REFRESH_TOKEN.',
      });
      return;
    }

    const config = loadConfig();
    logger.info(`Loaded configuration with ${config.playlists.length} playlists`);

    const oauthClient = new OAuthClient({
      clientId,
      clientSecret,
      refreshToken,
    });

    const syncService = new SyncService(oauthClient);
    const results = await syncService.syncAllPlaylists(config);

    // Save snapshot to KV so the status page can read it without YouTube API calls
    try {
      const youtubeService = new YouTubeService(oauthClient);
      const ytItems = await youtubeService.getPlaylistsMetadata(
        config.playlists.map((p) => p.playlistId)
      );
      const metaMap = new Map(ytItems.map((item) => [item.id, item]));

      const snapshot: SyncSnapshot = {
        lastSyncAt: new Date().toISOString(),
        playlists: config.playlists.map((p, i) => {
          const yt = metaMap.get(p.playlistId);
          return {
            name: p.name,
            playlistId: p.playlistId,
            youtubeUrl: `https://www.youtube.com/playlist?list=${p.playlistId}`,
            thumbnailUrl: yt?.snippet.thumbnails.maxres?.url ?? yt?.snippet.thumbnails.high?.url ?? null,
            liveStreamsFound: results[i]?.liveStreamsFound ?? 0,
            channels: p.channels.map(normalizeChannel),
          };
        }),
      };
      await kv.set('sync_snapshot', snapshot);
      logger.info('Saved sync snapshot to KV');
    } catch (kvError) {
      logger.error('Failed to save snapshot to KV (non-fatal)', kvError);
    }

    const executionTime = Date.now() - startTime;
    const summary = {
      success: true,
      executionTimeMs: executionTime,
      totalPlaylists: config.playlists.length,
      results,
      summary: {
        totalLiveStreamsFound: results.reduce((sum, r) => sum + r.liveStreamsFound, 0),
        totalVideosAdded: results.reduce((sum, r) => sum + r.videosAdded, 0),
        totalVideosRemoved: results.reduce((sum, r) => sum + r.videosRemoved, 0),
        totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      },
    };

    logger.info('Sync job completed', summary);

    // Generate and log CLI-style report
    if (isReportEnabled()) {
      const report = ReportFormatter.formatSyncReport(summary);
      console.log('\n' + report + '\n');
    }

    res.status(200).json(summary);
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('Sync job failed', error);

    // Generate error report
    if (isReportEnabled()) {
      console.log('\n' + '='.repeat(80));
      console.log('         SYNC JOB FAILED');
      console.log('='.repeat(80));
      console.log(`Execution Time: ${(executionTime / 1000).toFixed(2)}s`);
      console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('='.repeat(80) + '\n');
    }

    res.status(500).json({
      success: false,
      executionTimeMs: executionTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
