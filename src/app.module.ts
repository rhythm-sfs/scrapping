import { Module } from '@nestjs/common';

import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { TireModule } from './tire/tire.module';
import { ConfigModule } from '@nestjs/config';
import { TireRackModule } from './scrapper/tirerack/tirerack.module';



@Module({
  imports: [  ConfigModule.forRoot({
    isGlobal: true,
  }),
    MongooseModule.forRoot('mongodb://localhost:27017/tyre-scrapping'),
    TireModule,
    TireRackModule,
    
   
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule {}
