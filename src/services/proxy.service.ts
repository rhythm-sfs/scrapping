import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { anonymizeProxy } from 'proxy-chain';

@Injectable()
export class ProxyService {
  private proxies: string[];
  private index = 0;

  constructor(private configService: ConfigService) {
    this.proxies = [
      this.configService.get<string>('proxy1'),
      this.configService.get<string>('proxy2'),
      this.configService.get<string>('proxy3'),
      this.configService.get<string>('proxy4'),
    ].filter(Boolean) as string[];

    if (this.proxies.length === 0) {
      throw new Error('No proxies configured. Please set proxy environment variables.');
    }
  }

  async getProxy(): Promise<string> {
    for (let i = 0; i < this.proxies.length; i++) {
      const proxy = this.proxies[this.index % this.proxies.length];
      this.index++;
      try {
        return await anonymizeProxy(proxy);
      } catch (error) {
        console.warn(`Proxy failed: ${proxy}, error: ${error.message}`);
      }
    }
    throw new Error('All proxies failed. Please check your proxy configuration.');
  }
}

