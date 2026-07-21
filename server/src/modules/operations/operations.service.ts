import {
  InventoryItemModel,
  StockMovementModel,
  PurchaseOrderModel,
  LabCaseModel,
  type PurchaseOrder,
} from "../../models/operations.model";
import { LAB_STATUS, type LabStatus } from "../../shared/enums";
import { errors } from "../../shared/errors";

/*
 * Operations service (spec 2.9 / 4.11). Holds the cross-collection business
 * logic the controllers must not: stock movements always accompany a stock
 * change and record the resulting balance; receiving a purchase order both
 * increments stock and logs a movement; the lab-case lifecycle is a small
 * state machine. Money is integer paise throughout.
 */

type MovementType = "purchase" | "consumption" | "adjustment" | "return" | "expiry" | "transfer";

/**
 * Apply a signed stock delta to an item and record the movement in one place,
 * so the on-hand figure and its ledger can never drift. Stock is floored at 0.
 */
export async function adjustStock(
  clinicId: string,
  actorId: string,
  itemId: string,
  input: { delta: number; type?: MovementType; reason?: string; batchNumber?: string; reference?: string },
): Promise<{ item: unknown; movement: unknown }> {
  const item = await InventoryItemModel.findOne({ _id: itemId, clinicId });
  if (!item) throw errors.notFound("Inventory item");

  const before = item.stock ?? 0;
  const after = Math.max(0, before + input.delta);
  item.stock = after;
  item.updatedBy = actorId as never;
  await item.save();

  const movement = await StockMovementModel.create({
    clinicId,
    item: item._id,
    type: input.type ?? "adjustment",
    quantity: input.delta,
    reason: input.reason,
    batchNumber: input.batchNumber,
    reference: input.reference,
    performedBy: actorId,
    resultingBalance: after,
    createdBy: actorId,
  });

  return { item, movement };
}

/**
 * Deduct the consumables linked to a completed procedure (spec 3.3 — auto
 * deduction on completion). Best-effort: an item that can't be found is
 * skipped, not fatal, so a stock gap never blocks a clinical action.
 */
export async function deductForProcedure(
  clinicId: string,
  actorId: string,
  procedureId: string,
  reference: string,
): Promise<number> {
  const items = await InventoryItemModel.find({ clinicId, consumable: true, linkedProcedures: procedureId }).select("_id");
  let count = 0;
  for (const it of items) {
    await adjustStock(clinicId, actorId, String(it._id), {
      delta: -1,
      type: "consumption",
      reason: "Procedure completed",
      reference,
    });
    count += 1;
  }
  return count;
}

/** Items at or below their reorder level — the low-stock alert feed. */
export async function lowStock(clinicId: string): Promise<unknown[]> {
  const items = await InventoryItemModel.find({ clinicId }).lean();
  return items.filter((it) => (it.stock ?? 0) <= (it.reorderLevel ?? 0));
}

/** Items with a batch expiring within `days` (default 30). */
export async function expiringSoon(clinicId: string, days = 30): Promise<unknown[]> {
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const items = await InventoryItemModel.find({ clinicId, "batches.expiry": { $lte: cutoff } }).lean();
  return items
    .map((it) => {
      const soon = (it.batches ?? [])
        .filter((b) => b.expiry && new Date(b.expiry) <= cutoff)
        .sort((a, b) => new Date(a.expiry!).getTime() - new Date(b.expiry!).getTime());
      return { ...it, expiringBatches: soon };
    })
    .filter((it) => it.expiringBatches.length > 0);
}

/* ------------------------------------------------------------- PurchaseOrders */

function poTotal(lines: PurchaseOrder["lines"]): number {
  return (lines ?? []).reduce((sum, l) => sum + (l.quantity ?? 0) * (l.unitCostPaise ?? 0), 0);
}

export async function createPurchaseOrder(
  clinicId: string,
  actorId: string,
  input: { supplier: string; expectedDate?: Date; lines: { item: string; quantity: number; unitCostPaise: number }[] },
): Promise<unknown> {
  return PurchaseOrderModel.create({
    clinicId,
    supplier: input.supplier,
    expectedDate: input.expectedDate,
    lines: input.lines,
    totalPaise: poTotal(input.lines as never),
    status: "ordered",
    createdBy: actorId,
  });
}

/**
 * Receive some or all of a purchase order. Each received line increments the
 * item's stock and logs a `purchase` movement; the PO moves to `partial` or
 * `received` depending on whether every ordered unit has now arrived.
 */
export async function receivePurchaseOrder(
  clinicId: string,
  actorId: string,
  poId: string,
  received?: { item: string; quantity: number }[],
): Promise<unknown> {
  const po = await PurchaseOrderModel.findOne({ _id: poId, clinicId });
  if (!po) throw errors.notFound("Purchase order");
  if (po.status === "received") throw errors.conflictState("This purchase order is already fully received");
  if (po.status === "cancelled") throw errors.conflictState("A cancelled purchase order cannot be received");

  // Default: receive every ordered line in full.
  const toReceive =
    received && received.length > 0
      ? received
      : (po.lines ?? []).map((l) => ({ item: String(l.item), quantity: l.quantity ?? 0 }));

  for (const line of toReceive) {
    if (line.quantity <= 0) continue;
    await adjustStock(clinicId, actorId, line.item, {
      delta: line.quantity,
      type: "purchase",
      reason: "PO received",
      reference: String(po._id),
    });
  }

  // Track cumulative received quantity per item to decide partial vs. full.
  po.received.push({ date: new Date(), lines: toReceive } as never);
  const receivedByItem = new Map<string, number>();
  for (const batch of po.received) {
    for (const l of ((batch.lines as { item: string; quantity: number }[]) ?? [])) {
      receivedByItem.set(l.item, (receivedByItem.get(l.item) ?? 0) + l.quantity);
    }
  }
  const complete = (po.lines ?? []).every((l) => (receivedByItem.get(String(l.item)) ?? 0) >= (l.quantity ?? 0));
  po.status = complete ? "received" : "partial";
  po.updatedBy = actorId as never;
  await po.save();
  return po;
}

/* ------------------------------------------------------------------ Lab cases */

// Terminal states cannot transition further; a remake reopens the workflow.
const LAB_TERMINAL: LabStatus[] = ["fitted", "cancelled"];

export async function setLabStatus(
  clinicId: string,
  actorId: string,
  caseId: string,
  status: LabStatus,
  opts: { remakeReason?: string; note?: string } = {},
): Promise<unknown> {
  if (!LAB_STATUS.includes(status)) throw errors.validation({ status: "Unknown lab status" });
  const labCase = await LabCaseModel.findOne({ _id: caseId, clinicId });
  if (!labCase) throw errors.notFound("Lab case");
  if (LAB_TERMINAL.includes(labCase.status as LabStatus) && status !== "remake") {
    throw errors.conflictState(`A ${labCase.status} lab case cannot change status`);
  }

  labCase.status = status;
  if (status === "received" && !labCase.actualReturn) labCase.actualReturn = new Date();
  if (status === "remake") labCase.remakeReason = opts.remakeReason;
  if (opts.note) labCase.notes = [labCase.notes, opts.note].filter(Boolean).join("\n");
  labCase.updatedBy = actorId as never;
  await labCase.save();
  return labCase;
}

/** Cases due within `days` (default 7) and not yet returned. */
export function dueFilter(days = 7): Record<string, unknown> {
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return {
    status: { $nin: ["received", "fitted", "cancelled"] },
    expectedReturn: { $lte: cutoff },
  };
}

/** Cases past their expected return and not yet back — the overdue feed. */
export function overdueFilter(): Record<string, unknown> {
  return {
    status: { $nin: ["received", "fitted", "cancelled"] },
    expectedReturn: { $lt: new Date() },
  };
}
