import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import http from "node:http";

/*
 * End-to-end verification. Spins up an in-memory MongoDB, seeds the demo clinic,
 * exercises the revenue services against real data, then boots the HTTP app and
 * hits the public + health surface. Proves the whole stack works, not just types.
 */

async function get(port: number, path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path, method: "GET", headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data ? JSON.parse(data) : null }));
    });
    req.on("error", reject);
    req.end();
  });
}
async function post(port: number, path: string, body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({ host: "127.0.0.1", port, path, method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data ? JSON.parse(data) : null }));
    });
    req.on("error", reject);
    req.end(payload);
  });
}

async function main(): Promise<void> {
  const mem = await MongoMemoryServer.create({
    binary: { version: process.env.MONGOMS_VERSION ?? "7.0.14", os: { os: "linux", dist: "ubuntu", release: "22.04" } as never },
  });
  const uri = mem.getUri("dentalos");
  process.env.MONGO_URI = uri;
  process.env.PORT = "4055";

  await mongoose.connect(uri);
  const { seedClinic } = await import("./seed");
  const clinicId = await seedClinic();

  // ---- Service-level checks against real data -----------------------------
  const { unscheduledSummary, caseAcceptance } = await import("../modules/treatment-plan/revenue.service");
  const { pendingPayments } = await import("../modules/billing/billing.service");
  const summary = await unscheduledSummary(clinicId);
  const acceptance = await caseAcceptance(clinicId);
  const receivables = await pendingPayments(clinicId);

  const lakh = (paise: number) => "₹" + (paise / 100 / 100000).toFixed(2) + "L";
  console.log("\n=== SERVICE CHECKS (real data) ===");
  console.log("Unscheduled backlog:", lakh(summary.totalValuePaise as number), "across", summary.patientCount, "patients");
  console.log("Recoverable pipeline:", lakh(summary.recoverablePaise as number));
  console.log("Case acceptance rate:", acceptance.acceptanceRate + "%");
  console.log("Receivables:", lakh(receivables.totalPaise as number), "over", receivables.count, "invoices");

  const backlogOk = (summary.totalValuePaise as number) >= 80000000 && (summary.totalValuePaise as number) <= 1600000000;

  // ---- HTTP-level checks --------------------------------------------------
  const { createApp } = await import("../app");
  const app = createApp();
  const server = app.listen(4055);
  await new Promise((r) => setTimeout(r, 400));

  const health = await get(4055, "/readyz");
  const clinic = await get(4055, "/api/v1/public/clinic");
  const cfg = await get(4055, "/api/v1/public/calculator/config");
  const est = await post(4055, "/api/v1/public/calculator/estimate", { treatment: "implants", tier: "premium", quantity: 1 });
  const authGuard = await get(4055, "/api/v1/patients"); // must be 401

  console.log("\n=== HTTP CHECKS ===");
  console.log("readyz:", health.status, (health.body as any)?.data?.status);
  console.log("public/clinic:", clinic.status, (clinic.body as any)?.data?.name);
  console.log("calculator/config:", cfg.status, "treatments:", (cfg.body as any)?.data?.treatments?.length);
  console.log("calculator/estimate:", est.status, "range:", est.body?.data ? lakh(est.body.data.lowPaise) + "–" + lakh(est.body.data.highPaise) : "—");
  console.log("patients w/o auth:", authGuard.status, (authGuard.body as any)?.error?.code);

  server.close();
  await mongoose.connection.close();
  await mem.stop();

  const httpOk = health.status === 200 && clinic.status === 200 && (clinic.body as any)?.data?.name === "Meher Dental Care" && est.status === 200 && authGuard.status === 401;
  const pass = backlogOk && httpOk;
  console.log("\n=== " + (pass ? "ALL CHECKS PASSED ✓" : "CHECKS FAILED ✗") + " ===");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => { console.error("Verify failed:", err); process.exit(1); });
