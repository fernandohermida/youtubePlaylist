import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SyncService } from '../src/services/sync.service';
import { OAuthClient } from '../src/auth/oauth-client';
import { loadConfig } from '../src/config/schema';
import { logger } from '../src/utils/logger';

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

    res.status(200).json(summary);
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('Sync job failed', error);

    res.status(500).json({
      success: false,
      executionTimeMs: executionTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
