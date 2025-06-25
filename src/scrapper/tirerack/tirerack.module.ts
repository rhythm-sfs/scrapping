// src/scrapers/tirerack/tirerack.module.ts
import { Module } from '@nestjs/common';
import { TireRackService } from './tirerack.service';
import { NormalizeService } from '../../services/normalize.service';
import { ProxyService } from '../../services/proxy.service';
import { TireModule } from '../../tire/tire.module';

@Module({
  imports: [TireModule],
  providers: [TireRackService, NormalizeService, ProxyService],
  exports: [TireRackService],
})
export class TireRackModule {}
