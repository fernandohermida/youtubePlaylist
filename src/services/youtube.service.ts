import { APIClient } from '../utils/api-client';
import { OAuthClient } from '../auth/oauth-client';
import { logger } from '../utils/logger';
import type {
  LiveStream,
  PlaylistVideo,
  YouTubeSearchResponse,
  YouTubePlaylistItemsResponse,
  YouTubePlaylistsListResponse,
  YouTubePlaylistListItem,
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

  private async scrapeChannelLiveStream(channelId: string, channelName?: string): Promise<LiveStream[]> {
    const url = `https://www.youtube.com/channel/${channelId}/live`;
    const channelLabel = channelName ? `${channelName} (${channelId})` : channelId;

    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      });

      const finalUrl = response.url;
      const match = finalUrl.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);

      if (!match) {
        logger.debug(`No live stream found for channel ${channelLabel} via scrape`);
        return [];
      }

      const videoId = match[1];
      logger.info(`Found live stream ${videoId} for channel ${channelLabel} via scrape`);
      return [{
        videoId,
        channelId,
        channelName,
        title: 'Live Stream',
        startedAt: new Date().toISOString(),
      }];
    } catch (error) {
      logger.error(`Failed to scrape live stream for channel ${channelLabel}`, error);
      throw error;
    }
  }

  async getChannelLiveStreams(channelId: string, channelName?: string): Promise<LiveStream[]> {
    if (process.env.USE_SCRAPING === 'true') {
      return this.scrapeChannelLiveStream(channelId, channelName);
    }

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

  async getPlaylistsMetadata(playlistIds: string[]): Promise<YouTubePlaylistListItem[]> {
    try {
      logger.debug(`Fetching metadata for playlists: ${playlistIds.join(', ')}`);
      const response = await this.apiClient.get<YouTubePlaylistsListResponse>('/playlists', {
        part: 'snippet,contentDetails',
        id: playlistIds.join(','),
        maxResults: 50,
      });
      logger.info(`Fetched metadata for ${response.items.length} playlists`);
      return response.items;
    } catch (error) {
      logger.error('Failed to fetch playlist metadata', error);
      throw error;
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
