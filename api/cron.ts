import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SyncService } from '../src/services/sync.service';
import { loadConfig } from '../src/config/schema';
import { logger } from '../src/utils/logger';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info('Starting YouTube Live Playlist sync job');

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      logger.error('YOUTUBE_API_KEY environment variable is not set');
      res.status(500).json({
        success: false,
        error: 'YOUTUBE_API_KEY not configured',
      });
      return;
    }

    const config = loadConfig();
    logger.info(`Loaded configuration with ${config.playlists.length} playlists`);

    const syncService = new SyncService(apiKey);
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
