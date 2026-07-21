import { useEffect, useMemo, useState } from "react";
import { Odontogram, ODONTOGRAM_LEGEND, type Findings } from "@/components/domain/odontogram";
import { ToothArch, type ToothStyle } from "@/components/domain/tooth-arch";
import { Icon } from "@/components/ui/icon";
import { diffCharts, summariseChanges, concernCount, type ChartVersion, type ToothChange } from "./chart-data";
import { useChartsStore } from "./use-charts-store";
import { cn } from "@/lib/utils";

/*
 * The time scrubber.
 *
 * A slider along the top, and the arch morphs. That's it — and it is, in
 * practice, the most persuasive clinical artefact this product can produce.
 * Showing someone their own mouth changing over three years does more for
 * treatment acceptance than any amount of explaining, because it replaces a
 * claim about the future with evidence from the past.
 *
 * Two tones. The clinical one uses the full odontogram, surfaces and all,
 * because the dentist needs the detail. The patient one uses the friendlier
 * arch and plain language, because a five-surface caries map is frightening
 * without being informative to someone who isn't a dentist.
 */

const NEUTRAL: ToothStyle = { bg: "#FBF9F4", border: "#DDD6C7" };

const PATIENT_TOOTH_STYLE: Record<string, ToothStyle> = {
  caries: { bg: "#F6DEDA", border: "#C0392B" },
  filled: { bg: "#DCE7F0", border: "#2E6DA4" },
  wear: { bg: "#F6EBCF", border: "#D9A93B" },
  crown: { bg: "#F2E4C0", border: "#B08529" },
  rct: { bg: "#EDE3F0", border: "#7A4C8A" },
  implant: { bg: "#DDE7E3", border: "#4E8A75" },
  missing: { bg: "#EFEDE7", border: "#CFCDC5" },
  plannedTooth: { bg: "#FFFFFF", border: "#20614E" },
};

export function ChartScrubber({
  patientId,
  tone = "clinical",
  className,
}: {
  patientId: string;
  tone?: "clinical" | "patient";
  className?: string;
}) {
  const all = useChartsStore((s) => s.versions);
  const versions = useMemo(
    () => all.filter((v) => v.patientId === patientId).sort((a, b) => a.ts - b.ts),
    [all, patientId],
  );

  const [index, setIndex] = useState(Math.max(0, versions.length - 1));
  const [playing, setPlaying] = useState(false);

  /* A newly saved chart should land on screen, not behind the slider. */
  useEffect(() => {
    setIndex(Math.max(0, versions.length - 1));
  }, [versions.length]);

  /* Play steps forward and stops at the present. It never loops — a looping
   * animation of someone's dental decay would be a strange thing to build. */
  useEffect(() => {
    if (!playing) return;
    if (index >= versions.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, versions.length - 1)), 1100);
    return () => clearTimeout(t);
  }, [playing, index, versions.length]);

  if (versions.length === 0) {
    return (
      <div className={cn("text-[12.5px] text-muted px-4 py-8 text-center", className)}>
        No charts recorded yet. The first examination creates one.
      </div>
    );
  }

  const current = versions[index];
  const previous = index > 0 ? versions[index - 1] : null;
  const changes = previous ? diffCharts(previous.findings, current.findings) : [];
  const concerns = concernCount(current.findings);
  const firstConcerns = concernCount(versions[0].findings);

  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      {/* The slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (index >= versions.length - 1) setIndex(0);
              setPlaying((p) => !p);
            }}
            aria-label={playing ? "Pause" : "Play through the history"}
            className="w-[30px] h-[30px] grid place-items-center rounded-full bg-primary text-on-primary hover:bg-primary-hover flex-none text-[11px]"
          >
            {playing ? "❚❚" : "▶"}
          </button>

          <input
            type="range"
            min={0}
            max={versions.length - 1}
            step={1}
            value={index}
            onChange={(e) => {
              setPlaying(false);
              setIndex(Number(e.target.value));
            }}
            aria-label="Chart history"
            className="flex-1 accent-[color:var(--primary)]"
          />

          <span className="text-[12px] font-semibold tnum w-[92px] text-right">{current.date}</span>
        </div>

        {/* Tick labels — dates a person can aim at. */}
        <div className="flex justify-between px-[38px]">
          {versions.map((v, i) => (
            <button
              key={v.id}
              onClick={() => {
                setPlaying(false);
                setIndex(i);
              }}
              className={cn(
                "text-[10.5px] font-mono transition-colors",
                i === index ? "text-primary font-bold" : "text-muted-3 hover:text-muted",
              )}
            >
              {v.date.split(" ").slice(1).join(" ")}
            </button>
          ))}
        </div>
      </div>

      {/* The mouth */}
      <div className="rounded-lg border border-border bg-surface px-4 py-4 flex flex-col gap-3">
        {tone === "clinical" ? (
          <>
            <Odontogram findings={current.findings} selected={new Set()} onToggle={() => {}} />
            <div className="flex flex-wrap justify-center gap-x-3.5 gap-y-1.5 text-[10.5px] text-muted">
              {ODONTOGRAM_LEGEND.map((l) => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-[3px]"
                    style={{ background: l.bg, border: `1.5px solid ${l.border}` }}
                  />
                  {l.label}
                </span>
              ))}
            </div>
          </>
        ) : (
          <ToothArch size="plan" styleFor={(n) => patientStyle(current.findings, n)} />
        )}
      </div>

      {/* What this chart is */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold">{current.date}</span>
            <span className="text-[11.5px] text-muted-2">{current.by}</span>
            <SourceChip source={current.source} />
          </div>
          <div className="text-[12.5px] text-muted leading-snug mt-0.5">{current.note}</div>
        </div>

        {/* The line that makes the whole thing worth building. */}
        {versions.length > 1 && (
          <div className="text-right">
            <div className="text-[10.5px] font-bold tracking-[0.06em] text-muted-2">
              TEETH NEEDING ATTENTION
            </div>
            <div className="text-[18px] font-bold tnum tracking-[-0.02em]">
              {concerns}
              {index > 0 && (
                <span
                  className="text-[12px] font-semibold ml-1.5"
                  style={{
                    color:
                      concerns > firstConcerns
                        ? "var(--danger)"
                        : concerns < firstConcerns
                          ? "var(--primary)"
                          : "var(--muted-2)",
                  }}
                >
                  {concerns > firstConcerns ? "▲" : concerns < firstConcerns ? "▼" : "—"}{" "}
                  {Math.abs(concerns - firstConcerns)} since {versions[0].date.split(" ")[2]}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* What changed */}
      {previous && (
        <div className="rounded-lg border border-border bg-bg-content px-4 py-3 flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-bold tracking-[0.06em] text-muted-2">
              SINCE {previous.date.toUpperCase()}
            </span>
            <span className="text-[11.5px] text-muted">{summariseChanges(changes)}</span>
          </div>

          {changes.length > 0 && (
            <div className="flex flex-col gap-1">
              {changes.map((c, i) => (
                <ChangeLine key={i} change={c} tone={tone} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChangeLine({ change, tone }: { change: ToothChange; tone: "clinical" | "patient" }) {
  const colour =
    change.kind === "lost" || change.kind === "new" || change.kind === "worse"
      ? "var(--danger)"
      : "var(--primary)";

  return (
    <div className="flex items-start gap-2 text-[12.5px]">
      <span
        className="w-[6px] h-[6px] rounded-full mt-[6px] flex-none"
        style={{ background: colour }}
      />
      <span className={tone === "patient" ? "text-muted-strong" : "text-ink"}>
        {tone === "patient" ? change.plain : change.clinical}
      </span>
    </div>
  );
}

function SourceChip({ source }: { source: ChartVersion["source"] }) {
  const label: Record<ChartVersion["source"], string> = {
    examination: "Examined",
    dictated: "Dictated",
    migrated: "Migrated from paper",
    radiograph: "From radiograph",
  };
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-px rounded-[4px] bg-bg border border-border text-muted-2">
      {source === "dictated" && <Icon name="message" size={9} />}
      {label[source]}
    </span>
  );
}

/** Reduce a full finding to one colour a patient can read. */
function patientStyle(findings: Findings, num: number): ToothStyle {
  const f = findings[num];
  if (!f) return NEUTRAL;
  if (f.tooth) return PATIENT_TOOTH_STYLE[f.tooth] ?? NEUTRAL;

  const surfaces = Object.values(f.surfaces ?? {});
  if (surfaces.includes("caries")) return PATIENT_TOOTH_STYLE.caries;
  if (surfaces.includes("filled")) return PATIENT_TOOTH_STYLE.filled;
  if (surfaces.includes("wear")) return PATIENT_TOOTH_STYLE.wear;
  return NEUTRAL;
}
