import { Injectable, OnModuleInit } from '@nestjs/common';
import { TireRackService } from './scrapper/tirerack/tirerack.service';
import { BjService } from './scrapper/bj/bj.service';
import { WalmartService } from './scrapper/walmart/walmart.service';
import { DiscountTireService } from './scrapper/discountTire/discountTire.service';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    private readonly tireRackService: TireRackService,
    private readonly bjService: BjService,
    private readonly walmartService: WalmartService,
    private readonly discountTireService:DiscountTireService
  ) {}
  async onModuleInit() {
    const zip = '10001';
    const start = Date.now();
    console.log(' Starting all scrapers in parallel...');

    await Promise.all([
      // this.tireRackService.scrape(),
      // this.bjService.scrape(zip),
      // this.walmartService.scrape(zip),
      this.discountTireService.scrape(zip)
    ]);

    const end = Date.now();
    console.log(`All scrapers completed in ${(end - start) / 1000}s`);
  }
}
