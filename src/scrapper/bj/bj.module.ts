import { Module } from '@nestjs/common';
import { BjService } from './bj.service';
import { NormalizeService } from '../../services/normalize.service';
import { ProxyService } from '../../services/proxy.service';
import { TireModule } from '../../tire/tire.module';

@Module({
  imports: [TireModule],
  providers: [BjService, NormalizeService, ProxyService],
  exports: [BjService],
})
export class BjModule {}