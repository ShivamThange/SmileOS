import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

/*
 * Focused functional check for the modules added on this branch: operations,
 * communications, content, users, reputation. Exercises the real business
 * logic against an in-memory Mongo — the ledger, the consent gate, the review
 * routing, the session-window rule — not just the type-checker.
 */

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${label}`, detail ?? "");
  }
}
async function expectThrow(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    check(label + " (should have thrown)", false);
  } catch {
    check(label, true);
  }
}

async function main(): Promise<void> {
  const mem = await MongoMemoryServer.create({
    binary: { version: process.env.MONGOMS_VERSION ?? "7.0.14", os: { os: "linux", dist: "ubuntu", release: "22.04" } as never },
  });
  process.env.MONGO_URI = mem.getUri("dentalos");
  await mongoose.connect(process.env.MONGO_URI);

  const clinicId = new mongoose.Types.ObjectId().toString();
  const actorId = new mongoose.Types.ObjectId().toString();

  const models = await import("../models");
  const ops = await import("../modules/operations/operations.service");
  const comm = await import("../modules/communication/communication.service");
  const content = await import("../modules/content/content.service");
  const rep = await import("../modules/reputation/reputation.service");
  const users = await import("../modules/user/user.service");

  /* ---- Operations: stock ledger + PO receive + lab machine --------------- */
  console.log("\n=== operations ===");
  const item = await models.InventoryItemModel.create({ clinicId, name: "Composite", stock: 10, reorderLevel: 5 });
  await ops.adjustStock(clinicId, actorId, String(item._id), { delta: -3, type: "consumption" });
  const afterAdjust = await models.InventoryItemModel.findById(item._id).lean();
  check("stock decremented 10→7", afterAdjust?.stock === 7, afterAdjust?.stock);
  const mv = await models.StockMovementModel.findOne({ item: item._id }).lean();
  check("movement logs resulting balance", mv?.resultingBalance === 7, mv?.resultingBalance);
  await ops.adjustStock(clinicId, actorId, String(item._id), { delta: -100, type: "consumption" });
  const floored = await models.InventoryItemModel.findById(item._id).lean();
  check("stock floored at 0 (never negative)", floored?.stock === 0, floored?.stock);

  const supplier = await models.SupplierModel.create({ clinicId, name: "DentalSupplies Co" });
  const po = (await ops.createPurchaseOrder(clinicId, actorId, {
    supplier: String(supplier._id),
    lines: [{ item: String(item._id), quantity: 20, unitCostPaise: 5000 }],
  })) as { _id: unknown; totalPaise: number };
  check("PO total computed (20 × 5000 = 100000 paise)", po.totalPaise === 100000, po.totalPaise);
  await ops.receivePurchaseOrder(clinicId, actorId, String(po._id));
  const received = await models.InventoryItemModel.findById(item._id).lean();
  check("receiving PO adds stock 0→20", received?.stock === 20, received?.stock);
  const poDoc = await models.PurchaseOrderModel.findById(po._id).lean();
  check("PO marked received", poDoc?.status === "received", poDoc?.status);

  const labCase = await models.LabCaseModel.create({ clinicId, patient: new mongoose.Types.ObjectId(), status: "impression" });
  await ops.setLabStatus(clinicId, actorId, String(labCase._id), "received");
  const labAfter = await models.LabCaseModel.findById(labCase._id).lean();
  check("lab status → received stamps actualReturn", Boolean(labAfter?.actualReturn), labAfter?.actualReturn);
  await ops.setLabStatus(clinicId, actorId, String(labCase._id), "fitted");
  await expectThrow("terminal lab status is locked", () =>
    ops.setLabStatus(clinicId, actorId, String(labCase._id), "impression"),
  );

  /* ---- Communication: session-window rule -------------------------------- */
  console.log("\n=== communication ===");
  const openConv = await models.ConversationModel.create({ clinicId, channel: "whatsapp", externalThreadId: "9199", sessionWindowExpiresAt: new Date(Date.now() + 3600_000) });
  const closedConv = await models.ConversationModel.create({ clinicId, channel: "whatsapp", externalThreadId: "9188", sessionWindowExpiresAt: new Date(Date.now() - 3600_000) });
  check("within-window detection (open)", comm.withinSessionWindow(openConv) === true);
  check("within-window detection (closed)", comm.withinSessionWindow(closedConv) === false);
  await comm.sendMessage(clinicId, actorId, String(openConv._id), { content: "Hi there" });
  const msg = await models.MessageModel.findOne({ conversation: openConv._id }).lean();
  check("free-form message recorded inside window", msg?.content === "Hi there");
  await expectThrow("free-form refused outside window", () =>
    comm.sendMessage(clinicId, actorId, String(closedConv._id), { content: "blocked" }),
  );
  const tpl = await models.MessageTemplateModel.create({ clinicId, name: "reminder", body: "Reminder", approvalStatus: "approved" });
  const sent = await comm.sendMessage(clinicId, actorId, String(closedConv._id), { template: String(tpl._id) });
  check("approved template sends outside window", Boolean((sent.message as { _id: unknown })._id));
  const draftTpl = await models.MessageTemplateModel.create({ clinicId, name: "draft", body: "x", approvalStatus: "draft" });
  await expectThrow("unapproved template refused", () =>
    comm.sendMessage(clinicId, actorId, String(closedConv._id), { template: String(draftTpl._id) }),
  );

  /* ---- Content: gallery consent gate ------------------------------------- */
  console.log("\n=== content ===");
  await expectThrow("clinical gallery blocked without consent", () =>
    content.saveGallery(clinicId, actorId, null, { title: "Case", isClinical: true, consentObtained: false, published: true }),
  );
  const okGallery = (await content.saveGallery(clinicId, actorId, null, { title: "Case", isClinical: true, consentObtained: true, published: true })) as { published: boolean };
  check("clinical gallery publishes with consent", okGallery.published === true);
  const blog = (await content.saveBlog(clinicId, actorId, null, { slug: "hello", title: "Hello", status: "published" })) as { publishedAt?: Date };
  check("blog publishedAt stamped on publish", Boolean(blog.publishedAt));

  /* ---- Reputation: review routing + empty-audience guard ------------------ */
  console.log("\n=== reputation ===");
  const goodReview = await models.ReviewModel.create({ clinicId, patient: new mongoose.Types.ObjectId(), token: "good-token", responseStatus: "pending" });
  void goodReview;
  const good = await rep.submitReview("good-token", 5, "great");
  check("5-star routes to public", good.routedToPublic === true && Boolean(good.publicLink));
  await models.ReviewModel.create({ clinicId, patient: new mongoose.Types.ObjectId(), token: "bad-token", responseStatus: "pending" });
  const bad = await rep.submitReview("bad-token", 2, "not happy");
  check("2-star stays internal (recovery)", bad.routedToPublic === false);
  const badDoc = await models.ReviewModel.findOne({ token: "bad-token" }).lean();
  check("poor review flagged for recovery", badDoc?.responseStatus === "recovery");

  const campaign = await models.CampaignModel.create({ clinicId, name: "Recall", segment: { status: "active" } });
  await expectThrow("campaign refuses empty audience", () => rep.sendCampaign(clinicId, actorId, String(campaign._id)));
  await models.PatientModel.create({ clinicId, firstName: "Asha", phone: "9990001111", status: "active" });
  const preview = await rep.previewAudience(clinicId, { status: "active" });
  check("audience preview counts real patients", preview.count === 1, preview.count);

  /* ---- Users: permission overrides + doctor performance ------------------ */
  console.log("\n=== users ===");
  const doc = await users.inviteUser(clinicId, actorId, { name: "Dr Meher", email: "dr@x.in", role: "doctor" });
  check("invited user is active", doc.active === true);
  const withPerms = await users.setPermissions(clinicId, actorId, String(doc._id), ["settings:read"], ["invoice:read"]);
  const eff = users.serialiseWithPermissions(withPerms).effectivePermissions as string[];
  check("grant added to effective set", eff.includes("settings:read"));
  check("denial removed from effective set", !eff.includes("invoice:read"));
  const perf = await users.doctorPerformance(clinicId, String(doc._id), new Date(Date.now() - 86_400_000), new Date());
  check("doctor performance returns a shape", typeof perf.caseAcceptanceRate === "number");

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  await mongoose.disconnect();
  await mem.stop();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
