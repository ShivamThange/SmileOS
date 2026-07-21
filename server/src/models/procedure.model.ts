import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin, type BaseFields } from "./plugins/base-fields";
import { PROCEDURE_CATEGORIES } from "../shared/enums";

/*
 * Procedure / Service Catalogue (spec 2.5). The price book: default price plus
 * tier variants, tooth/surface specificity, consumables that drive inventory
 * deduction, default recall interval on completion, and public visibility.
 */

const procedureSchema = new Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  friendlyName: String,
  category: { type: String, enum: PROCEDURE_CATEGORIES, required: true, index: true },
  description: String,
  defaultDurationMinutes: { type: Number, default: 30 },
  defaultPricePaise: { type: Number, default: 0 },
  tierPrices: { type: Map, of: Number, default: {} }, // keyed by PRICE_TIERS
  taxApplicable: { type: Boolean, default: false },
  taxRate: { type: Number, default: 0 },
  toothSpecific: { type: Boolean, default: false },
  surfaceSpecific: { type: Boolean, default: false },
  consumables: [{ item: { type: Schema.Types.ObjectId, ref: "InventoryItem" }, qty: Number }],
  typicalSittings: { type: Number, default: 1 },
  defaultRecallIntervalDays: Number,
  requiresConsent: { type: Boolean, default: false },
  requiresLab: { type: Boolean, default: false },
  publicVisible: { type: Boolean, default: false },
  displayOrder: { type: Number, default: 0 },
});

procedureSchema.plugin(baseFieldsPlugin);
procedureSchema.index({ clinicId: 1, code: 1 }, { unique: true });
procedureSchema.index({ clinicId: 1, category: 1, displayOrder: 1 });

export type Procedure = InferSchemaType<typeof procedureSchema> & BaseFields;
export type ProcedureDoc = HydratedDocument<Procedure>;
export const ProcedureModel = model<Procedure>("Procedure", procedureSchema);
