import { z } from "zod";
import { LAB_STATUS } from "../../shared/enums";

/*
 * Operations validators (spec 2.9 / 4.11). Inventory, suppliers, purchase
 * orders and lab cases. Money is integer paise; quantities are integers.
 * String schemas double as the first line against NoSQL-operator injection.
 */

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const paise = z.number().int().nonnegative();

/* ------------------------------------------------------------------ Inventory */

export const createInventoryItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  sku: z.string().optional(),
  unit: z.string().default("unit"),
  stock: z.number().int().min(0).default(0),
  reorderLevel: z.number().int().min(0).default(0),
  reorderQty: z.number().int().min(0).default(0),
  unitCostPaise: paise.default(0),
  sellingPricePaise: paise.optional(),
  supplier: objectId.optional(),
  location: z.string().optional(),
  consumable: z.boolean().default(true),
  linkedProcedures: z.array(objectId).optional(),
  batches: z
    .array(
      z.object({
        batchNumber: z.string().optional(),
        expiry: z.coerce.date().optional(),
        quantity: z.number().int().min(0).optional(),
        costPaise: paise.optional(),
      }),
    )
    .optional(),
});

export const updateInventoryItemSchema = createInventoryItemSchema.partial();

export const adjustStockSchema = z.object({
  // Signed delta: positive adds, negative removes.
  delta: z.number().int().refine((v) => v !== 0, "Delta cannot be zero"),
  type: z.enum(["purchase", "consumption", "adjustment", "return", "expiry", "transfer"]).default("adjustment"),
  reason: z.string().optional(),
  batchNumber: z.string().optional(),
  reference: z.string().optional(),
});

/* ------------------------------------------------------------------ Suppliers */

export const createSupplierSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["supplies", "lab", "equipment", "pharmacy"]).default("supplies"),
  contact: z
    .object({ phone: z.string().optional(), email: z.string().email().optional(), person: z.string().optional() })
    .optional(),
  gstin: z.string().optional(),
  paymentTerms: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

/* ------------------------------------------------------------- PurchaseOrders */

const poLineSchema = z.object({
  item: objectId,
  quantity: z.number().int().positive(),
  unitCostPaise: paise,
});

export const createPurchaseOrderSchema = z.object({
  supplier: objectId,
  expectedDate: z.coerce.date().optional(),
  lines: z.array(poLineSchema).min(1, "A purchase order needs at least one line"),
});

export const receivePurchaseOrderSchema = z.object({
  // Which lines arrived and how many units. Omitting a line marks it fully received.
  lines: z
    .array(z.object({ item: objectId, quantity: z.number().int().positive() }))
    .optional(),
});

/* ------------------------------------------------------------------ Lab cases */

export const createLabCaseSchema = z.object({
  patient: objectId,
  doctor: objectId.optional(),
  lab: objectId.optional(),
  labName: z.string().optional(),
  workType: z.string().optional(),
  teeth: z.array(z.number().int()).optional(),
  shade: z.string().optional(),
  material: z.string().optional(),
  impressionDate: z.coerce.date().optional(),
  sentDate: z.coerce.date().optional(),
  expectedReturn: z.coerce.date().optional(),
  costPaise: paise.optional(),
  notes: z.string().optional(),
});

export const updateLabCaseSchema = createLabCaseSchema.partial().omit({ patient: true });

export const setLabStatusSchema = z.object({
  status: z.enum(LAB_STATUS),
  remakeReason: z.string().optional(),
  note: z.string().optional(),
});
