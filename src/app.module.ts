import { Module } from '@nestjs/common';

import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { TireModule } from './tire/tire.module';
import { ConfigModule } from '@nestjs/config';
import { TireRackModule } from './scrapper/tirerack/tirerack.module';
import { BjModule } from './scrapper/bj/bj.module';
import { WalmartModule } from './scrapper/walmart/walmart.module';
import { DiscountTireModule } from './scrapper/discountTire/discountTire.module';


@Module({
  imports: [  ConfigModule.forRoot({
    isGlobal: true,
  }),
    MongooseModule.forRoot('mongodb://localhost:27017/tyre-scrapping'),
    TireModule,
    TireRackModule,
    BjModule,
    WalmartModule,
    DiscountTireModule   
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule {}
