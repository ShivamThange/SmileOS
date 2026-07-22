import { api } from "@/lib/api";

/*
 * Cost calculator (spec 4.9 / 8.2). The estimate is computed server-side — the
 * price book never reaches the browser. The client sends selections and gets a
 * genuine range back; capture turns a run into a lead.
 */

export interface CalcBreakdownItem {
  label: string;
  value?: string | number;
  valuePaise?: number;
}

export interface CalcEstimate {
  treatment: string;
  lowPaise: number;
  highPaise: number;
  emiLowPaise?: number;
  breakdown: CalcBreakdownItem[];
  assumptions?: string[];
  estimateId?: string;
}

export interface EstimateInput {
  treatment: string;
  tier: string;
  quantity?: number;
  severity?: string;
  braceType?: string;
}

export function calcEstimate(input: EstimateInput): Promise<CalcEstimate> {
  return api.post<CalcEstimate>("/public/calculator/estimate", input, { skipAuth: true });
}

export interface CaptureInput {
  name?: string;
  phone: string;
  email?: string;
  treatment?: string;
  highPaise?: number;
  estimateId?: string;
}
export function calcCapture(input: CaptureInput): Promise<{ leadId: string }> {
  return api.post<{ leadId: string }>("/public/calculator/capture", input, { skipAuth: true });
}
