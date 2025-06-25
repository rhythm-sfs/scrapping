import { Injectable, OnModuleInit } from '@nestjs/common';
import { TireRackService } from './scrapper/tirerack/tirerack.service';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(private tireRack: TireRackService) {}

  async onModuleInit() {
    await this.tireRack.scrape();
  }
}