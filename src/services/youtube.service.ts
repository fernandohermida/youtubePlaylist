import { APIClient } from '../utils/api-client';
import { OAuthClient } from '../auth/oauth-client';
import { logger } from '../utils/logger';
import type {
  LiveStream,
  PlaylistVideo,
  YouTubeSearchResponse,
  YouTubePlaylistItemsResponse,
} from '../types';

export class YouTubeService {
  private apiClient: APIClient;

  constructor(private oauthClient: OAuthClient) {
    this.apiClient = new APIClient(
      'https://www.googleapis.com/youtube/v3',
      30000,
      () => this.oauthClient.getValidAccessToken()
    );
  }

  async getChannelLiveStreams(channelId: string, channelName?: string): Promise<LiveStream[]> {
    try {
      const channelLabel = channelName ? `${channelName} (${channelId})` : channelId;
      logger.debug(`Fetching live streams for channel: ${channelLabel}`);

      const response = await this.apiClient.get<YouTubeSearchResponse>('/search', {
        part: 'snippet',
        channelId,
        eventType: 'live',
        type: 'video',
        maxResults: 50,
      });

      const liveStreams: LiveStream[] = response.items.map((item) => ({
        videoId: item.id.videoId,
        channelId: item.snippet.channelId,
        channelName: channelName,
        title: item.snippet.title,
        startedAt: item.snippet.publishedAt,
      }));

      logger.info(`Found ${liveStreams.length} live streams for channel ${channelLabel}`);
      return liveStreams;
    } catch (error) {
      const channelLabel = channelName ? `${channelName} (${channelId})` : channelId;
      logger.error(`Failed to fetch live streams for channel ${channelLabel}`, error);
      throw error;
    }
  }

  async getPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
    try {
      logger.debug(`Fetching videos from playlist: ${playlistId}`);

      const videos: PlaylistVideo[] = [];
      let pageToken: string | undefined = undefined;

      do {
        const params: Record<string, any> = {
          part: 'snippet',
          playlistId,
          maxResults: 50,
        };

        if (pageToken) {
          params.pageToken = pageToken;
        }

        const response = await this.apiClient.get<YouTubePlaylistItemsResponse>(
          '/playlistItems',
          params
        );

        const pageVideos: PlaylistVideo[] = response.items.map((item) => ({
          playlistItemId: item.id,
          videoId: item.snippet.resourceId.videoId,
        }));

        videos.push(...pageVideos);
        pageToken = response.nextPageToken;
      } while (pageToken);

      logger.info(`Found ${videos.length} videos in playlist ${playlistId}`);
      return videos;
    } catch (error) {
      logger.error(`Failed to fetch playlist videos for ${playlistId}`, error);
      throw error;
    }
  }

  async addVideoToPlaylist(playlistId: string, videoId: string, stream?: LiveStream): Promise<void> {
    try {
      logger.debug(`Adding video ${videoId} to playlist ${playlistId}`);

      await this.apiClient.post('/playlistItems?part=snippet', {
        snippet: {
          playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId,
          },
        },
      });

      if (stream?.channelName) {
        logger.info(
          `✓ Added: https://youtube.com/watch?v=${videoId} from ${stream.channelName} (https://youtube.com/channel/${stream.channelId})`
        );
      } else {
        logger.info(
          `✓ Added: https://youtube.com/watch?v=${videoId} (Channel: https://youtube.com/channel/${stream?.channelId || 'unknown'})`
        );
      }
    } catch (error) {
      const channelLabel = stream?.channelName ? `${stream.channelName} (${stream.channelId})` : stream?.channelId || 'unknown';
      logger.error(
        `Failed to add video ${videoId} from ${channelLabel} to playlist ${playlistId}`,
        error
      );
      throw error;
    }
  }

  async removeVideoFromPlaylist(playlistItemId: string): Promise<void> {
    try {
      logger.debug(`Removing playlist item ${playlistItemId}`);

      await this.apiClient.delete('/playlistItems', {
        id: playlistItemId,
      });

      logger.info(`Successfully removed playlist item ${playlistItemId}`);
    } catch (error) {
      logger.error(`Failed to remove playlist item ${playlistItemId}`, error);
      throw error;
    }
  }

  async batchAddVideos(
    playlistId: string,
    streams: LiveStream[]
  ): Promise<void> {
    logger.info(`Adding ${streams.length} videos to playlist ${playlistId}`);

    for (const stream of streams) {
      try {
        await this.addVideoToPlaylist(playlistId, stream.videoId, stream);
        await this.sleep(200);
      } catch (error) {
        const channelLabel = stream.channelName ? `${stream.channelName} (${stream.channelId})` : stream.channelId;
        logger.error(`Failed to add video ${stream.videoId} from ${channelLabel}, continuing with next`, error);
      }
    }
  }

  async batchRemoveVideos(playlistItemIds: string[]): Promise<void> {
    logger.info(`Removing ${playlistItemIds.length} videos from playlist`);

    for (const playlistItemId of playlistItemIds) {
      try {
        await this.removeVideoFromPlaylist(playlistItemId);
        await this.sleep(200);
      } catch (error) {
        logger.error(
          `Failed to remove playlist item ${playlistItemId}, continuing with next`,
          error
        );
      }
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
