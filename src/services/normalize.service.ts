import { Injectable } from '@nestjs/common';

@Injectable()
export class NormalizeService {
  normalize(data: any, retailer: string) {
    if (!data.brand || !data.model || !data.size) {
      throw new Error(`Invalid tire data: ${JSON.stringify(data)}`);
    }

    return {
      brand: data.brand?.trim() || '',
      model: data.model?.trim() || '',
      price: (typeof data.price === 'string' ? data.price : data.price?.toString()) || '',
      size: data.size?.trim() || '',
      width: data.width || '',
      ratio: data.ratio || '',
      diameter: data.diameter || '',
      zipcode: data.zipcode || '',
      url: data.url || '',
      image: data.image || '',
      item_availability: data.item_availability || '',
      style: data.style || '',
      ecoFocus: data.ecoFocus || '',
      loadRange: data.loadRange || '',
      servDesc: data.servDesc || '',
      utqg: data.utqg || '',
      scrapedAt: data.scrapedAt ? new Date(data.scrapedAt) : new Date(),
      retailer: retailer || '',
    };
  }
}