import { CostEstimateModel, LeadModel } from "../../models/growth.model";

/*
 * Cost calculator (spec 4.9 / 8.2). Estimation is server-side so the raw price
 * book never reaches the browser — the client only sends selections and gets a
 * genuine range back. Every run is logged (converted or not) for analytics.
 */

const TREATMENTS: Record<string, { name: string; basePaise: number; per: string }> = {
  implants: { name: "Dental implants", basePaise: 3200000, per: "tooth" },
  braces: { name: "Braces & aligners", basePaise: 4500000, per: "case" },
  rct: { name: "Root canal & crown", basePaise: 950000, per: "tooth" },
  smile: { name: "Smile design", basePaise: 800000, per: "tooth" },
  fullmouth: { name: "Full-mouth work", basePaise: 15000000, per: "case" },
};
const TIERS: Record<string, number> = { standard: 1, premium: 1.4, luxury: 1.9 };

export function calculatorConfig(): Record<string, unknown> {
  // Options/labels only — never the price multipliers or base prices.
  return {
    treatments: Object.entries(TREATMENTS).map(([k, v]) => ({ key: k, name: v.name, per: v.per })),
    tiers: [
      { key: "standard", label: "Standard", note: "Trusted, well-proven materials." },
      { key: "premium", label: "Premium", note: "Global-brand implants, full-zirconia crowns." },
      { key: "luxury", label: "Luxury", note: "Top-tier Swiss implants, master-ceramist work." },
    ],
  };
}

interface EstimateInput { treatment: string; tier: string; quantity?: number; severity?: string; braceType?: string; }

export function computeEstimate(input: EstimateInput): Record<string, unknown> {
  const tr = TREATMENTS[input.treatment];
  const mult = TIERS[input.tier] ?? 1;
  if (!tr) return { lowPaise: 0, highPaise: 0, breakdown: [] };

  let qty = Math.max(1, input.quantity ?? 1);
  let unit = tr.basePaise;
  if (input.treatment === "braces") {
    unit = ({ metal_mild: 4500000, ceramic_mod: 7500000, aligner_mild: 9000000, aligner_full: 16000000 } as Record<string, number>)[input.braceType ?? ""] ?? 4500000;
    qty = 1;
  }
  if (input.treatment === "smile") qty = ({ few: 6, half: 8, full: 10 } as Record<string, number>)[input.severity ?? ""] ?? 6;
  if (input.treatment === "fullmouth") { unit = input.severity === "both" ? 30000000 : 15000000; qty = 1; }

  const mid = unit * qty * mult;
  const round500 = (n: number) => Math.round(n / 50000) * 50000; // nearest ₹500 in paise
  const low = round500(mid * 0.85);
  const high = round500(mid * 1.15);
  return {
    treatment: tr.name,
    lowPaise: low,
    highPaise: high,
    emiLowPaise: round500(low / 12),
    breakdown: [
      { label: `Per unit (${input.tier})`, valuePaise: round500(unit * mult) },
      { label: "Quantity", value: qty },
      { label: "Consultation & X-ray", value: "included" },
    ],
    assumptions: [
      "No hidden gum or bone treatment is needed before we start.",
      "Prices include follow-up visits and adjustments.",
    ],
  };
}

export async function logEstimate(clinicId: string, input: EstimateInput, result: Record<string, unknown>, meta: Record<string, unknown>): Promise<string> {
  const doc = await CostEstimateModel.create({
    clinicId, category: input.treatment, inputs: input,
    lowPaise: result.lowPaise, highPaise: result.highPaise, breakdown: result.breakdown,
    referrer: meta.referrer, device: meta.device, sessionId: meta.sessionId,
  });
  return String(doc._id);
}

export async function captureToLead(clinicId: string, input: Record<string, unknown>, estimateId?: string): Promise<string> {
  const lead = await LeadModel.create({
    clinicId, name: input.name ?? "Calculator visitor", phone: input.phone, email: input.email,
    source: "calculator", interest: input.treatment, estimatedValuePaise: input.highPaise ?? 0,
    calculatorSnapshot: input,
  });
  if (estimateId) await CostEstimateModel.updateOne({ _id: estimateId, clinicId }, { converted: true, lead: lead._id });
  return String(lead._id);
}
