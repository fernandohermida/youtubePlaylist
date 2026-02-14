import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { logger } from './logger';

export class APIClient {
  private client: AxiosInstance;
  private maxRetries: number = 3;
  private baseDelay: number = 1000; // 1 second

  constructor(baseURL: string, timeout: number = 30000) {
    this.client = axios.create({
      baseURL,
      timeout,
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateBackoff(attempt: number): number {
    return this.baseDelay * Math.pow(2, attempt);
  }

  private shouldRetry(error: AxiosError): boolean {
    if (!error.response) {
      return true;
    }

    const status = error.response.status;
    return status === 429 || status >= 500;
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (error instanceof Error && 'isAxiosError' in error) {
          const axiosError = error as AxiosError;

          if (!this.shouldRetry(axiosError)) {
            throw error;
          }

          if (attempt < this.maxRetries - 1) {
            const delay = this.calculateBackoff(attempt);
            logger.warn(
              `${operationName} failed (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${delay}ms`,
              {
                status: axiosError.response?.status,
                statusText: axiosError.response?.statusText,
              }
            );
            await this.sleep(delay);
            continue;
          }
        }

        throw error;
      }
    }

    throw lastError;
  }

  async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    const config: AxiosRequestConfig = { params };

    return this.executeWithRetry(
      async () => {
        const response = await this.client.get<T>(url, config);
        return response.data;
      },
      `GET ${url}`
    );
  }

  async post<T>(url: string, data?: any): Promise<T> {
    return this.executeWithRetry(
      async () => {
        const response = await this.client.post<T>(url, data);
        return response.data;
      },
      `POST ${url}`
    );
  }

  async delete<T>(url: string, params?: Record<string, any>): Promise<T> {
    const config: AxiosRequestConfig = { params };

    return this.executeWithRetry(
      async () => {
        const response = await this.client.delete<T>(url, config);
        return response.data;
      },
      `DELETE ${url}`
    );
  }
}
