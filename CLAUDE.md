# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YouTube Live Playlist Sync service that automatically keeps YouTube playlists updated with currently live streams from configured channels. Runs on Vercel with cron jobs.

## Commands

### Development
- `npm run build` - Compile TypeScript to JavaScript (outputs to `dist/`)
- `npm run type-check` - Run TypeScript type checking without emitting files
- `npm run dev` - Start Vercel dev server for local testing
- `npm run setup-oauth` - Interactive script to configure YouTube OAuth credentials

### Local Testing
```bash
npm run build
npm run dev
# In another terminal:
curl http://localhost:3000/api/cron
```

### Deployment
```bash
vercel --prod
```

## Architecture

### Core Flow
1. **Entry Point**: `api/cron.ts` - Vercel serverless function triggered by cron
2. **Orchestrator**: `SyncService` - Manages sync process for all playlists
3. **YouTube API**: `YouTubeService` - Wraps all YouTube Data API v3 operations
4. **Auth**: `OAuthClient` - Handles OAuth token refresh with automatic expiry management
5. **API Client**: `APIClient` - HTTP client with exponential backoff retry logic

### Authentication
- Uses **OAuth 2.0** (not API key) for YouTube API access
- Requires three environment variables: `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`, `YOUTUBE_OAUTH_REFRESH_TOKEN`
- `OAuthClient` automatically refreshes access tokens when expired (5-minute buffer before expiry)
- Concurrent refresh requests are deduplicated to prevent race conditions

### Sync Algorithm
For each playlist:
1. Discover live streams from all configured channels (`YouTubeService.getChannelLiveStreams`)
2. Fetch current playlist contents (`YouTubeService.getPlaylistVideos` - handles pagination)
3. Calculate diff using `arrayDiff` utility (videos to add, videos to remove)
4. Batch add/remove with 200ms delays between operations to avoid rate limiting

### Error Handling
- Per-channel errors don't fail the entire sync (logged and skipped)
- Per-playlist errors are captured in result objects
- API client retries on 429 (rate limit) and 5xx errors with exponential backoff
- All errors are logged with context (channel names, IDs, etc.)

## Configuration

### Playlist Configuration (`src/config/playlists.json`)
```json
{
  "playlists": [
    {
      "name": "Playlist Display Name",
      "playlistId": "PLxxx...",  // Must start with PL
      "channels": [
        "UCxxx...",  // Simple string format
        { "id": "UCxxx...", "name": "Optional Display Name" }  // Object format with name
      ]
    }
  ]
}
```

- **Channel formats**: Accepts both string (just ID) or object with `id` and optional `name`
- **Validation**: Enforced via Zod schemas in `src/config/schema.ts`
  - Playlist IDs must match `/^PL[\w-]+$/`
  - Channel IDs must match `/^UC[\w-]+$/`
  - At least one playlist and one channel per playlist required

### Environment Variables
- `YOUTUBE_OAUTH_CLIENT_ID` - OAuth client ID from Google Cloud Console
- `YOUTUBE_OAUTH_CLIENT_SECRET` - OAuth client secret
- `YOUTUBE_OAUTH_REFRESH_TOKEN` - Long-lived refresh token (obtained via `npm run setup-oauth`)
- `ENABLE_REPORT` - Optional, set to "true" to enable CLI-style report output in logs

## Key Implementation Details

### OAuth Token Management
- Access tokens expire after ~1 hour
- `OAuthClient` caches tokens and auto-refreshes 5 minutes before expiry
- Refresh token is long-lived and used to obtain new access tokens
- Failed refresh provides actionable error message to re-run `npm run setup-oauth`

### API Client Retry Logic
- 3 max retries with exponential backoff (1s, 2s, 4s)
- Retries on: network errors, 429 (rate limit), 5xx (server errors)
- Non-retryable errors (4xx except 429) fail immediately
- Each retry is logged with attempt count and delay

### Batch Operations
- `batchAddVideos` and `batchRemoveVideos` process arrays sequentially
- 200ms delay between operations to respect YouTube API rate limits
- Individual failures don't stop the batch (logged and skipped)

### YouTube API Quota Costs
- Search for live streams: 100 units per channel
- Get playlist items: 1 unit per request (paginated at 50 items)
- Add video to playlist: 50 units
- Remove video from playlist: 50 units
- Default daily quota: 10,000 units

### Vercel Cron Configuration (`vercel.json`)
- Free tier: Daily cron only (`0 0 * * *`)
- Pro tier: Can run more frequently (hourly, every 15 minutes, etc.)
- Endpoint: `/api/cron` (mapped to `api/cron.ts`)

## Type System

All types are defined in `src/types/index.ts`:
- `PlaylistConfig` - Configuration for a single playlist
- `AppConfig` - Root configuration with array of playlists
- `LiveStream` - Live stream metadata (videoId, channelId, title, etc.)
- `PlaylistVideo` - Video in playlist (playlistItemId + videoId)
- `SyncResult` - Result of syncing one playlist (counts, errors, added/removed videos)
- `ChannelConfig` - Union type: string ID or object with id + optional name
- YouTube API response types (`YouTubeSearchResponse`, `YouTubePlaylistItemsResponse`)

## Project Structure

```
api/
  cron.ts                      # Vercel cron endpoint handler
src/
  auth/
    oauth-client.ts            # OAuth token refresh and management
  config/
    playlists.json             # Playlist and channel configuration
    schema.ts                  # Zod validation schemas
  services/
    sync.service.ts            # Main sync orchestrator
    youtube.service.ts         # YouTube API wrapper
  types/
    index.ts                   # All TypeScript type definitions
  utils/
    api-client.ts              # HTTP client with retry logic
    diff.ts                    # Array diff helper
    logger.ts                  # Structured logging
    report-formatter.ts        # CLI-style report generation
scripts/
  setup-oauth.ts               # OAuth credential setup wizard
```

## Common Patterns

### Adding a new YouTube API operation
1. Add response type to `src/types/index.ts`
2. Add method to `YouTubeService` class
3. Use `this.apiClient.get/post/delete` which handles auth injection and retries
4. Log operations with channel/playlist context for debugging

### Modifying sync logic
- Main logic is in `SyncService.syncPlaylist`
- Always use `arrayDiff` utility for calculating adds/removes
- Maintain error isolation (channel-level and playlist-level)
- Update `SyncResult` type if changing result structure

### Working with configuration
- Edit `src/config/playlists.json` directly
- Schema validation happens automatically in `loadConfig()`
- Type safety enforced by `AppConfig` and `PlaylistConfig` types
