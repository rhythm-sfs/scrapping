import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type TireDocument = Tire & Document;

@Schema()
export class Tire {
  @ApiProperty()
  @Prop()
  brand: string;

  @ApiProperty()
  @Prop()
  model: string;

  @ApiProperty()
  @Prop()
  size: string;

  @ApiProperty()
  @Prop()
  price: number;

  @ApiProperty()
  @Prop()
  retailer: string;



  @ApiProperty({ type: Date })
  @Prop()
  scrapedAt: Date;
}

export const TireSchema = SchemaFactory.createForClass(Tire);