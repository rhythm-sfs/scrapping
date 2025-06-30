// tire.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TireDocument = Tire & Document;

@Schema()
export class Tire {
  @Prop({ required: true })
  brand: string;

  @Prop({ required: true })
  model: string;

  @Prop({ required: true })
  price: string;

  @Prop({ required: true })
  size: string;

  @Prop({ required: true })
  width: string;

  @Prop({ required: true })
  ratio: string;

  @Prop({ required: true })
  diameter: string;

  @Prop({ required: true })
  zipcode: string;

  @Prop()
  url: string;

  @Prop()
  image?: string;

  @Prop({ default: Date.now })
  scrapedAt: Date;

  @Prop()
  item_availability?: string;

  @Prop()
  style?: string;

  @Prop()
  ecoFocus?: string;

  @Prop()
  loadRange?: string;

  @Prop()
  servDesc?: string;

  @Prop()
  utqg?: string;

  @Prop({ required: true })
  retailer: string;
}

export const TireSchema = SchemaFactory.createForClass(Tire);
