import { YouTubeService } from './youtube.service';
import { OAuthClient } from '../auth/oauth-client';
import { arrayDiff } from '../utils/diff';
import { logger } from '../utils/logger';
import type { AppConfig, PlaylistConfig, SyncResult, LiveStream, PlaylistVideo } from '../types';

export class SyncService {
  private youtubeService: YouTubeService;

  constructor(oauthClient: OAuthClient) {
    this.youtubeService = new YouTubeService(oauthClient);
  }

  async syncAllPlaylists(config: AppConfig): Promise<SyncResult[]> {
    logger.info(`Starting sync for ${config.playlists.length} playlists`);

    const results: SyncResult[] = [];

    for (const playlistConfig of config.playlists) {
      try {
        const result = await this.syncPlaylist(playlistConfig);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to sync playlist: ${playlistConfig.name}`, error);
        results.push({
          playlistName: playlistConfig.name,
          liveStreamsFound: 0,
          videosAdded: 0,
          videosRemoved: 0,
          errors: [`Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`],
        });
      }
    }

    return results;
  }

  private async syncPlaylist(config: PlaylistConfig): Promise<SyncResult> {
    logger.info(`Syncing playlist: ${config.name}`);

    const result: SyncResult = {
      playlistName: config.name,
      liveStreamsFound: 0,
      videosAdded: 0,
      videosRemoved: 0,
      errors: [],
    };

    const liveStreams = await this.discoverLiveStreams(config.channels);
    result.liveStreamsFound = liveStreams.length;

    logger.info(`Found ${liveStreams.length} live streams for ${config.name}`);

    const currentVideos = await this.youtubeService.getPlaylistVideos(config.playlistId);

    const liveVideoIds = liveStreams.map((stream) => stream.videoId);

    const diff = arrayDiff<PlaylistVideo>(
      currentVideos,
      liveVideoIds.map((id) => ({ playlistItemId: '', videoId: id })),
      (item) => item.videoId
    );

    logger.info(
      `Sync diff for ${config.name}: ${diff.toAdd.length} to add, ${diff.toRemove.length} to remove`
    );

    if (diff.toAdd.length > 0) {
      const videoIdsToAdd = diff.toAdd.map((v) => v.videoId);
      await this.youtubeService.batchAddVideos(config.playlistId, videoIdsToAdd);
      result.videosAdded = videoIdsToAdd.length;
    }

    if (diff.toRemove.length > 0) {
      const playlistItemIdsToRemove = diff.toRemove.map((v) => v.playlistItemId);
      await this.youtubeService.batchRemoveVideos(playlistItemIdsToRemove);
      result.videosRemoved = playlistItemIdsToRemove.length;
    }

    logger.info(
      `Sync completed for ${config.name}: ${result.videosAdded} added, ${result.videosRemoved} removed`
    );

    return result;
  }

  private async discoverLiveStreams(channelIds: string[]): Promise<LiveStream[]> {
    logger.debug(`Discovering live streams from ${channelIds.length} channels`);

    const allLiveStreams: LiveStream[] = [];

    for (const channelId of channelIds) {
      try {
        const liveStreams = await this.youtubeService.getChannelLiveStreams(channelId);
        allLiveStreams.push(...liveStreams);
      } catch (error) {
        logger.error(`Failed to fetch live streams for channel ${channelId}`, error);
      }
    }

    return this.deduplicateStreams(allLiveStreams);
  }

  private deduplicateStreams(streams: LiveStream[]): LiveStream[] {
    const seen = new Set<string>();
    const unique: LiveStream[] = [];

    for (const stream of streams) {
      if (!seen.has(stream.videoId)) {
        seen.add(stream.videoId);
        unique.push(stream);
      }
    }

    return unique;
  }
}
