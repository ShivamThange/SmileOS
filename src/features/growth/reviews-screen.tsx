import { useMemo } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/hooks/use-ui-store";
import { reviews, reviewStats, type Review } from "./growth-data";

/*
 * Reviews — ask a private rating first, route the happy ones to Google and
 * catch the unhappy ones for service recovery before they post publicly.
 */

function Stars({ n }: { n: number }) {
  return <span className="text-[#D9A93B] text-[13px] tracking-[1px]">{"★".repeat(n)}<span className="text-muted-3">{"★".repeat(5 - n)}</span></span>;
}

const ROUTED_META: Record<Review["routed"], { label: string; bg: string; color: string; border: string }> = {
  google: { label: "On Google", bg: "#EAF1EE", color: "#20614E", border: "#C7DAD1" },
  recovery: { label: "Service recovery", bg: "#FBEFED", color: "#A8342A", border: "#EFC7C2" },
  pending: { label: "Awaiting", bg: "#FAF3E7", color: "#8A6B33", border: "#E5D2AC" },
};

export function ReviewsScreen() {
  const { showToast } = useUIStore();
  const stats = useMemo(reviewStats, []);

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader title="Reviews" subtitle="Reputation, handled kindly" aside={<Button variant="primary" onClick={() => showToast("Review request sent to today's completed patients")}>Request reviews</Button>} />
      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <StatCard label="Average rating" value={stats.avg.toFixed(1)} sub={`${stats.total} total`} />
        <StatCard label="On Google" value={String(stats.googleCount)} deltaTone="up" sub="public 5-star" />
        <StatCard label="Caught privately" value={String(stats.caught)} delta="before going public" deltaTone="warn" />
        <StatCard label="Response rate" value="38%" sub="of requests" />
      </div>

      <div className="flex flex-col gap-3">
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} onReply={() => showToast(`Replying to ${r.patient}`)} onRoute={() => showToast(r.rating >= 4 ? `Routed ${r.patient} to Google` : `Opened service recovery for ${r.patient}`)} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review, onReply, onRoute }: { review: Review; onReply: () => void; onRoute: () => void }) {
  const m = ROUTED_META[review.routed];
  const unhappy = review.rating < 4;
  return (
    <Panel className="px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary-tint text-primary grid place-items-center text-[11px] font-bold">{review.patient.split(" ").map((s) => s[0]).join("")}</div>
          <div><div className="text-[13px] font-semibold">{review.patient}</div><div className="flex items-center gap-2"><Stars n={review.rating} /><span className="text-[11px] text-muted-2">{review.channel} · {review.when}</span></div></div>
        </div>
        <span className="text-[10.5px] font-bold px-2 py-[3px] rounded-[5px] border" style={{ background: m.bg, color: m.color, borderColor: m.border }}>{m.label}</span>
      </div>
      <p className="text-[13px] text-muted-strong leading-normal mt-2.5 mb-3">{review.text}</p>
      <div className="flex gap-1.5">
        <Button size="sm" variant="secondary" onClick={onReply}>Reply</Button>
        <Button size="sm" variant={unhappy ? "danger" : "tint"} onClick={onRoute}>{unhappy ? "Open recovery" : "Thank & route to Google"}</Button>
      </div>
    </Panel>
  );
}
