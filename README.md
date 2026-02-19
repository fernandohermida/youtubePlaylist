# Auto-Updated YouTube Live Playlist

Automatically keeps YouTube playlists updated with currently live streams from configured channels. Runs on Vercel with cron jobs.

## How It Works

```
Cron trigger (api/cron.ts)
  → Detect live streams per channel   (YouTube Search API)
  → Fetch current playlist contents   (YouTube playlistItems API)
  → Diff: what to add / what to remove
  → Batch add/remove with 200ms delays
  → Write SyncSnapshot to Vercel KV   (for the status page)
```

Only videos that actually need to change are touched — if the playlist already matches the current live state, no add/remove API calls are made.

**Example use case:** An "Argentinian News Live" playlist that always contains only the channels currently streaming live.

## Features

- Multiple playlists supported
- Config-driven — no UI needed
- Smart diff — only adds/removes what changed
- Status snapshot saved to Vercel KV after every sync
- Runs on schedule via Vercel cron
- Comprehensive error handling with per-channel isolation

## Prerequisites

- Node.js 18+
- A [Vercel](https://vercel.com) project with **Vercel KV** storage enabled
- A Google Cloud project with the **YouTube Data API v3** enabled
- OAuth 2.0 credentials (Client ID + Client Secret) from Google Cloud Console

> The service uses OAuth 2.0 (not a simple API key) because playlist modification requires write access to your YouTube account.

## Setup

### 1. Google Cloud OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project → enable **YouTube Data API v3**
3. Create credentials → **OAuth 2.0 Client ID** (Desktop app type)
4. Download the client ID and client secret

### 2. Clone and install

```bash
git clone <your-repo-url>
cd youtubePlaylist
npm install
```

### 3. Run the OAuth setup wizard

```bash
npm run setup-oauth
```

This interactive script guides you through authorizing the app and saves the refresh token to `.env.local`.

### 4. Configure playlists

Edit `src/config/playlists.json`:

```json
{
  "playlists": [
    {
      "name": "News Live",
      "playlistId": "PLxxx...",
      "channels": [
        "UCaaa...",
        { "id": "UCbbb...", "name": "Channel Display Name" }
      ]
    }
  ]
}
```

- Playlist IDs must start with `PL` (from `youtube.com/playlist?list=PLxxx...`)
- Channel IDs must start with `UC` (not the @handle — find via page source or a browser extension)
- Channels accept a bare ID string or an object with `id` + optional `name`

### 5. Local testing

```bash
npm run build
npm run dev
# In another terminal:
curl http://localhost:3000/api/cron
```

### 6. Deploy

```bash
vercel --prod
```

Add all required environment variables in Vercel project settings before deploying.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `YOUTUBE_OAUTH_CLIENT_ID` | Yes | OAuth client ID from Google Cloud Console |
| `YOUTUBE_OAUTH_CLIENT_SECRET` | Yes | OAuth client secret |
| `YOUTUBE_OAUTH_REFRESH_TOKEN` | Yes | Long-lived refresh token (from `npm run setup-oauth`) |
| `KV_REST_API_URL` | Yes | Vercel KV URL (auto-set when KV store is linked) |
| `KV_REST_API_TOKEN` | Yes | Vercel KV token (auto-set when KV store is linked) |
| `ENABLE_REPORT` | No | Set to `"true"` to print a CLI-style report to logs |

## API Quota Costs

Calls `GET /search?eventType=live` per channel. Returns full metadata.

| Operation | Cost |
|---|---|
| Detect live streams | 100 units / channel |
| Read playlist contents | 1 unit / 50 items |
| Add video to playlist | 50 units |
| Remove video from playlist | 50 units |
| Fetch playlist thumbnails (snapshot) | 1 unit |

**Example — 10 channels, nothing changed: ~1,001 units.**

Default daily quota: 10,000 units. [Request an increase](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas) if needed.

## Status Snapshot (Vercel KV)

After each sync, the cron handler writes a `SyncSnapshot` to Vercel KV under the key `sync_snapshot`. The status/portal page reads this key to display last-run info without any YouTube API calls.

**What gets saved:**

```json
{
  "lastSyncAt": "2025-01-01T00:00:00.000Z",
  "playlists": [
    {
      "name": "News Live",
      "playlistId": "PLxxx...",
      "youtubeUrl": "https://www.youtube.com/playlist?list=PLxxx...",
      "thumbnailUrl": "https://i.ytimg.com/...",
      "liveStreamsFound": 2,
      "channels": [{ "id": "UCaaa..." }, { "id": "UCbbb...", "name": "Channel Display Name" }]
    }
  ]
}
```

A KV write failure is non-fatal — the cron job still returns 200 and logs the error.

## Vercel Cron

Configured in `vercel.json`:

- **Free tier**: Daily (`0 0 * * *`)
- **Pro tier**: Can run hourly, every 15 minutes, etc.
- **Endpoint**: `GET /api/cron`

## Commands

| Command | Description |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run type-check` | Type-check without emitting |
| `npm run dev` | Start Vercel dev server |
| `npm run setup-oauth` | Re-run OAuth credential setup |

## Project Structure

```
api/
  cron.ts                      # Vercel cron endpoint — sync + KV snapshot write
src/
  auth/
    oauth-client.ts            # OAuth token refresh and caching
  config/
    playlists.json             # Playlist and channel configuration
    schema.ts                  # Zod validation schemas
  services/
    sync.service.ts            # Sync orchestrator (diff + batch operations)
    youtube.service.ts         # YouTube API wrapper
  types/
    index.ts                   # All TypeScript types
  utils/
    api-client.ts              # Axios HTTP client with retry/backoff
    diff.ts                    # arrayDiff utility
    logger.ts                  # Structured logging
    report-formatter.ts        # CLI-style report generation
scripts/
  setup-oauth.ts               # OAuth credential setup wizard
```

## Cron Response Format

```json
{
  "success": true,
  "executionTimeMs": 3450,
  "totalPlaylists": 1,
  "results": [
    {
      "playlistName": "News Live",
      "liveStreamsFound": 3,
      "videosAdded": 2,
      "videosRemoved": 1,
      "errors": []
    }
  ],
  "summary": {
    "totalLiveStreamsFound": 3,
    "totalVideosAdded": 2,
    "totalVideosRemoved": 1,
    "totalErrors": 0
  }
}
```

## Troubleshooting

**OAuth credentials not configured** — check that all three `YOUTUBE_OAUTH_*` variables are set. Re-run `npm run setup-oauth` if the refresh token is expired.

**Invalid playlist ID format** — must start with `PL`. Find it in the YouTube URL: `youtube.com/playlist?list=PLxxx...`.

**Invalid channel ID format** — must start with `UC`. This is not the @handle. View page source or use a browser extension to find it.

**No videos being added** — verify channels are actually live, check channel IDs, and inspect Vercel logs for errors.

**Quota exceeded** — switch to `USE_SCRAPING=true`, reduce sync frequency, or [request a quota increase](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas).

## Security

- Never commit `.env.local` (already in `.gitignore`)
- The OAuth refresh token grants write access to your YouTube account — treat it as a secret
- Rotate credentials if compromised by re-running `npm run setup-oauth`
