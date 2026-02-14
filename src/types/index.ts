export interface PlaylistConfig {
  name: string;
  playlistId: string;
  channels: string[];
}

export interface AppConfig {
  playlists: PlaylistConfig[];
}

export interface LiveStream {
  videoId: string;
  channelId: string;
  title: string;
  startedAt: string;
}

export interface PlaylistVideo {
  playlistItemId: string; // Required for deletion
  videoId: string; // For comparison/deduplication
}

export interface SyncResult {
  playlistName: string;
  liveStreamsFound: number;
  videosAdded: number;
  videosRemoved: number;
  errors: string[];
}

export interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
  nextPageToken?: string;
}

export interface YouTubeSearchItem {
  id: {
    videoId: string;
  };
  snippet: {
    channelId: string;
    title: string;
    publishedAt: string;
  };
}

export interface YouTubePlaylistItemsResponse {
  items: YouTubePlaylistItem[];
  nextPageToken?: string;
}

export interface YouTubePlaylistItem {
  id: string;
  snippet: {
    resourceId: {
      videoId: string;
    };
  };
}
