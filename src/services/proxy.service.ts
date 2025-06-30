import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { anonymizeProxy } from 'proxy-chain';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private proxies: string[];
  private anonymizedProxies: Map<string, string> = new Map();
  private currentIndex = 0;
  private readonly MAX_RETRIES = 3;

  constructor(private configService: ConfigService) {
    // Load proxies from environment variables
    this.proxies = [
      this.configService.get<string>('PROXY1'),
      this.configService.get<string>('PROXY2'),
      this.configService.get<string>('PROXY3'),
      this.configService.get<string>('PROXY4'),
      
    ].filter(Boolean) as string[];

    if (this.proxies.length === 0) {
      this.logger.warn('No proxies configured. Please set PROXY1, PROXY2, etc. environment variables.');
    }
  }

  private async anonymizeProxyWithRetry(proxy: string): Promise<string> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < this.MAX_RETRIES; i++) {
      try {
        const anonymized = await anonymizeProxy(proxy);
        this.anonymizedProxies.set(proxy, anonymized);
        return anonymized;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Failed to anonymize proxy ${proxy} (attempt ${i + 1}/${this.MAX_RETRIES}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
    
    throw new Error(`Failed to anonymize proxy after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  private getNextProxy(): string {
    if (this.proxies.length === 0) {
      return ''; // Return empty string if no proxies configured
    }
    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    return proxy;
  }

  async getProxy(): Promise<string> {
    if (this.proxies.length === 0) {
      this.logger.warn('No proxies configured, returning empty proxy');
      return '';
    }

    const startIndex = this.currentIndex;
    let attempts = 0;

    do {
      const proxy = this.getNextProxy();
      
      try {
        // Check if we already have an anonymized version
        if (this.anonymizedProxies.has(proxy)) {
          return this.anonymizedProxies.get(proxy)!;
        }

        // Try to anonymize the proxy
        const anonymized = await this.anonymizeProxyWithRetry(proxy);
        this.logger.log(`Successfully configured proxy: ${proxy}`);
        return anonymized;

      } catch (error) {
        this.logger.error(`Proxy ${proxy} failed: ${error.message}`);
        attempts++;

        // If we've tried all proxies, throw an error
        if (attempts >= this.proxies.length) {
          throw new Error('All proxies failed. Please check your proxy configuration.');
        }
      }
    } while (this.currentIndex !== startIndex);

    throw new Error('No working proxies found after trying all available proxies.');
  }

  async cleanup() {
    // Cleanup any resources if needed
    this.anonymizedProxies.clear();
  }
}

