# Auto-Updated YouTube Live Playlist

Automatically sync YouTube playlists with currently live streams from configured channels. Runs on Vercel with cron jobs.

## Overview

This service keeps YouTube playlists automatically updated with live streams from a predefined set of channels. Perfect for aggregating live news streams, gaming broadcasts, or any other type of live content.

**Example Use Case:** Create an "Argentinian News Live" playlist that automatically contains only the news channels that are currently streaming.

## Features

- Multiple playlists supported
- Config-driven (no UI needed)
- Automatic live stream detection
- Automatic playlist sync (adds new live streams, removes ended ones)
- Runs on schedule via Vercel cron
- Stateless execution
- Comprehensive error handling and logging

## Prerequisites

1. **Node.js** (v18 or higher)
2. **YouTube Data API v3 Key** ([Get one here](https://console.cloud.google.com/apis/credentials))
3. **Vercel Account** ([Sign up here](https://vercel.com))

## Setup

### 1. Get YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable "YouTube Data API v3"
4. Create credentials → API Key
5. Restrict the key to YouTube Data API v3 only (recommended)

### 2. Clone and Install

```bash
git clone <your-repo-url>
cd youtubePlaylist
npm install
```

### 3. Configure Environment Variables

Create a `.env` file:

```bash
YOUTUBE_API_KEY=your_api_key_here
```

### 4. Configure Playlists

Edit `src/config/playlists.json`:

```json
{
  "playlists": [
    {
      "name": "Argentinian News Live",
      "playlistId": "PLxxxxxxxxxxxxxxxxxxx",
      "channels": [
        "UCxxxxxxxxxxxxxxxxxxxxxx",
        "UCyyyyyyyyyyyyyyyyyyyyyy"
      ]
    }
  ]
}
```

**Finding IDs:**
- **Playlist ID:** Open playlist on YouTube → URL contains `list=PLxxx...`
- **Channel ID:** Open channel → View page source → Search for `channelId` or use browser extension

**Validation:**
- Playlist IDs must start with `PL`
- Channel IDs must start with `UC`
- At least one channel required per playlist

### 5. Local Testing

```bash
npm run build
npm run dev
```

Then trigger the endpoint:

```bash
curl http://localhost:3000/api/cron
```

### 6. Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Add environment variable in Vercel dashboard:
1. Go to your project → Settings → Environment Variables
2. Add `YOUTUBE_API_KEY` with your API key
3. Redeploy if needed

## How It Works

### Architecture

```
Config Load → Discover Live Streams → Get Current Playlist → Diff → Sync (Add/Remove) → Log Results
```

### Sync Algorithm

For each configured playlist:

1. **Discovery:** Query YouTube API to find live streams from configured channels
2. **Current State:** Get all videos currently in the playlist
3. **Diff Calculation:**
   - `toAdd` = live streams not in playlist
   - `toRemove` = playlist videos no longer live
4. **Sync:** Add new videos, remove ended ones
5. **Report:** Log summary with counts and errors

### Cron Schedule

Configured in `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron",
    "schedule": "0 */6 * * *"  // Every 6 hours
  }]
}
```

**Cron Format:** `minute hour day month weekday`
- `0 */6 * * *` = Every 6 hours (current)
- `0 * * * *` = Every hour
- `*/15 * * * *` = Every 15 minutes

**Note:** Frequent runs consume more API quota. See [Quota Management](#quota-management) below.

## API Quota Management

### YouTube API Quota Costs

| Operation | Cost (units) | Frequency |
|-----------|--------------|-----------|
| Search for live streams | 100 | Per channel, per run |
| Get playlist items | 1 | Per playlist, per run |
| Add video to playlist | 50 | Per new live stream |
| Remove video from playlist | 50 | Per ended stream |

### Daily Quota Calculation

**Default quota:** 10,000 units/day

**Example (6-hour cron, 2 playlists, 15 channels total):**
- 4 runs/day
- 15 search calls/run = 1,500 units
- ~4 insert/delete = ~200 units
- **Total per run: ~1,700 units**
- **Daily total: ~6,800 units/day**

This is within the default quota! For higher frequencies:

1. **Hourly cron:** ~19,000 units/day (requires quota increase)
2. **Every 15 minutes:** ~77,000 units/day (requires quota increase to 100,000)

**To request quota increase:**
- Go to [Google Cloud Console](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas)
- Request increase (takes 1-2 weeks)

### Monitor Quota Usage

View usage: [Google Cloud Console → APIs & Services → YouTube Data API v3 → Quotas](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas)

## Project Structure

```
youtubePlaylist/
├── api/
│   └── cron.ts                    # Vercel cron endpoint
├── src/
│   ├── config/
│   │   ├── playlists.json        # Playlist configurations
│   │   └── schema.ts             # Config validation (Zod)
│   ├── services/
│   │   ├── sync.service.ts       # Main sync orchestrator
│   │   └── youtube.service.ts    # YouTube API wrapper
│   └── utils/
│       ├── logger.ts             # Logging
│       ├── api-client.ts         # HTTP client with retry
│       └── diff.ts               # Array diff helper
├── vercel.json                   # Vercel config (cron schedule)
└── package.json
```

## Monitoring

### Vercel Logs

View execution logs:
1. Vercel Dashboard → Your Project → Logs
2. Filter by `/api/cron` function

### Log Format

All logs include timestamps and structured data:

```
[2024-01-15T10:00:00.000Z] [INFO] Starting sync for playlist: News Live
[2024-01-15T10:00:01.234Z] [INFO] Found 3 live streams for playlist News Live
[2024-01-15T10:00:02.456Z] [INFO] Sync completed: 2 added, 1 removed
```

### Response Format

```json
{
  "success": true,
  "executionTimeMs": 3450,
  "totalPlaylists": 2,
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
    "totalLiveStreamsFound": 5,
    "totalVideosAdded": 3,
    "totalVideosRemoved": 2,
    "totalErrors": 0
  }
}
```

## Troubleshooting

### "YOUTUBE_API_KEY not configured"

- Verify `.env` file exists locally
- For Vercel: Check Environment Variables in dashboard
- Ensure variable name is exactly `YOUTUBE_API_KEY`

### "Invalid YouTube playlist ID format"

- Playlist IDs must start with `PL`
- Find in YouTube URL: `youtube.com/playlist?list=PLxxx...`

### "Invalid YouTube channel ID format"

- Channel IDs must start with `UC`
- Not the same as username/handle
- Use browser extension or view page source to find

### No videos being added

- Check if channels are actually live
- Verify channel IDs are correct
- Check Vercel logs for API errors
- Verify YouTube API key has correct permissions

### API Quota Exceeded

- Check quota usage in Google Cloud Console
- Reduce cron frequency in `vercel.json`
- Request quota increase
- Reduce number of channels

### Vercel Function Timeout

- Default: 10s (Hobby), 60s (Pro)
- Reduce number of playlists/channels per execution
- Consider splitting into multiple cron jobs

## Development

### Build TypeScript

```bash
npm run build
```

### Type Check

```bash
npm run type-check
```

### Manual Testing

1. Start local server: `npm run dev`
2. Trigger endpoint: `curl http://localhost:3000/api/cron`
3. Check console logs
4. Verify playlist on YouTube

## Security

- **Never commit `.env`** (already in `.gitignore`)
- **Restrict API key** to YouTube Data API v3 only
- **Consider basic auth** for cron endpoint in production
- **Rotate API keys** periodically

## Limitations

- Stateless (no database/caching)
- Processes playlists sequentially
- Subject to YouTube API quota limits
- Vercel cron requires paid plan for high frequency

## Future Enhancements

- Add caching (Vercel KV) to reduce API calls
- Webhook-based updates instead of polling
- Discord/Slack notifications for errors
- Web UI for managing playlists
- Multiple playlist strategies (top N streams, priority channels)

## License

MIT

## Support

For issues and questions, check:
- [YouTube Data API Documentation](https://developers.google.com/youtube/v3)
- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs)
- Project issues on GitHub
