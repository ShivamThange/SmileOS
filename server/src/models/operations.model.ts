import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { baseFieldsPlugin, type BaseFields } from "./plugins/base-fields";
import { LAB_STATUS } from "../shared/enums";

/*
 * Operations domain (spec 2.9). LabCase, InventoryItem, StockMovement,
 * PurchaseOrder, Supplier, Attendance. Money in paise.
 */

const labCaseSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  doctor: { type: Schema.Types.ObjectId, ref: "User" },
  lab: { type: Schema.Types.ObjectId, ref: "Supplier" },
  labName: String,
  workType: String,
  teeth: [Number],
  shade: String,
  material: String,
  impressionDate: Date,
  sentDate: Date,
  expectedReturn: Date,
  actualReturn: Date,
  trials: [{ appointment: { type: Schema.Types.ObjectId, ref: "Appointment" }, date: Date, note: String }],
  status: { type: String, enum: LAB_STATUS, default: "impression", index: true },
  costPaise: { type: Number, default: 0 },
  invoice: { type: Schema.Types.ObjectId, ref: "Invoice" },
  prescriptionKey: String,
  remakeReason: String,
  notes: String,
});
labCaseSchema.plugin(baseFieldsPlugin);
labCaseSchema.index({ clinicId: 1, status: 1, expectedReturn: 1 });

export type LabCase = InferSchemaType<typeof labCaseSchema> & BaseFields;
export type LabCaseDoc = HydratedDocument<LabCase>;
export const LabCaseModel = model<LabCase>("LabCase", labCaseSchema);

/* -------------------------------------------------------------- InventoryItem */

const inventoryItemSchema = new Schema({
  name: { type: String, required: true },
  category: String,
  sku: String,
  unit: { type: String, default: "unit" },
  stock: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 0 },
  reorderQty: { type: Number, default: 0 },
  unitCostPaise: { type: Number, default: 0 },
  sellingPricePaise: Number,
  supplier: { type: Schema.Types.ObjectId, ref: "Supplier" },
  batches: [{ batchNumber: String, expiry: Date, quantity: Number, costPaise: Number }],
  location: String,
  consumable: { type: Boolean, default: true },
  linkedProcedures: [{ type: Schema.Types.ObjectId, ref: "Procedure" }],
});
inventoryItemSchema.plugin(baseFieldsPlugin);
inventoryItemSchema.index({ clinicId: 1, name: 1 });

export type InventoryItem = InferSchemaType<typeof inventoryItemSchema> & BaseFields;
export const InventoryItemModel = model<InventoryItem>("InventoryItem", inventoryItemSchema);

/* --------------------------------------------------------------- StockMovement */

const stockMovementSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: "InventoryItem", required: true, index: true },
  batchNumber: String,
  type: { type: String, enum: ["purchase", "consumption", "adjustment", "return", "expiry", "transfer"], required: true },
  quantity: { type: Number, required: true },
  reference: String,
  performedBy: { type: Schema.Types.ObjectId, ref: "User" },
  reason: String,
  resultingBalance: Number,
});
stockMovementSchema.plugin(baseFieldsPlugin);
stockMovementSchema.index({ clinicId: 1, item: 1, createdAt: -1 });

export type StockMovement = InferSchemaType<typeof stockMovementSchema> & BaseFields;
export const StockMovementModel = model<StockMovement>("StockMovement", stockMovementSchema);

/* --------------------------------------------------------------- PurchaseOrder */

const purchaseOrderSchema = new Schema({
  supplier: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
  orderDate: { type: Date, default: Date.now },
  expectedDate: Date,
  lines: [{ item: { type: Schema.Types.ObjectId, ref: "InventoryItem" }, quantity: Number, unitCostPaise: Number }],
  totalPaise: { type: Number, default: 0 },
  status: { type: String, enum: ["draft", "ordered", "partial", "received", "cancelled"], default: "draft" },
  received: [{ date: Date, lines: Schema.Types.Mixed }],
  invoice: { type: Schema.Types.ObjectId, ref: "Invoice" },
});
purchaseOrderSchema.plugin(baseFieldsPlugin);

export type PurchaseOrder = InferSchemaType<typeof purchaseOrderSchema> & BaseFields;
export const PurchaseOrderModel = model<PurchaseOrder>("PurchaseOrder", purchaseOrderSchema);

/* -------------------------------------------------------------------- Supplier */

const supplierSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["supplies", "lab", "equipment", "pharmacy"], default: "supplies" },
  contact: { phone: String, email: String, person: String },
  gstin: String,
  paymentTerms: String,
  rating: Number,
  outstandingPaise: { type: Number, default: 0 },
  notes: String,
});
supplierSchema.plugin(baseFieldsPlugin);

export type Supplier = InferSchemaType<typeof supplierSchema> & BaseFields;
export const SupplierModel = model<Supplier>("Supplier", supplierSchema);

/* ------------------------------------------------------------------ Attendance */

const attendanceSchema = new Schema({
  staff: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  date: { type: Date, required: true },
  checkIn: Date,
  checkOut: Date,
  hours: Number,
  status: { type: String, enum: ["in", "out", "absent", "leave"], default: "in" },
  notes: String,
});
attendanceSchema.plugin(baseFieldsPlugin);
attendanceSchema.index({ clinicId: 1, date: -1 });

export type Attendance = InferSchemaType<typeof attendanceSchema> & BaseFields;
export const AttendanceModel = model<Attendance>("Attendance", attendanceSchema);
