import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/common/empty-state";
import { MedicalAlertBadge } from "@/components/common/medical-alert-badge";
import {
  Odontogram,
  ODONTOGRAM_LEGEND,
  SURFACE_CONDITIONS,
  TOOTH_CONDITIONS,
  type Findings,
  type SurfaceCondition,
  type SurfaceKey,
  type ToothCondition,
} from "@/components/domain/odontogram";
import { ChartScrubber } from "./chart-scrubber";
import { useChartsStore } from "./use-charts-store";
import { proposeFromFindings } from "./findings-to-plan";
import { usePlansStore } from "@/features/treatment-plan/use-plans-store";
import { useSession } from "@/hooks/use-session";
import { useUIStore } from "@/hooks/use-ui-store";
import { patients } from "@/lib/mock-data";
import {
  parseDictation,
  applySegments,
  describeSegment,
  DICTATION_VOCAB,
  type DictationSegment,
} from "@/lib/chart-dictation";
import { cn } from "@/lib/utils";

/*
 * Chairside charting.
 *
 * The flagship. Two facts about a dental examination govern every decision on
 * this screen:
 *
 *   The dentist's hands are gloved. She cannot touch a keyboard or trackpad
 *   without breaking sterility, so charting is either transcribed by an
 *   assistant or reconstructed from memory after the patient has gone. Both are
 *   lossy, and the industry's answer — a chairside monitor in a plastic bag —
 *   is a hardware answer to an interaction problem.
 *
 *   The examination is already spoken, in a standardised grammar, at speed.
 *   "Eighteen occlusal caries, seventeen missing, sixteen MOD amalgam."
 *   Clicking thirty-two teeth breaks that rhythm completely.
 *
 * So: she speaks, the arch fills in live, and the assistant watches the newly
 * set teeth highlight and corrects anything wrong by tapping the transcript
 * line. Voice is an accelerator and never the only path — the same parser backs
 * a typed input, full manual clicking works throughout, and there's a bulk mode
 * for a practice migrating three thousand paper records.
 *
 * Everything done in a sitting, spoken or clicked, becomes a line in one
 * transcript. That makes undo trivial and gives the assistant a single place to
 * look for errors instead of hunting the arch.
 */

type Tool =
  | { kind: "surface"; value: SurfaceCondition }
  | { kind: "tooth"; value: ToothCondition }
  | { kind: "sound" };

const SURFACE_TOOLS: SurfaceCondition[] = ["caries", "filled", "wear", "planned"];
const TOOTH_TOOLS: ToothCondition[] = ["crown", "rct", "implant", "missing", "plannedTooth"];

const EXAMPLE = "one six MOD caries, one five distal caries, three six missing, four seven root canal, four six crown";

export function ChartingScreen() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { showToast } = useUIStore();

  const charts = useChartsStore();
  const addPlan = usePlansStore((s) => s.addPlan);

  const patient = patients.find((p) => p.id === patientId) ?? null;

  /* The chart we're building on top of. Frozen at mount so undo is deterministic. */
  const [base, setBase] = useState<Findings>({});
  const [segments, setSegments] = useState<DictationSegment[]>([]);
  const [input, setInput] = useState("");
  const [bulk, setBulk] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [tool, setTool] = useState<Tool>({ kind: "surface", value: "caries" });
  const [lens, setLens] = useState<"chart" | "history">("chart");
  const [showVocab, setShowVocab] = useState(false);

  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  /* Load the last chart once we know who this is. */
  useEffect(() => {
    if (!patientId) return;
    const latest = charts.latestFor(patientId);
    setBase(latest ? (JSON.parse(JSON.stringify(latest.findings)) as Findings) : {});
    setSegments([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const findings = useMemo(() => applySegments(base, segments), [base, segments]);

  /* Newly-set teeth highlight briefly so the assistant can catch errors live. */
  const flashSegments = (segs: DictationSegment[]) => {
    const keys = new Set<string>();
    for (const s of segs) {
      const surfaces: SurfaceKey[] =
        s.surfaces.length > 0 ? s.surfaces : ["buccal", "occlusal", "lingual", "mesial", "distal"];
      for (const surf of surfaces) keys.add(`${s.tooth}:${surf}`);
    }
    setFlash(keys);
    setTimeout(() => setFlash(new Set()), 1200);
  };

  const commit = (text: string) => {
    const parsed = parseDictation(text);
    if (parsed.length === 0) {
      showToast("Nothing recognised — try \"one six occlusal caries\"");
      return;
    }
    setSegments((s) => [...s, ...parsed]);
    flashSegments(parsed);
    setInput("");
    setTimeout(() => transcriptEndRef.current?.scrollIntoView({ block: "nearest" }), 30);
  };

  /* Manual clicking produces the same kind of segment, so undo works the same. */
  const onToggleSurface = (tooth: number, key: SurfaceKey) => {
    const seg: DictationSegment =
      tool.kind === "sound"
        ? { id: rid(), raw: `${tooth} sound`, tooth, surfaces: [], sound: true, confidence: "high" }
        : tool.kind === "tooth"
          ? {
              id: rid(),
              raw: `${tooth} ${TOOTH_CONDITIONS[tool.value].label}`,
              tooth,
              surfaces: [],
              toothCondition: tool.value,
              sound: false,
              confidence: "high",
            }
          : {
              id: rid(),
              raw: `${tooth} ${key} ${tool.value}`,
              tooth,
              surfaces: [key],
              surfaceCondition: tool.value,
              sound: false,
              confidence: "high",
            };

    setSegments((s) => [...s, seg]);
    flashSegments([seg]);
  };

  // --- speech --------------------------------------------------------------

  const speechSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      setSpeechError("This browser can't listen. Type the same words instead — the grammar is identical.");
      return;
    }

    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) commit(event.results[i][0].transcript);
      }
    };
    rec.onerror = (e: any) => {
      setSpeechError(
        e?.error === "not-allowed"
          ? "Microphone permission was refused. Typing works exactly the same."
          : "Listening stopped. Noisy room? Typing works exactly the same.",
      );
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    setSpeechError(null);
    rec.start();
    setListening(true);
  };

  useEffect(() => () => recognitionRef.current?.stop(), []);

  // --- outputs -------------------------------------------------------------

  const saveChart = () => {
    if (!patientId) return;
    charts.saveVersion(
      patientId,
      findings,
      user.doctorName ?? user.name,
      segments.length ? `${segments.length} findings recorded at the chair.` : "Chart reviewed, no changes.",
      segments.some((s) => s.raw.includes(" ")) ? "dictated" : "examination",
    );
    setBase(findings);
    setSegments([]);
    showToast("Chart saved as a new version");
  };

  const proposePlan = () => {
    if (!patient) return;
    const plan = proposeFromFindings(
      patient.id,
      patient.name,
      findings,
      user.doctorName ?? user.name,
    );
    if (plan.phases.length === 0) {
      showToast("Nothing in this chart needs treatment — no plan to propose");
      return;
    }
    addPlan(plan);
    showToast("Draft plan proposed — review before presenting");
    navigate(`/app/treatment-plans/${plan.id}`);
  };

  if (!patient) {
    return (
      <div className="max-w-[1240px] mx-auto">
        <EmptyState
          icon="patients"
          title="No patient selected"
          body="Charting needs a patient. Open one from the list, or from today's chair queue."
          cta="Open the clinical queue"
          onCta={() => navigate("/app/clinical/queue")}
        />
      </div>
    );
  }

  const findingCount = Object.keys(findings).length;
  const lowConfidence = segments.filter((s) => s.confidence === "low").length;

  return (
    <div className="max-w-[1320px] mx-auto flex flex-col gap-3.5">
      {/* Who */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Avatar name={patient.name} size={40} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="m-0 text-[18px] font-semibold tracking-[-0.01em]">{patient.name}</h1>
              <MedicalAlertBadge alert={patient.alert} variant="chip" />
            </div>
            <div className="text-[12.5px] text-muted mt-0.5">
              {patient.pno} · {patient.agesex} ·{" "}
              <Link to={`/app/patients/${patient.id}`} className="text-primary font-medium">
                Full record
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded-md border border-border bg-bg-content">
          <LensButton active={lens === "chart"} onClick={() => setLens("chart")}>
            Chart now
          </LensButton>
          <LensButton active={lens === "history"} onClick={() => setLens("history")}>
            Over time
          </LensButton>
        </div>
      </div>

      {lens === "history" ? (
        <Panel className="px-4 py-4">
          <ChartScrubber patientId={patient.id} tone="clinical" />
        </Panel>
      ) : (
        <>
          <div
            className="grid gap-3.5 items-start max-xl:grid-cols-1"
            style={{ gridTemplateColumns: "1.5fr 0.85fr" }}
          >
            {/* ---------------------------------------------------------- */}
            {/* The mouth                                                   */}
            {/* ---------------------------------------------------------- */}
            <div className="flex flex-col gap-3">
              <Panel className="px-4 py-4 flex flex-col gap-3">
                <Odontogram findings={findings} selected={flash} onToggle={onToggleSurface} />

                <div className="flex flex-wrap justify-center gap-x-3.5 gap-y-1.5 text-[10.5px] text-muted pt-1">
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
              </Panel>

              {/* Manual tools — the path that must always work. */}
              <Panel className="px-4 py-3 flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <MicroLabel>Tap-to-chart</MicroLabel>
                  <span className="text-[11px] text-muted-2">
                    for noisy rooms, and for anyone who'd rather not dictate
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {SURFACE_TOOLS.map((c) => (
                    <ToolChip
                      key={c}
                      active={tool.kind === "surface" && tool.value === c}
                      onClick={() => setTool({ kind: "surface", value: c })}
                      swatch={SURFACE_CONDITIONS[c].color}
                    >
                      {SURFACE_CONDITIONS[c].label}
                    </ToolChip>
                  ))}
                  {TOOTH_TOOLS.map((c) => (
                    <ToolChip
                      key={c}
                      active={tool.kind === "tooth" && tool.value === c}
                      onClick={() => setTool({ kind: "tooth", value: c })}
                      swatch={TOOTH_CONDITIONS[c].color}
                      border={TOOTH_CONDITIONS[c].border}
                    >
                      {TOOTH_CONDITIONS[c].label}
                    </ToolChip>
                  ))}
                  <ToolChip
                    active={tool.kind === "sound"}
                    onClick={() => setTool({ kind: "sound" })}
                    swatch="#FFFFFF"
                    border="#CFCDC5"
                  >
                    Sound / clear
                  </ToolChip>
                </div>
              </Panel>
            </div>

            {/* ---------------------------------------------------------- */}
            {/* Dictation                                                   */}
            {/* ---------------------------------------------------------- */}
            <div className="flex flex-col gap-3">
              <Panel className="px-4 py-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <MicroLabel>Dictate</MicroLabel>
                  <button
                    onClick={() => setShowVocab((v) => !v)}
                    className="text-[11.5px] font-semibold text-primary"
                  >
                    {showVocab ? "Hide" : "What can I say?"}
                  </button>
                </div>

                {showVocab && (
                  <div className="rounded-md border border-border bg-bg-content px-3 py-2.5 flex flex-col gap-1.5 animate-dc-row">
                    {Object.entries(DICTATION_VOCAB).map(([k, v]) => (
                      <div key={k} className="text-[11.5px]">
                        <span className="font-semibold capitalize">{camelToWords(k)}: </span>
                        <span className="text-muted">{v}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => setInput(EXAMPLE)}
                      className="text-[11.5px] font-semibold text-primary self-start mt-0.5"
                    >
                      Load an example →
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleListening}
                    disabled={!speechSupported}
                    title={speechSupported ? undefined : "This browser can't listen"}
                    className={cn(
                      "w-[46px] h-[46px] rounded-full grid place-items-center flex-none transition-colors",
                      listening
                        ? "bg-danger text-on-primary animate-dc-pulse-ring"
                        : speechSupported
                          ? "bg-primary text-on-primary hover:bg-primary-hover"
                          : "bg-bg text-muted-3 border border-border cursor-not-allowed",
                    )}
                  >
                    <Icon name={listening ? "spark" : "message"} size={18} />
                  </button>

                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">
                      {listening ? "Listening…" : speechSupported ? "Tap to dictate" : "Dictation unavailable"}
                    </div>
                    <div className="text-[11.5px] text-muted-2 leading-snug">
                      {listening
                        ? "Call findings normally. Watch the arch."
                        : speechSupported
                          ? "Or just type below — same grammar, same result."
                          : "Type below instead. The grammar is identical."}
                    </div>
                  </div>
                </div>

                {speechError && (
                  <div className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-[11.5px] text-warning-text leading-snug">
                    {speechError}
                  </div>
                )}

                {/* The typed path. Also the bulk-migration path. */}
                {bulk ? (
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={5}
                    placeholder={"Paste a whole chart, one finding per line or comma-separated.\n\n" + EXAMPLE}
                    className="text-[12.5px] font-mono leading-relaxed px-2.5 py-2 border border-border rounded-md bg-bg-content outline-none focus:border-primary resize-y"
                  />
                ) : (
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && input.trim()) commit(input);
                    }}
                    placeholder='e.g. "one six MOD caries"'
                    className="text-[13px] px-2.5 py-2 border border-border rounded-md bg-bg-content outline-none focus:border-primary"
                  />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    className="flex-1 justify-center"
                    disabled={!input.trim()}
                    onClick={() => commit(input)}
                  >
                    {bulk ? "Chart all of it" : "Add"}
                  </Button>
                  <Button variant="secondary" onClick={() => setBulk((b) => !b)}>
                    {bulk ? "Single" : "Bulk"}
                  </Button>
                </div>

                {bulk && (
                  <div className="text-[11px] text-muted-2 leading-snug">
                    Bulk mode is for migrating paper records — chart a whole mouth in one paste. Most
                    clinics switching also use "start clean, backfill on visit", which is fine too.
                  </div>
                )}
              </Panel>

              {/* The transcript — one place to look for errors. */}
              <Panel className="px-4 py-3 flex flex-col gap-2 max-h-[440px]">
                <div className="flex items-baseline justify-between">
                  <MicroLabel>This sitting</MicroLabel>
                  <div className="flex items-center gap-2">
                    {lowConfidence > 0 && (
                      <span className="text-[10.5px] font-bold px-1.5 py-px rounded-[4px] bg-warning-bg text-warning border border-warning-border">
                        {lowConfidence} UNCLEAR
                      </span>
                    )}
                    {segments.length > 0 && (
                      <button
                        onClick={() => setSegments((s) => s.slice(0, -1))}
                        className="text-[11.5px] font-semibold text-muted hover:text-ink"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </div>

                {segments.length === 0 ? (
                  <div className="py-6 text-center text-[12px] text-muted-2 leading-relaxed">
                    Nothing recorded yet this sitting.
                    <br />
                    The chart shown is from {charts.latestFor(patient.id)?.date ?? "no previous visit"}.
                  </div>
                ) : (
                  <div className="overflow-y-auto flex flex-col gap-1 -mx-1 px-1">
                    {segments.map((s) => (
                      <TranscriptLine
                        key={s.id}
                        segment={s}
                        onRemove={() => setSegments((list) => list.filter((x) => x.id !== s.id))}
                      />
                    ))}
                    <div ref={transcriptEndRef} />
                  </div>
                )}
              </Panel>
            </div>
          </div>

          {/* The payoff */}
          <Panel className="px-5 py-4 flex items-center gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold">
                {findingCount} teeth with something recorded
                {segments.length > 0 && ` · ${segments.length} this sitting`}
              </div>
              <div className="text-[12px] text-muted leading-snug mt-0.5 max-w-[620px]">
                Proposing a plan turns these findings into a priced, sequenced draft with
                alternatives — which you then edit rather than write. Nothing is sent to the patient
                until you present it.
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={saveChart}>
                Save this chart
              </Button>
              <Button variant="primary" onClick={proposePlan} disabled={findingCount === 0}>
                Propose a plan →
              </Button>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function TranscriptLine({
  segment,
  onRemove,
}: {
  segment: DictationSegment;
  onRemove: () => void;
}) {
  const unclear = segment.confidence === "low";

  return (
    <div
      className={cn(
        "group flex items-start gap-2 px-2 py-1.5 rounded-md",
        unclear ? "bg-warning-bg" : "hover:bg-bg-content",
      )}
    >
      <span
        className="w-[6px] h-[6px] rounded-full mt-[7px] flex-none"
        style={{ background: unclear ? "var(--warning)" : "var(--primary)" }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium">{describeSegment(segment)}</div>
        <div className="text-[10.5px] text-muted-2 truncate">
          heard "{segment.raw}"{segment.problem ? ` · ${segment.problem}` : ""}
        </div>
      </div>
      <button
        onClick={onRemove}
        aria-label="Remove this finding"
        className="w-[20px] h-[20px] grid place-items-center rounded-[5px] text-muted-3 opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-bg text-[11px]"
      >
        ✕
      </button>
    </div>
  );
}

function ToolChip({
  active,
  onClick,
  swatch,
  border,
  children,
}: {
  active: boolean;
  onClick: () => void;
  swatch: string;
  border?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2 py-1 rounded-md border transition-colors",
        active ? "border-primary bg-primary-tint text-primary font-semibold" : "border-border bg-surface text-muted hover:border-border-strong",
      )}
    >
      <span
        className="w-2.5 h-2.5 rounded-[3px] flex-none"
        style={{ background: swatch, border: `1.5px solid ${border ?? swatch}` }}
      />
      {children}
    </button>
  );
}

function LensButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-[12px] font-semibold px-3 py-1.5 rounded-[6px] transition-colors",
        active ? "bg-surface text-ink shadow-card-hover" : "text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

let rseq = 0;
function rid(): string {
  return `manual_${Date.now().toString(36)}_${rseq++}`;
}

function camelToWords(s: string): string {
  return s.replace(/([A-Z])/g, " $1").toLowerCase();
}
