export interface Channel {
  id: string;
  name?: string;
}

export type ChannelConfig = string | Channel;

export interface PlaylistConfig {
  name: string;
  playlistId: string;
  channels: ChannelConfig[];
}

export interface AppConfig {
  playlists: PlaylistConfig[];
}

export interface LiveStream {
  videoId: string;
  channelId: string;
  channelName?: string;
  title: string;
  startedAt: string;
}

export interface PlaylistVideo {
  playlistItemId: string; // Required for deletion
  videoId: string; // For comparison/deduplication
}

export interface VideoChangeDetail {
  videoId: string;
  title?: string;
  channelId?: string;
  channelName?: string;
}

export interface SyncResult {
  playlistName: string;
  liveStreamsFound: number;
  videosAdded: number;
  videosRemoved: number;
  errors: string[];
  addedVideos?: VideoChangeDetail[];
  removedVideos?: VideoChangeDetail[];
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
