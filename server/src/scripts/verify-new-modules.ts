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
  const inbound = await comm.recordInbound("9188", "Reply from patient", "wamid.123");
  const inMsg = await models.MessageModel.findOne({ conversation: closedConv._id, direction: "in" }).lean();
  check("inbound message appended to thread", inbound === true && inMsg?.content === "Reply from patient");
  const reopened = await models.ConversationModel.findById(closedConv._id).lean();
  check("inbound reopens the session window", comm.withinSessionWindow(reopened as never) === true);
  check("inbound from unknown sender is a no-op", (await comm.recordInbound("0000", "x")) === false);

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

  /* ---- Background jobs: scheduled handlers ------------------------------- */
  console.log("\n=== jobs ===");
  const jobs = await import("../jobs/handlers");
  // A real clinic + owner/admin so the cluster-wide handlers have a tenant.
  const clinic = await models.ClinicModel.create({ name: "Meher Dental", slug: `meher-${Date.now()}` });
  const jClinicId = String(clinic._id);
  const admin = await models.UserModel.create({ clinicId: jClinicId, name: "Owner", email: `owner-${Date.now()}@x.in`, role: "owner", active: true });
  void admin;

  await models.InventoryItemModel.create({ clinicId: jClinicId, name: "Gloves", stock: 1, reorderLevel: 10 });
  const invResult = (await jobs.runInventoryAlerts()) as { alerts: number };
  check("inventory-alerts notifies on low stock", invResult.alerts >= 1, invResult.alerts);
  const secondRun = (await jobs.runInventoryAlerts()) as { alerts: number };
  check("inventory-alerts is idempotent within a day", secondRun.alerts === 0, secondRun.alerts);

  await models.InstalmentPlanModel.create({
    clinicId: jClinicId,
    patient: new mongoose.Types.ObjectId(),
    totalPaise: 300000,
    status: "active",
    schedule: [{ sequence: 1, dueDate: new Date(Date.now() - 5 * 86_400_000), amountPaise: 100000, status: "pending" }],
  });
  const instResult = (await jobs.runOverdueInstalments()) as { plans: number; reminders: number };
  check("overdue-instalments marks + reminds", instResult.reminders >= 1, instResult);
  const instAfter = await models.InstalmentPlanModel.findOne({ clinicId: jClinicId }).lean();
  check("instalment entry flipped to overdue", instAfter?.schedule?.[0]?.status === "overdue");

  await models.PatientModel.create({ clinicId: jClinicId, patientNumber: "P-001", firstName: "Lapsed", phone: "9000000001", status: "active", lastVisit: new Date(Date.now() - 200 * 86_400_000) });
  const recallResult = (await jobs.runRecallGenerator()) as { created: number };
  check("recall-generator creates for lapsed patient", recallResult.created >= 1, recallResult.created);
  const recallAgain = (await jobs.runRecallGenerator()) as { created: number };
  check("recall-generator skips patients with an open recall", recallAgain.created === 0, recallAgain.created);

  const bday = new Date(); bday.setFullYear(1990);
  await models.PatientModel.create({ clinicId: jClinicId, patientNumber: "P-002", firstName: "Birthday", phone: "9000000002", status: "active", dob: bday, marketingConsent: { whatsapp: true } });
  const bdayResult = (await jobs.runBirthdayGreetings()) as { greeted: number };
  check("birthday-greetings queues today's birthdays", bdayResult.greeted >= 1, bdayResult.greeted);

  const digestResult = (await jobs.runOwnerDigest()) as { digests: number };
  check("owner-digest queues a digest per owner", digestResult.digests >= 1, digestResult.digests);

  /* ---- Event fan-out: appointment completed ------------------------------ */
  console.log("\n=== events ===");
  const events = await import("../jobs/events");
  const proc = new mongoose.Types.ObjectId();
  const consumable = await models.InventoryItemModel.create({ clinicId: jClinicId, name: "Anaesthetic", stock: 5, consumable: true, linkedProcedures: [proc] });
  const evtPatient = await models.PatientModel.create({ clinicId: jClinicId, patientNumber: "P-003", firstName: "Evt", phone: "9000000003", status: "active" });
  const appt = await models.AppointmentModel.create({ clinicId: jClinicId, patient: evtPatient._id, doctor: new mongoose.Types.ObjectId(), start: new Date(), end: new Date(Date.now() + 1800_000), durationMinutes: 30, procedures: [proc], status: "completed" });
  await events.onAppointmentCompleted(jClinicId, actorId, String(appt._id));
  const deducted = await models.InventoryItemModel.findById(consumable._id).lean();
  check("completion deducts linked consumable 5→4", deducted?.stock === 4, deducted?.stock);
  const reviewReq = await models.ReviewModel.findOne({ clinicId: jClinicId, appointment: appt._id }).lean();
  check("completion queues a review request", Boolean(reviewReq));
  await events.onAppointmentCompleted(jClinicId, actorId, String(appt._id));
  const reviewCount = await models.ReviewModel.countDocuments({ clinicId: jClinicId, appointment: appt._id });
  check("review request is not duplicated on re-fire", reviewCount === 1, reviewCount);

  /* ---- Analytics report library ----------------------------------------- */
  console.log("\n=== analytics reports ===");
  const reports = await import("../modules/analytics/reports.service");
  const doctorId = new mongoose.Types.ObjectId();
  const inv = await models.InvoiceModel.create({ clinicId: jClinicId, patient: evtPatient._id, performingDoctor: doctorId, totalPaise: 500000, status: "paid" });
  await models.PaymentModel.create({ clinicId: jClinicId, patient: evtPatient._id, invoice: inv._id, amountPaise: 500000, mode: "cash", status: "success", date: new Date() });
  const range = { from: new Date(Date.now() - 7 * 86_400_000), to: new Date(), groupBy: "day" as const, compare: true };
  const revenue = await reports.runReport("revenue", jClinicId, range);
  check("revenue report totals the invoice", revenue.totals.valuePaise === 500000, revenue.totals.valuePaise);
  check("revenue report carries a comparison window", Boolean(revenue.comparison));
  const collections = await reports.runReport("collections", jClinicId, range);
  check("collections report totals the payment", collections.totals.collectedPaise === 500000, collections.totals.collectedPaise);
  const csv = reports.toCsv(revenue);
  check("report exports as CSV with a header row", csv.split("\n")[0].includes("period"), csv.split("\n")[0]);
  const plan = await models.TreatmentPlanModel.create({ clinicId: jClinicId, patient: evtPatient._id, doctor: doctorId, status: "presented" });
  await models.TreatmentPlanItemModel.create({ clinicId: jClinicId, plan: plan._id, patient: evtPatient._id, name: "Implant", quantity: 1, lineTotalPaise: 400000, status: "accepted", presentedAt: new Date() });
  await models.TreatmentPlanItemModel.create({ clinicId: jClinicId, plan: plan._id, patient: evtPatient._id, name: "Crown", quantity: 1, lineTotalPaise: 100000, status: "declined", presentedAt: new Date() });
  const acceptance = await reports.runReport("case-acceptance", jClinicId, range);
  check("case-acceptance report computes rate (1 of 2 = 50%)", acceptance.totals.acceptanceRatePct === 50, acceptance.totals.acceptanceRatePct);
  const treatments = await reports.runReport("treatments", jClinicId, range);
  check("treatments report ranks procedures by value", (treatments.series[0] as { procedure: string }).procedure === "Implant", treatments.series[0]);

  /* ---- Compliance / DPDP ------------------------------------------------- */
  console.log("\n=== compliance ===");
  const compliance = await import("../modules/compliance/compliance.service");
  const dpdpPatient = await models.PatientModel.create({ clinicId: jClinicId, patientNumber: "P-004", firstName: "Priya", lastName: "Sharma", phone: "9000000004", email: "priya@x.in", dob: new Date(1992, 3, 1), status: "active", marketingConsent: { whatsapp: true, sms: true, email: true } });
  const exportData = await compliance.patientDataExport(jClinicId, String(dpdpPatient._id)) as { counts: Record<string, number>; patient: unknown };
  check("data export assembles patient + record counts", typeof exportData.counts.appointments === "number" && Boolean(exportData.patient));
  await compliance.withdrawConsent(jClinicId, actorId, String(dpdpPatient._id));
  const afterWithdraw = await models.PatientModel.findById(dpdpPatient._id).lean();
  check("consent withdrawal clears all channels", afterWithdraw?.marketingConsent?.whatsapp === false && afterWithdraw?.marketingConsent?.email === false);
  await compliance.anonymisePatient(jClinicId, actorId, String(dpdpPatient._id));
  const erased = await models.PatientModel.findById(dpdpPatient._id).lean();
  check("erasure redacts direct identifiers", erased?.firstName === "Redacted" && !erased?.email && !erased?.dob);
  check("erasure retains the record + tags it", erased?.tags?.includes("erased") === true);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  await mongoose.disconnect();
  await mem.stop();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
