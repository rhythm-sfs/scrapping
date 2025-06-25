// src/tire/tire.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Tire, TireDocument } from '../schema/tire.schema';
import { Model } from 'mongoose';

@Injectable()
export class TireService {
  constructor(
    @InjectModel(Tire.name) private tireModel: Model<TireDocument>,
  ) {}

  async saveTire(tire: Partial<Tire>) {
    try {
      const created = new this.tireModel(tire);
      await created.save();
      console.log(` Tire saved to MongoDB: ${tire.model}`);
    } catch (err) {
      throw new Error(`Failed to save tire to MongoDB: ${err.message}`);
    }
  }
}

