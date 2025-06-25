import { Injectable } from '@nestjs/common';

@Injectable()
export class NormalizeService {
  normalize(data: any, retailer: string) {
    if (!data.brand || !data.model || !data.size) {
      throw new Error(`Invalid tire data: ${JSON.stringify(data)}`);
    }

    return {
      brand: data.brand.trim(),
      model: data.model.trim(),
      size: data.size.trim(),
      price: parseFloat(data.price) || 0,
      retailer,
      url: data.url || '',
      scrapedAt: new Date().toISOString(),
    };
  }
}