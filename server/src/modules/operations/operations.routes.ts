import { Router } from "express";
import * as ctrl from "./operations.controller";
import { asyncHandler } from "../../shared/http";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant";
import { authorize } from "../../middleware/rbac";
import { requireDb } from "../../middleware/require-db";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  adjustStockSchema,
  createSupplierSchema,
  updateSupplierSchema,
  createPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  createLabCaseSchema,
  updateLabCaseSchema,
  setLabStatusSchema,
} from "./operations.validator";

/*
 * Operations routes (spec 4.11). Inventory / suppliers / purchase orders are
 * gated on the `inventory` resource; lab cases on `lab_case`. All are
 * tenant-scoped and require a live database.
 */
const guard = [requireDb, authenticate(), resolveTenant] as const;

/* ------------------------------------------------------------------ Inventory */

export const inventoryRouter = Router();
inventoryRouter.use(...guard);
inventoryRouter.get("/", authorize("inventory", "read"), asyncHandler(ctrl.listInventory));
inventoryRouter.get("/low-stock", authorize("inventory", "read"), asyncHandler(ctrl.lowStock));
inventoryRouter.get("/expiring", authorize("inventory", "read"), asyncHandler(ctrl.expiring));
inventoryRouter.post("/", authorize("inventory", "create"), validate({ body: createInventoryItemSchema }), asyncHandler(ctrl.createInventory));
inventoryRouter.get("/:id", authorize("inventory", "read"), asyncHandler(ctrl.getInventory));
inventoryRouter.patch("/:id", authorize("inventory", "update"), validate({ body: updateInventoryItemSchema }), asyncHandler(ctrl.updateInventory));
inventoryRouter.delete("/:id", authorize("inventory", "delete"), asyncHandler(ctrl.deleteInventory));
inventoryRouter.post("/:id/adjust", authorize("inventory", "update"), validate({ body: adjustStockSchema }), asyncHandler(ctrl.adjustStock));
inventoryRouter.get("/:id/movements", authorize("inventory", "read"), asyncHandler(ctrl.movements));

/* ------------------------------------------------------------------ Suppliers */

export const supplierRouter = Router();
supplierRouter.use(...guard);
supplierRouter.get("/", authorize("inventory", "read"), asyncHandler(ctrl.listSuppliers));
supplierRouter.post("/", authorize("inventory", "create"), validate({ body: createSupplierSchema }), asyncHandler(ctrl.createSupplier));
supplierRouter.get("/:id", authorize("inventory", "read"), asyncHandler(ctrl.getSupplier));
supplierRouter.patch("/:id", authorize("inventory", "update"), validate({ body: updateSupplierSchema }), asyncHandler(ctrl.updateSupplier));
supplierRouter.delete("/:id", authorize("inventory", "delete"), asyncHandler(ctrl.deleteSupplier));

/* ------------------------------------------------------------- PurchaseOrders */

export const purchaseOrderRouter = Router();
purchaseOrderRouter.use(...guard);
purchaseOrderRouter.get("/", authorize("inventory", "read"), asyncHandler(ctrl.listPurchaseOrders));
purchaseOrderRouter.post("/", authorize("inventory", "create"), validate({ body: createPurchaseOrderSchema }), asyncHandler(ctrl.createPurchaseOrder));
purchaseOrderRouter.get("/:id", authorize("inventory", "read"), asyncHandler(ctrl.getPurchaseOrder));
purchaseOrderRouter.post("/:id/receive", authorize("inventory", "update"), validate({ body: receivePurchaseOrderSchema }), asyncHandler(ctrl.receivePurchaseOrder));
purchaseOrderRouter.post("/:id/cancel", authorize("inventory", "update"), asyncHandler(ctrl.cancelPurchaseOrder));

/* ------------------------------------------------------------------ Lab cases */

export const labCaseRouter = Router();
labCaseRouter.use(...guard);
labCaseRouter.get("/", authorize("lab_case", "read"), asyncHandler(ctrl.listLabCases));
labCaseRouter.get("/due", authorize("lab_case", "read"), asyncHandler(ctrl.dueLabCases));
labCaseRouter.get("/overdue", authorize("lab_case", "read"), asyncHandler(ctrl.overdueLabCases));
labCaseRouter.post("/", authorize("lab_case", "create"), validate({ body: createLabCaseSchema }), asyncHandler(ctrl.createLabCase));
labCaseRouter.get("/:id", authorize("lab_case", "read"), asyncHandler(ctrl.getLabCase));
labCaseRouter.patch("/:id", authorize("lab_case", "update"), validate({ body: updateLabCaseSchema }), asyncHandler(ctrl.updateLabCase));
labCaseRouter.post("/:id/status", authorize("lab_case", "update"), validate({ body: setLabStatusSchema }), asyncHandler(ctrl.setLabStatus));
labCaseRouter.delete("/:id", authorize("lab_case", "delete"), asyncHandler(ctrl.deleteLabCase));
