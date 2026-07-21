/*
 * Notifications — composed live from the same mock layers the screens use, so
 * the bell always agrees with what's on the pages. Each alert deep-links to the
 * screen that resolves it. No new data source; this is a cross-cutting read.
 */

import { recoveryRows, leads } from "@/lib/mock-data";
import { invoices, invoiceBalance } from "@/features/revenue/billing-data";
import { labCases } from "@/features/operations/operations-data";
import { recalls } from "@/features/growth/growth-data";
import { conversations } from "@/features/growth/growth-data";
import { inr } from "@/lib/format";

export type NotifTone = "danger" | "warning" | "info" | "success";

export interface Notification {
  id: string;
  tone: NotifTone;
  glyph: string;
  title: string;
  detail: string;
  to: string;
  time: string;
}

export const TONE_STYLE: Record<NotifTone, { bg: string; color: string; border: string }> = {
  danger: { bg: "var(--danger-bg)", color: "var(--danger)", border: "var(--danger-border)" },
  warning: { bg: "var(--warning-bg)", color: "var(--warning)", border: "var(--warning-border)" },
  info: { bg: "#E8EEF4", color: "#2E6DA4", border: "#C9DAE8" },
  success: { bg: "var(--primary-tint)", color: "var(--primary)", border: "var(--primary-tint-border)" },
};

export function buildNotifications(): Notification[] {
  const out: Notification[] = [];

  // Money at risk — high-urgency unscheduled treatment
  const atRisk = recoveryRows.filter((r) => r.urgency === "High");
  if (atRisk.length) {
    const total = atRisk.reduce((s, r) => s + r.valuePaise, 0);
    out.push({
      id: "n-risk", tone: "danger", glyph: "₹",
      title: `${inr(total)} at risk`,
      detail: `${atRisk.length} high-urgency treatments never scheduled`,
      to: "/app/revenue/unscheduled", time: "now",
    });
  }

  // Overdue invoices
  const overdue = invoices.filter((i) => i.status === "overdue");
  if (overdue.length) {
    const total = overdue.reduce((s, i) => s + invoiceBalance(i), 0);
    out.push({
      id: "n-overdue", tone: "warning", glyph: "!",
      title: `${overdue.length} invoices overdue`,
      detail: `${inr(total)} outstanding 30 days or more`,
      to: "/app/revenue/pending-payments", time: "today",
    });
  }

  // Lab cases overdue
  const labOverdue = labCases.filter((c) => c.status === "overdue");
  if (labOverdue.length) {
    out.push({
      id: "n-lab", tone: "warning", glyph: "▦",
      title: `${labOverdue.length} lab case${labOverdue.length > 1 ? "s" : ""} overdue`,
      detail: labOverdue.map((c) => c.patient).join(", "),
      to: "/app/lab", time: "today",
    });
  }

  // Unread messages
  const unread = conversations.reduce((s, c) => s + c.unread, 0);
  if (unread) {
    out.push({
      id: "n-inbox", tone: "info", glyph: "✉",
      title: `${unread} unread message${unread > 1 ? "s" : ""}`,
      detail: conversations.filter((c) => c.unread).map((c) => c.name).join(", "),
      to: "/app/inbox", time: "10m ago",
    });
  }

  // New leads
  const newLeads = leads.filter((l) => l.stage === "new");
  if (newLeads.length) {
    out.push({
      id: "n-leads", tone: "info", glyph: "◈",
      title: `${newLeads.length} new lead${newLeads.length > 1 ? "s" : ""}`,
      detail: `${newLeads.map((l) => l.interest).slice(0, 2).join(", ")}${newLeads.length > 2 ? "…" : ""}`,
      to: "/app/leads", time: "2h ago",
    });
  }

  // Recalls overdue
  const recallOverdue = recalls.filter((r) => r.overdueDays >= 30);
  if (recallOverdue.length) {
    out.push({
      id: "n-recall", tone: "warning", glyph: "↻",
      title: `${recallOverdue.length} recall${recallOverdue.length > 1 ? "s" : ""} 30d+ overdue`,
      detail: "At risk of drifting to another clinic",
      to: "/app/recalls", time: "today",
    });
  }

  // A positive one — reminders delivered
  out.push({
    id: "n-rem", tone: "success", glyph: "✓",
    title: "12 reminders delivered",
    detail: "Tomorrow's confirmations sent on WhatsApp",
    to: "/app/calendar", time: "1h ago",
  });

  return out;
}
