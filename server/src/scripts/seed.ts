import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../config/logger";
import {
  ClinicModel, UserModel, OperatoryModel, ProcedureModel, PatientModel, MedicalHistoryModel,
  AppointmentModel, TreatmentPlanModel, TreatmentPlanItemModel, InvoiceModel, PaymentModel,
  LeadModel, RecallModel, InventoryItemModel, LabCaseModel, SupplierModel, CounterModel,
  InstalmentPlanModel, ConversationModel, MessageModel,
} from "../models";
import { hashPassword } from "../utils/password";
import {
  PROCEDURES, DOCTORS, ALLERGIES, FIRST_NAMES_M, FIRST_NAMES_F, LAST_NAMES, LOCALITIES,
  pick, chance, randInt, phone, daysAgo, daysFromNow,
} from "./seed-data";

/*
 * Demo clinic seed (spec 8.4). Generates coherent history for Meher Dental Care
 * — patients, appointments across statuses, treatment plans across every
 * acceptance state, invoices/payments, and (the demo money shot) an unscheduled
 * treatment backlog worth ₹8-15 lakh. Idempotent: wipes the clinic's data first.
 *
 * Counts are modest by default for a fast seed; raise SEED_SCALE for the full
 * spec volume (≈400 patients / 2,000 appointments).
 */

const R = (rupees: number) => rupees * 100;
const SCALE = Number(process.env.SEED_SCALE ?? 1);
const PATIENTS = Math.round(80 * SCALE);

/** Seed the demo clinic. Assumes an open Mongoose connection. Returns clinicId. */
export async function seedClinic(): Promise<string> {
  // ---- Clinic (upsert by slug) --------------------------------------------
  const clinic = await ClinicModel.findOneAndUpdate(
    { slug: env.DEFAULT_CLINIC_SLUG },
    {
      $set: {
        name: "Meher Dental Care", legalName: "Meher Dental Care LLP", shortInitial: "M",
        tagline: "Dentistry done gently, explained honestly.",
        description: "Fourteen years of implants, root canals and smile work in Aundh.",
        address: { line1: "2nd floor, Westend Centre", line2: "ITI Road", locality: "Aundh", city: "Pune", state: "Maharashtra", pincode: "411007" },
        phones: ["020 4890 1234", "+91 98220 10000"], email: "hello@meherdental.in",
        workingHours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, isOpen: d !== 0, open: "09:00", close: d === 6 ? "18:00" : "20:00" })),
      },
    },
    { new: true, upsert: true },
  );
  const clinicId = clinic._id;

  // Idempotent wipe of this clinic's transactional data.
  const models: mongoose.Model<unknown>[] = [UserModel, OperatoryModel, ProcedureModel, PatientModel, MedicalHistoryModel, AppointmentModel, TreatmentPlanModel, TreatmentPlanItemModel, InvoiceModel, PaymentModel, InstalmentPlanModel, LeadModel, RecallModel, ConversationModel, MessageModel, InventoryItemModel, LabCaseModel, SupplierModel] as unknown as mongoose.Model<unknown>[];
  await Promise.all(models.map((m) => m.deleteMany({ clinicId })));
  await CounterModel.deleteMany({ clinicId });
  logger.info("Cleared existing demo data");

  // ---- Users --------------------------------------------------------------
  const owner = await UserModel.create({
    clinicId, name: "Dr. Anjali Meher", email: "owner@meherdental.in", role: "owner",
    authProviders: ["otp", "password"], passwordHash: await hashPassword("password123"), active: true,
  });
  const doctorDocs = await Promise.all(DOCTORS.map((d, i) =>
    UserModel.create({
      clinicId, name: d.name, email: d.email, role: "doctor", authProviders: ["otp"], active: true,
      doctor: { registrationNumber: `MH-${1000 + i}`, qualifications: d.qualifications, specialisations: [d.speciality], yearsExperience: d.years, publicProfile: true, slug: d.slug, consultationFeePaise: R(500) },
    }),
  ));
  await UserModel.create({ clinicId, name: "Reena Fernandes", email: "reception@meherdental.in", role: "receptionist", authProviders: ["otp"], active: true });
  logger.info(`Users: ${doctorDocs.length + 2}`);

  // ---- Operatories --------------------------------------------------------
  const chairs = await Promise.all([1, 2, 3, 4].map((n) => OperatoryModel.create({ clinicId, name: `Chair ${n}`, active: true, color: "#20614E" })));

  // ---- Procedures ---------------------------------------------------------
  const procDocs = await Promise.all(PROCEDURES.map((p) =>
    ProcedureModel.create({
      clinicId, code: p.code, name: p.name, friendlyName: p.friendlyName, category: p.category,
      defaultPricePaise: R(p.price), tierPrices: { standard: R(p.price), premium: R(Math.round(p.price * 1.4)), luxury: R(Math.round(p.price * 1.9)) },
      toothSpecific: !!p.toothSpecific, surfaceSpecific: !!p.surfaceSpecific, requiresLab: !!p.requiresLab,
      requiresConsent: !!p.requiresConsent, defaultRecallIntervalDays: p.recall, publicVisible: !!p.publicVisible, displayOrder: p.order,
    }),
  ));
  const procByCode = Object.fromEntries(procDocs.map((p) => [p.code, p]));
  logger.info(`Procedures: ${procDocs.length}`);

  // ---- Patients + medical histories ---------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patients: any[] = [];
  for (let i = 0; i < PATIENTS; i++) {
    const male = chance(0.5);
    const firstName = male ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
    const lastName = pick(LAST_NAMES);
    const seq = i + 1;
    // A known portal test patient at seq 1; the rest get plausible emails so the
    // portal login (T1.3) has data to authenticate against.
    const email = seq === 1
      ? "patient@meherdental.in"
      : `${firstName}.${lastName}.${seq}@example.in`.toLowerCase();
    const patient = await PatientModel.create({
      clinicId, patientNumber: `MDC-${String(seq).padStart(4, "0")}`, firstName, lastName,
      gender: male ? "male" : "female", ageFallback: randInt(18, 72), phone: phone(), email,
      address: { locality: pick(LOCALITIES), city: "Pune" }, status: "active",
      firstVisit: daysAgo(randInt(30, 540)), lastVisit: daysAgo(randInt(1, 120)),
      createdBy: owner._id,
    });
    await MedicalHistoryModel.create({
      clinicId, patient: patient._id,
      allergies: chance(0.2) ? [{ substance: pick(ALLERGIES), reaction: "rash", severity: chance(0.3) ? "high" : "moderate" }] : [],
      conditions: { diabetes: chance(0.15), hypertension: chance(0.18), thyroid: chance(0.08) },
      tobacco: { uses: chance(0.2), form: "gutkha" },
    });
    patients.push(patient);
  }
  logger.info(`Patients: ${patients.length}`);

  // ---- Appointments: a per-patient visit history across up to 18 months -----
  // Generated per patient (so volume scales with the roster and every appt sits
  // in a real patient's timeline) between their first visit and today, plus a
  // forward book for the calendar. ~10% no-show, the rest completed; a small
  // slice cancelled. Batched via insertMany so a full-scale seed stays fast.
  const nowMs = Date.now();
  const apptDocs: Record<string, unknown>[] = [];
  const snap = (t: number) => {
    const dt = new Date(t);
    if (dt.getDay() === 0) dt.setDate(dt.getDate() + 1); // clinic closed Sundays → Monday
    dt.setHours(randInt(9, 18), chance(0.5) ? 0 : 30, 0, 0);
    return dt;
  };
  for (const patient of patients) {
    const firstMs = new Date(patient.firstVisit).getTime();
    const tenure = Math.max(nowMs - firstMs, 30 * 86400000);
    // 1–8 past visits, weighted toward a handful.
    const nVisits = pick([1, 2, 2, 3, 3, 4, 5, 6, 8]);
    for (let v = 0; v < nVisits; v++) {
      const frac = (v + Math.random() * 0.8) / nVisits;
      const start = snap(firstMs + tenure * frac);
      if (start.getTime() > nowMs) continue;
      const end = new Date(start.getTime() + 30 * 60000);
      const roll = Math.random();
      const status = roll < 0.1 ? "no_show" : roll < 0.18 ? "cancelled" : "completed";
      const proc = pick(procDocs);
      apptDocs.push({
        clinicId, patient: patient._id, doctor: pick(doctorDocs)._id, operatory: pick(chairs)._id, operatoryLabel: pick(chairs).name,
        start, end, durationMinutes: 30, type: "treatment", procedures: [proc._id], chiefComplaint: proc.name,
        status, source: pick(["phone", "walk_in", "online", "recall_campaign", "portal"]),
        completedAt: status === "completed" ? end : undefined, noShow: status === "no_show",
        createdBy: owner._id,
      });
    }
    // ~22% of patients carry a forward booking in the next fortnight.
    if (chance(0.22)) {
      const start = snap(nowMs + randInt(1, 14) * 86400000);
      const end = new Date(start.getTime() + 30 * 60000);
      const proc = pick(procDocs);
      apptDocs.push({
        clinicId, patient: patient._id, doctor: pick(doctorDocs)._id, operatory: pick(chairs)._id, operatoryLabel: pick(chairs).name,
        start, end, durationMinutes: 30, type: "treatment", procedures: [proc._id], chiefComplaint: proc.name,
        status: pick(["scheduled", "confirmed"]), source: pick(["phone", "online", "portal", "recall_campaign"]),
        createdBy: owner._id,
      });
    }
  }
  await AppointmentModel.insertMany(apptDocs);
  logger.info(`Appointments: ${apptDocs.length} (per-patient history + forward book)`);

  // ---- Treatment plans across acceptance states ---------------------------
  // Deliberately build an unscheduled backlog of ₹8-15L via presented/partially-
  // accepted plans whose high-value items stay proposed/accepted with no appt.
  const HIGH_VALUE = ["IMPLANT", "IMPLANT-CROWN", "CROWN-ZIR", "VENEER", "ALIGNER", "DENTURE-U", "RCT-M", "GUM"];
  let backlogPaise = 0;
  let planCount = 0;
  const targetBacklog = R(1050000); // ₹10.5L

  for (const patient of patients) {
    if (backlogPaise >= targetBacklog && chance(0.7)) break;
    if (!chance(0.55)) continue;
    const doctor = pick(doctorDocs);
    const presentedAt = daysAgo(randInt(5, 90));
    const plan = await TreatmentPlanModel.create({
      clinicId, patient: patient._id, doctor: doctor._id, planDate: presentedAt, title: "Restorative plan",
      status: "presented", presentedAt, discountPct: chance(0.5) ? 10 : 0, createdBy: doctor._id,
    });
    planCount++;

    const itemN = randInt(1, 3);
    let anyAccepted = false, anyProposed = false;
    for (let j = 0; j < itemN; j++) {
      const proc = procByCode[pick(HIGH_VALUE)];
      const unit = proc.defaultPricePaise;
      // Distribution ~ 55% acceptance; leave a chunk unscheduled for the backlog.
      const roll = Math.random();
      const status = roll < 0.35 ? "accepted" : roll < 0.6 ? "proposed" : roll < 0.8 ? "completed" : "declined";
      if (status === "accepted") anyAccepted = true;
      if (status === "proposed") anyProposed = true;
      const item = await TreatmentPlanItemModel.create({
        clinicId, plan: plan._id, patient: patient._id, procedure: proc._id, name: proc.name,
        teeth: [randInt(11, 48)], quantity: 1, unitPricePaise: unit, lineTotalPaise: unit,
        priority: pick(["urgent", "recommended", "elective"]), status, presentedAt,
        followUp: (status === "accepted" || status === "proposed") ? { nextFollowUpDate: daysAgo(randInt(0, 10)), contactAttempts: randInt(0, 2) } : {},
        createdBy: doctor._id,
      });
      // Unscheduled backlog = accepted/proposed with no scheduled appointment.
      if ((status === "accepted" || status === "proposed")) backlogPaise += unit;
      void item;
    }
    // Roll plan status from items.
    plan.status = anyAccepted && anyProposed ? "partially_accepted" : anyAccepted ? "accepted" : "presented";
    await plan.save();
  }
  logger.info(`Treatment plans: ${planCount} · unscheduled backlog ≈ ₹${Math.round(backlogPaise / 100).toLocaleString("en-IN")}`);

  // ---- Invoices + payments across states ----------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoices: any[] = [];
  for (let i = 0; i < Math.round(60 * SCALE); i++) {
    const patient = pick(patients);
    const proc = pick(procDocs);
    const total = proc.defaultPricePaise;
    const inv = await InvoiceModel.create({
      clinicId, invoiceNumber: `INV-${String(2500 + i).padStart(4, "0")}`, patient: patient._id,
      date: daysAgo(randInt(1, 60)), dueDate: daysAgo(randInt(-30, 30)),
      lines: [{ procedure: proc._id, description: proc.name, quantity: 1, unitPricePaise: total, lineTotalPaise: total, performingDoctor: pick(doctorDocs)._id }],
      subtotalPaise: total, totalPaise: total, status: "unpaid", createdBy: owner._id,
    });
    const roll = Math.random();
    if (roll < 0.5) { await PaymentModel.create({ clinicId, invoice: inv._id, patient: patient._id, amountPaise: total, mode: pick(["upi", "card", "cash"]), status: "success", date: inv.date, receivedBy: owner._id }); inv.status = "paid"; }
    else if (roll < 0.7) { const part = Math.round(total / 2); await PaymentModel.create({ clinicId, invoice: inv._id, patient: patient._id, amountPaise: part, mode: "upi", status: "success", date: inv.date }); inv.status = "partial"; }
    else if (new Date(inv.dueDate!).getTime() < Date.now()) inv.status = "overdue";
    await inv.save();
    invoices.push(inv);
  }
  logger.info(`Invoices: ${invoices.length}`);

  // ---- Instalment plans (implants / ortho paid in parts) ------------------
  // Live plans with a mixed paid/due/overdue schedule — feeds the receivables
  // view and the overdue-reminder automation.
  let instCount = 0;
  for (let i = 0; i < Math.round(10 * SCALE); i++) {
    const patient = pick(patients);
    const total = R(randInt(60, 180) * 1000); // ₹60k–₹1.8L big-ticket treatment
    const count = pick([3, 4, 6]);
    const down = Math.round(total * 0.2);
    const perInstal = Math.round((total - down) / count);
    const startDaysAgo = randInt(20, 150);
    const schedule = Array.from({ length: count }, (_, k) => {
      const dueDate = daysAgo(startDaysAgo - k * 30);
      const past = dueDate.getTime() < Date.now();
      // Earlier instalments mostly paid; a couple slip to overdue.
      const status = !past ? "pending" : chance(0.8) ? "paid" : "overdue";
      return { sequence: k + 1, dueDate, amountPaise: perInstal, status };
    });
    const allPaid = schedule.every((s) => s.status === "paid");
    await InstalmentPlanModel.create({
      clinicId, patient: patient._id, totalPaise: total, downPaymentPaise: down, count, schedule,
      status: allPaid ? "completed" : "active", createdBy: owner._id,
    });
    instCount++;
  }
  logger.info(`Instalment plans: ${instCount}`);

  // ---- Leads across stages ------------------------------------------------
  // insertMany with timestamps:false so the historical createdAt survives (the
  // base-fields timestamps plugin would otherwise stamp it "now", making
  // time-to-first-contact meaningless). firstContactAt always follows createdAt.
  const LEAD_STAGES = ["new", "new", "contacted", "consult", "won", "lost"];
  const leadDocs = Array.from({ length: Math.round(50 * SCALE) }, () => {
    const male = chance(0.5);
    const stage = pick(LEAD_STAGES);
    const createdAt = daysAgo(randInt(1, 45));
    const contactedMs = createdAt.getTime() + randInt(1, 96) * 3600000; // 1–96h later
    const firstContactAt = stage !== "new" && contactedMs < Date.now() ? new Date(contactedMs) : undefined;
    return {
      clinicId, name: `${male ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F)} ${pick(LAST_NAMES)}`, phone: phone(),
      source: pick(["google", "instagram", "referral", "walk_in", "calculator", "website"]),
      interest: pick(["Dental implants", "Clear aligners", "Root canal", "Smile makeover", "Teeth whitening"]),
      estimatedValuePaise: R(randInt(12, 210) * 1000), stage, firstContactAt,
      createdAt, updatedAt: createdAt,
    };
  });
  // `timestamps: false` is honoured at runtime but absent from InsertManyOptions'
  // types in this mongoose version — cast to keep the historical createdAt.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await LeadModel.insertMany(leadDocs as any[], { timestamps: false } as any);
  logger.info(`Leads: ${leadDocs.length}`);

  // ---- Recalls ------------------------------------------------------------
  for (let i = 0; i < Math.round(30 * SCALE); i++) {
    await RecallModel.create({ clinicId, patient: pick(patients)._id, type: pick(["hygiene", "implant_review", "ortho", "post_op"]), dueDate: daysAgo(randInt(-10, 50)), intervalDays: 180, status: "pending", source: "auto" });
  }

  // ---- Message history (WhatsApp threads for the inbox) -------------------
  // A conversation per selected patient with a short back-and-forth so the
  // unified inbox, session-window state and suppression layer have real data.
  // Message createdAt is historical (insertMany timestamps:false) so threads
  // order correctly. lastMessageAt drives the inbox sort.
  const INBOUND = ["Hi, is the clinic open on Saturday?", "How much for a cleaning?", "Can I reschedule my appointment?", "Do you take UPI?", "Is Dr. Rohan available next week?", "My tooth is hurting, can I come today?"];
  const OUTBOUND = ["Yes! We're open 9am–6pm on Saturdays.", "A scaling & polishing is ₹1,200. Shall I book you in?", "Of course — what day suits you?", "Yes, UPI/card/cash all work. See you then!", "He has a slot Tuesday 6:30pm — want it?", "Please come by 5pm, we'll fit you in."];
  const conversationMsgs: Record<string, unknown>[] = [];
  let convCount = 0;
  const inboxPatients = patients.filter(() => chance(0.15)).slice(0, Math.round(40 * SCALE));
  for (const patient of inboxPatients) {
    const turns = randInt(1, 3);
    const lastMs = daysAgo(randInt(0, 14)).getTime();
    const startMs = lastMs - turns * 2 * 3600000;
    const withinWindow = Date.now() - lastMs < 24 * 3600000;
    const conv = await ConversationModel.create({
      clinicId, patient: patient._id, channel: "whatsapp",
      status: pick(["open", "pending", "resolved"]),
      lastMessageAt: new Date(lastMs), unread: withinWindow && chance(0.5) ? randInt(1, 2) : 0,
      sessionWindowExpiresAt: withinWindow ? new Date(lastMs + 24 * 3600000) : undefined,
    });
    for (let t = 0; t < turns; t++) {
      const inAt = new Date(startMs + t * 2 * 3600000);
      const outAt = new Date(inAt.getTime() + 20 * 60000);
      conversationMsgs.push(
        { clinicId, conversation: conv._id, direction: "in", channel: "whatsapp", content: pick(INBOUND), status: "delivered", timestamps: { deliveredAt: inAt }, createdAt: inAt, updatedAt: inAt },
        { clinicId, conversation: conv._id, direction: "out", channel: "whatsapp", content: pick(OUTBOUND), status: "read", timestamps: { sentAt: outAt, readAt: new Date(outAt.getTime() + 5 * 60000) }, sentBy: owner._id, createdAt: outAt, updatedAt: outAt },
      );
    }
    convCount++;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (conversationMsgs.length) await MessageModel.insertMany(conversationMsgs as any[], { timestamps: false } as any);
  logger.info(`Conversations: ${convCount} · messages: ${conversationMsgs.length}`);

  // ---- Suppliers, inventory, lab ------------------------------------------
  const suppliers = await Promise.all([
    { name: "Precision Dental Lab", type: "lab", terms: "Net 15" },
    { name: "DentMart Supplies", type: "supplies", terms: "Net 30" },
    { name: "Osstem India", type: "equipment", terms: "Advance" },
  ].map((s) => SupplierModel.create({ clinicId, name: s.name, type: s.type, paymentTerms: s.terms, rating: 4 + Math.random() })));

  await Promise.all([
    { name: "Composite resin A2", cat: "Restorative", stock: 4, reorder: 6, cost: R(800), exp: 120 },
    { name: "Nitrile gloves (M)", cat: "PPE", stock: 2, reorder: 5, cost: R(450), exp: 999 },
    { name: "Osstem implant TS III 4.0", cat: "Implants", stock: 7, reorder: 4, cost: R(4200), exp: 540 },
    { name: "Impression material (VPS)", cat: "Impression", stock: 9, reorder: 6, cost: R(1300), exp: 28 },
    { name: "Lidocaine 2% cartridges", cat: "Anaesthetic", stock: 38, reorder: 20, cost: R(40), exp: 240 },
  ].map((it) => InventoryItemModel.create({ clinicId, name: it.name, category: it.cat, stock: it.stock, reorderLevel: it.reorder, unitCostPaise: it.cost, batches: [{ batchNumber: "B-" + randInt(100, 999), expiry: daysFromNow(it.exp), quantity: it.stock }] })));

  await Promise.all(["received", "sent", "in_progress", "trial", "impression"].map((status, i) =>
    LabCaseModel.create({ clinicId, patient: pick(patients)._id, doctor: pick(doctorDocs)._id, lab: pick(suppliers)._id, labName: "Precision Dental Lab", workType: pick(["Zirconia crown", "PFM bridge", "Night guard", "Veneers"]), status, sentDate: daysAgo(randInt(3, 15)), expectedReturn: daysFromNow(randInt(-3, 8)), costPaise: R(randInt(4000, 20000)) })));

  logger.info("Seed complete");
  return String(clinicId);
}

/** CLI entry: connect to the configured Mongo, seed, disconnect. */
async function main(): Promise<void> {
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  logger.info("Seeding — connected to Mongo");
  await seedClinic();
  await mongoose.connection.close();
}

// Only run when invoked directly (not when imported by the verifier).
if (require.main === module) {
  main().catch(async (err) => {
    logger.error("Seed failed", { error: (err as Error).message, stack: (err as Error).stack });
    await mongoose.connection.close().catch(() => undefined);
    process.exit(1);
  });
}
