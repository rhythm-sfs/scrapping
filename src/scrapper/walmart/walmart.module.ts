// src/scrapers/walmart.module.ts
import { Module } from '@nestjs/common';
import { WalmartService } from './walmart.service';
import { NormalizeService } from '../../services/normalize.service';
import { ProxyService } from '../../services/proxy.service';
import { TireModule } from '../../tire/tire.module';

@Module({
  imports: [TireModule],
  providers: [WalmartService, NormalizeService, ProxyService],
  exports: [WalmartService],
})
export class WalmartModule {}
