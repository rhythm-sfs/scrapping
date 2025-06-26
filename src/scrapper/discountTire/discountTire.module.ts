import { Module } from '@nestjs/common';
import { DiscountTireService } from './discountTire.service';
import { NormalizeService } from '../../services/normalize.service';
import { ProxyService } from '../../services/proxy.service';
import { TireModule } from '../../tire/tire.module';

@Module({
  imports: [TireModule],
  providers: [DiscountTireService, NormalizeService, ProxyService],
  exports: [DiscountTireService],
})
export class DiscountTireModule {}
