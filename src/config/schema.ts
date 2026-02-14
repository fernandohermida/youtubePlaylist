import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { AppConfig, PlaylistConfig } from '../types';

const PlaylistConfigSchema = z.object({
  name: z.string().min(1, 'Playlist name is required'),
  playlistId: z
    .string()
    .min(1, 'Playlist ID is required')
    .regex(/^PL[\w-]+$/, 'Invalid YouTube playlist ID format (must start with PL)'),
  channels: z
    .array(
      z
        .string()
        .regex(/^UC[\w-]+$/, 'Invalid YouTube channel ID format (must start with UC)')
    )
    .min(1, 'At least one channel is required'),
});

const AppConfigSchema = z.object({
  playlists: z.array(PlaylistConfigSchema).min(1, 'At least one playlist is required'),
});

export function loadConfig(): AppConfig {
  try {
    const configPath = join(__dirname, 'playlists.json');
    const configFile = readFileSync(configPath, 'utf-8');
    const configData = JSON.parse(configFile);

    const validatedConfig = AppConfigSchema.parse(configData);
    return validatedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid configuration file');
    }
    throw error;
  }
}

export function validatePlaylistConfig(config: unknown): PlaylistConfig {
  return PlaylistConfigSchema.parse(config);
}
