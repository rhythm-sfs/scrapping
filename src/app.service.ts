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
    console.log('Starting all scrapers...');
    // await this.tireRackService.scrapeAllCombinations();
    await this.walmartService.scrapeAllCombinations('10001');
    // await this.discountTireService.scrapeAllCombinations('10001');
    console.log('All scrapers finished!');
  }
}
