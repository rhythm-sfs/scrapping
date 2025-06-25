// src/tire/tire.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tire, TireSchema } from '../schema/tire.schema';
import { TireService } from './tire.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Tire.name, schema: TireSchema }])],
  providers: [TireService],
  exports: [TireService],
})
export class TireModule {}

