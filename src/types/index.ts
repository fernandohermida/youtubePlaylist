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
  liveStreams?: LiveStream[];
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

// YouTube playlists.list API response
export interface YouTubePlaylistListItem {
  id: string;
  snippet: {
    thumbnails: {
      default?:  { url: string; width: number; height: number };
      medium?:   { url: string; width: number; height: number };
      high?:     { url: string; width: number; height: number };
      standard?: { url: string; width: number; height: number };
      maxres?:   { url: string; width: number; height: number };
    };
  };
  contentDetails: {
    itemCount: number;
  };
}

export interface YouTubePlaylistsListResponse {
  items: YouTubePlaylistListItem[];
}

// KV snapshot written by cron, read by status endpoint
export interface PlaylistSnapshot {
  name: string;
  playlistId: string;
  youtubeUrl: string;
  thumbnailUrl: string | null;
  liveStreamsFound: number;
  channels: Channel[];
  liveStreams?: LiveStream[];
}

export interface SyncSnapshot {
  lastSyncAt: string;
  playlists: PlaylistSnapshot[];
}

export interface StatusResponse {
  lastSyncAt: string | null;
  playlists: PlaylistSnapshot[];
  generatedAt: string;
}
