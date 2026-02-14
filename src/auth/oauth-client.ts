import axios from 'axios';
import { logger } from '../utils/logger';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export class OAuthClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private readonly TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes
  private refreshPromise: Promise<string> | null = null;

  constructor(private config: OAuthConfig) {}

  async getValidAccessToken(): Promise<string> {
    if (this.accessToken && !this.isTokenExpired()) {
      logger.debug('Using cached access token');
      return this.accessToken;
    }

    logger.info('Access token expired or missing, refreshing...');
    return this.refreshAccessToken();
  }

  private isTokenExpired(): boolean {
    const now = Date.now();
    return now >= this.tokenExpiresAt - this.TOKEN_REFRESH_BUFFER;
  }

  private async refreshAccessToken(): Promise<string> {
    // Prevent concurrent refresh requests
    if (this.refreshPromise) {
      logger.debug('Refresh already in progress, waiting...');
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();

    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<string> {
    try {
      logger.debug('Exchanging refresh token for access token');

      const response = await axios.post<TokenResponse>(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

      logger.info('Access token refreshed successfully', {
        expiresIn: response.data.expires_in,
      });

      return this.accessToken;
    } catch (error) {
      logger.error('Failed to refresh access token', error);

      if (axios.isAxiosError(error) && error.response?.status === 400) {
        throw new Error(
          'OAuth refresh token is invalid or expired. Please re-run: npm run setup-oauth'
        );
      }

      throw new Error(
        'OAuth token refresh failed. Please check your credentials and try again.'
      );
    }
  }
}
