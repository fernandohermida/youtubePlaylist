import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { logger } from '../src/utils/logger';
import type { SyncSnapshot, StatusResponse } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const snapshot = await kv.get<SyncSnapshot>('sync_snapshot');

    const body: StatusResponse = {
      lastSyncAt: snapshot?.lastSyncAt ?? null,
      playlists: snapshot?.playlists ?? [],
      generatedAt: new Date().toISOString(),
    };

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.status(200).json(body);
  } catch (error) {
    logger.error('Status endpoint failed', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
