import type { Request, Response } from "express";
import { ok, created } from "../../shared/envelope";
import { paginate } from "../../shared/list";
import { errors } from "../../shared/errors";
import { recordAudit } from "../../services/audit.service";
import {
  InventoryItemModel,
  StockMovementModel,
  PurchaseOrderModel,
  SupplierModel,
  LabCaseModel,
} from "../../models/operations.model";
import * as svc from "./operations.service";

/* Operations controller (spec 4.11). Thin HTTP translation over the service. */

/* ------------------------------------------------------------------ Inventory */

export async function listInventory(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.supplier) filter.supplier = req.query.supplier;
  if (req.query.q) filter.name = { $regex: String(req.query.q), $options: "i" };
  return paginate(req, res, InventoryItemModel, filter, { defaultSort: "name", populate: ["supplier"], maxLimit: 200 });
}

export async function lowStock(req: Request, res: Response): Promise<Response> {
  return ok(res, await svc.lowStock(req.clinicId!));
}

export async function expiring(req: Request, res: Response): Promise<Response> {
  const days = req.query.days ? parseInt(String(req.query.days), 10) : 30;
  return ok(res, await svc.expiringSoon(req.clinicId!, days));
}

export async function createInventory(req: Request, res: Response): Promise<Response> {
  const item = await InventoryItemModel.create({ ...req.body, clinicId: req.clinicId, createdBy: req.auth!.userId });
  recordAudit(req, { action: "inventory.create", resourceType: "inventory", resourceId: String(item._id) });
  return created(res, item, "Inventory item created");
}

export async function getInventory(req: Request, res: Response): Promise<Response> {
  const item = await InventoryItemModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).populate("supplier").lean();
  if (!item) throw errors.notFound("Inventory item");
  return ok(res, item);
}

export async function updateInventory(req: Request, res: Response): Promise<Response> {
  const item = await InventoryItemModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { ...req.body, updatedBy: req.auth!.userId },
    { new: true },
  ).lean();
  if (!item) throw errors.notFound("Inventory item");
  recordAudit(req, { action: "inventory.update", resourceType: "inventory", resourceId: req.params.id });
  return ok(res, item);
}

export async function deleteInventory(req: Request, res: Response): Promise<Response> {
  const item = await InventoryItemModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!item) throw errors.notFound("Inventory item");
  await (item as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  recordAudit(req, { action: "inventory.delete", resourceType: "inventory", resourceId: req.params.id });
  return ok(res, { deleted: true });
}

export async function adjustStock(req: Request, res: Response): Promise<Response> {
  const result = await svc.adjustStock(req.clinicId!, req.auth!.userId, req.params.id, req.body);
  recordAudit(req, { action: "inventory.adjust", resourceType: "inventory", resourceId: req.params.id, after: { delta: req.body.delta } });
  return ok(res, result, { message: "Stock adjusted" });
}

export async function movements(req: Request, res: Response): Promise<Response> {
  return paginate(req, res, StockMovementModel, { item: req.params.id }, { defaultSort: "createdAt", populate: ["performedBy"], maxLimit: 200 });
}

/* ------------------------------------------------------------------ Suppliers */

export async function listSuppliers(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.q) filter.name = { $regex: String(req.query.q), $options: "i" };
  return paginate(req, res, SupplierModel, filter, { defaultSort: "name", maxLimit: 200 });
}

export async function createSupplier(req: Request, res: Response): Promise<Response> {
  const supplier = await SupplierModel.create({ ...req.body, clinicId: req.clinicId, createdBy: req.auth!.userId });
  recordAudit(req, { action: "supplier.create", resourceType: "inventory", resourceId: String(supplier._id) });
  return created(res, supplier, "Supplier created");
}

export async function getSupplier(req: Request, res: Response): Promise<Response> {
  const supplier = await SupplierModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).lean();
  if (!supplier) throw errors.notFound("Supplier");
  return ok(res, supplier);
}

export async function updateSupplier(req: Request, res: Response): Promise<Response> {
  const supplier = await SupplierModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { ...req.body, updatedBy: req.auth!.userId },
    { new: true },
  ).lean();
  if (!supplier) throw errors.notFound("Supplier");
  recordAudit(req, { action: "supplier.update", resourceType: "inventory", resourceId: req.params.id });
  return ok(res, supplier);
}

export async function deleteSupplier(req: Request, res: Response): Promise<Response> {
  const supplier = await SupplierModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!supplier) throw errors.notFound("Supplier");
  await (supplier as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  recordAudit(req, { action: "supplier.delete", resourceType: "inventory", resourceId: req.params.id });
  return ok(res, { deleted: true });
}

/* ------------------------------------------------------------- PurchaseOrders */

export async function listPurchaseOrders(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.supplier) filter.supplier = req.query.supplier;
  return paginate(req, res, PurchaseOrderModel, filter, { defaultSort: "orderDate", populate: ["supplier"], maxLimit: 200 });
}

export async function createPurchaseOrder(req: Request, res: Response): Promise<Response> {
  const po = await svc.createPurchaseOrder(req.clinicId!, req.auth!.userId, req.body);
  recordAudit(req, { action: "purchase_order.create", resourceType: "inventory", resourceId: String((po as { _id: unknown })._id) });
  return created(res, po, "Purchase order created");
}

export async function getPurchaseOrder(req: Request, res: Response): Promise<Response> {
  const po = await PurchaseOrderModel.findOne({ _id: req.params.id, clinicId: req.clinicId })
    .populate("supplier")
    .populate("lines.item")
    .lean();
  if (!po) throw errors.notFound("Purchase order");
  return ok(res, po);
}

export async function receivePurchaseOrder(req: Request, res: Response): Promise<Response> {
  const po = await svc.receivePurchaseOrder(req.clinicId!, req.auth!.userId, req.params.id, req.body.lines);
  recordAudit(req, { action: "purchase_order.receive", resourceType: "inventory", resourceId: req.params.id });
  return ok(res, po, { message: "Stock received" });
}

export async function cancelPurchaseOrder(req: Request, res: Response): Promise<Response> {
  const po = await PurchaseOrderModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!po) throw errors.notFound("Purchase order");
  if (po.status === "received") throw errors.conflictState("A received purchase order cannot be cancelled");
  po.status = "cancelled";
  po.updatedBy = req.auth!.userId as never;
  await po.save();
  recordAudit(req, { action: "purchase_order.cancel", resourceType: "inventory", resourceId: req.params.id });
  return ok(res, po, { message: "Purchase order cancelled" });
}

/* ------------------------------------------------------------------ Lab cases */

export async function listLabCases(req: Request, res: Response): Promise<Response> {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.patient) filter.patient = req.query.patient;
  if (req.query.doctor) filter.doctor = req.query.doctor;
  return paginate(req, res, LabCaseModel, filter, { defaultSort: "expectedReturn", populate: ["patient", "lab"], maxLimit: 200 });
}

export async function dueLabCases(req: Request, res: Response): Promise<Response> {
  const days = req.query.days ? parseInt(String(req.query.days), 10) : 7;
  return paginate(req, res, LabCaseModel, svc.dueFilter(days), { defaultSort: "expectedReturn", populate: ["patient", "lab"], maxLimit: 200 });
}

export async function overdueLabCases(req: Request, res: Response): Promise<Response> {
  return paginate(req, res, LabCaseModel, svc.overdueFilter(), { defaultSort: "expectedReturn", populate: ["patient", "lab"], maxLimit: 200 });
}

export async function createLabCase(req: Request, res: Response): Promise<Response> {
  const labCase = await LabCaseModel.create({ ...req.body, clinicId: req.clinicId, createdBy: req.auth!.userId });
  recordAudit(req, { action: "lab_case.create", resourceType: "lab_case", resourceId: String(labCase._id), patient: labCase.patient });
  return created(res, labCase, "Lab case created");
}

export async function getLabCase(req: Request, res: Response): Promise<Response> {
  const labCase = await LabCaseModel.findOne({ _id: req.params.id, clinicId: req.clinicId }).populate("patient lab doctor").lean();
  if (!labCase) throw errors.notFound("Lab case");
  return ok(res, labCase);
}

export async function updateLabCase(req: Request, res: Response): Promise<Response> {
  const labCase = await LabCaseModel.findOneAndUpdate(
    { _id: req.params.id, clinicId: req.clinicId },
    { ...req.body, updatedBy: req.auth!.userId },
    { new: true },
  ).lean();
  if (!labCase) throw errors.notFound("Lab case");
  recordAudit(req, { action: "lab_case.update", resourceType: "lab_case", resourceId: req.params.id });
  return ok(res, labCase);
}

export async function setLabStatus(req: Request, res: Response): Promise<Response> {
  const labCase = await svc.setLabStatus(req.clinicId!, req.auth!.userId, req.params.id, req.body.status, req.body);
  recordAudit(req, { action: "lab_case.status", resourceType: "lab_case", resourceId: req.params.id, after: { status: req.body.status } });
  return ok(res, labCase, { message: "Lab case updated" });
}

export async function deleteLabCase(req: Request, res: Response): Promise<Response> {
  const labCase = await LabCaseModel.findOne({ _id: req.params.id, clinicId: req.clinicId });
  if (!labCase) throw errors.notFound("Lab case");
  await (labCase as unknown as { softDelete: (by?: unknown) => Promise<unknown> }).softDelete(req.auth!.userId);
  recordAudit(req, { action: "lab_case.delete", resourceType: "lab_case", resourceId: req.params.id });
  return ok(res, { deleted: true });
}
