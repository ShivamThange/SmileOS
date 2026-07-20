/*
 * Odontogram — the centrepiece clinical component, ported faithfully from the
 * Claude Design project. FDI two-digit numbering (Indian dental standard),
 * permanent dentition, four quadrants arranged as an arch. Each tooth is five
 * clickable surfaces (buccal / occlusal / lingual / mesial / distal) via
 * clip-path polygons; whole-tooth states (crown, RCT, implant, missing,
 * planned) override with a ring + overlay glyph. Touch targets suit tablets.
 *
 * Clinical status is fixed across brands and never colour-only — every
 * condition also appears as a legend label and, for whole-tooth states, a glyph.
 */

export const SURFACE_CLIP: Record<string, string> = {
  buccal: "polygon(0 0,100% 0,72% 28%,28% 28%)",
  lingual: "polygon(0 100%,100% 100%,72% 72%,28% 72%)",
  mesial: "polygon(0 0,28% 28%,28% 72%,0 100%)",
  distal: "polygon(100% 0,72% 28%,72% 72%,100% 100%)",
  occlusal: "polygon(28% 28%,72% 28%,72% 72%,28% 72%)",
};

export const SURFACES = [
  { key: "buccal", name: "Buccal" },
  { key: "occlusal", name: "Occlusal" },
  { key: "lingual", name: "Lingual" },
  { key: "mesial", name: "Mesial" },
  { key: "distal", name: "Distal" },
] as const;

export type SurfaceKey = (typeof SURFACES)[number]["key"];

export const SURFACE_CONDITIONS = {
  caries: { color: "#C0392B", label: "Caries" },
  filled: { color: "#2E6DA4", label: "Restoration" },
  wear: { color: "#D9A93B", label: "Attrition / wear" },
  planned: { color: "#EAF1EE", label: "Planned" },
} as const;
export type SurfaceCondition = keyof typeof SURFACE_CONDITIONS;

export const TOOTH_CONDITIONS = {
  crown: { color: "#F2E4C0", border: "#B08529", label: "Crown", overlay: "", ring: "#B08529" },
  rct: { color: "#EDE3F0", border: "#7A4C8A", label: "Root canal", overlay: "▲", overlayColor: "#7A4C8A" },
  implant: { color: "#DDE7E3", border: "#4E8A75", label: "Implant", overlay: "⌾", overlayColor: "#20614E" },
  missing: { color: "#EFEDE7", border: "#CFCDC5", label: "Missing", overlay: "✕", overlayColor: "#B0AEA4" },
  plannedTooth: { color: "#FFFFFF", border: "#20614E", label: "Planned tooth", overlay: "", ring: "#20614E" },
} as const;
export type ToothCondition = keyof typeof TOOTH_CONDITIONS;

export interface ToothFinding {
  surfaces?: Partial<Record<SurfaceKey, SurfaceCondition>>;
  tooth?: ToothCondition;
}
export type Findings = Record<number, ToothFinding>;

/** FDI quadrants in display order, midline in the centre. */
const QUADRANTS = {
  ur: [18, 17, 16, 15, 14, 13, 12, 11],
  ul: [21, 22, 23, 24, 25, 26, 27, 28],
  lr: [31, 32, 33, 34, 35, 36, 37, 38],
  ll: [48, 47, 46, 45, 44, 43, 42, 41],
};

function toothGeometry(num: number, isUpper: boolean) {
  const d = num % 10;
  const boxW = d >= 6 ? 36 : d >= 4 ? 31 : d === 3 ? 29 : d === 2 ? 27 : 30;
  let rad = d >= 6 ? ["26%", "26%", "30%", "30%"] : d >= 4 ? ["34%", "34%", "38%", "38%"] : d === 3 ? ["30%", "30%", "46%", "46%"] : ["24%", "24%", "40%", "40%"];
  if (!isUpper) rad = [rad[2], rad[3], rad[0], rad[1]];
  const curve = (1 - Math.pow((d - 1) / 7, 2)) * 7;
  return { boxW, rad: rad.join(" "), shift: (isUpper ? curve : -curve).toFixed(1) + "px" };
}

function Tooth({
  num,
  isUpper,
  finding,
  selected,
  onToggle,
}: {
  num: number;
  isUpper: boolean;
  finding: ToothFinding;
  selected: Set<string>;
  onToggle: (num: number, key: SurfaceKey) => void;
}) {
  const geo = toothGeometry(num, isUpper);
  const tcondKey = finding.tooth;
  const tc = tcondKey ? TOOTH_CONDITIONS[tcondKey] : null;
  const missing = tcondKey === "missing";
  const anySel = SURFACES.some((s) => selected.has(`${num}:${s.key}`));

  let ringColor = "#DDDBD3";
  let ringShadow = "none";
  if (tc && "ring" in tc && tc.ring) ringColor = tc.ring;
  if (anySel) {
    ringColor = "#20614E";
    ringShadow = "0 0 0 2px rgba(32,97,78,0.25)";
  }

  const numColor = missing ? "#B0AEA4" : "#6E6C64";
  const dotColor = tc && tcondKey !== "missing" ? tc.border : null;

  const box = (
    <div
      className="relative overflow-hidden"
      style={{ width: geo.boxW, height: 34, borderRadius: geo.rad }}
    >
      <div
        className="absolute inset-0 pointer-events-none z-[3]"
        style={{ borderRadius: geo.rad, border: `1.5px solid ${ringColor}`, boxShadow: ringShadow }}
      />
      {SURFACES.map((s) => {
        const cond = missing ? undefined : finding.surfaces?.[s.key];
        const c = cond ? SURFACE_CONDITIONS[cond] : null;
        const isSel = selected.has(`${num}:${s.key}`);
        let bg = "#FFFFFF";
        if (missing) bg = "#F4F3EF";
        else if (c) bg = c.color;
        if (isSel) bg = "#B7D3C8";
        return (
          <div
            key={s.key}
            title={`${num} ${s.name}${cond ? " · " + SURFACE_CONDITIONS[cond].label : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(num, s.key);
            }}
            className="absolute inset-0 cursor-pointer hover:brightness-95"
            style={{ clipPath: SURFACE_CLIP[s.key], background: bg, zIndex: isSel ? 4 : 1 }}
          />
        );
      })}
      {tc && tc.overlay && (
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none z-[2] text-[15px] font-bold"
          style={{ color: (tc as { overlayColor?: string; border: string }).overlayColor ?? tc.border }}
        >
          {tc.overlay}
        </div>
      )}
    </div>
  );

  const numEl = (
    <div className="text-[10px] font-semibold font-mono" style={{ color: numColor }}>
      {num}
    </div>
  );
  const dotsEl = (
    <div className="h-2.5 flex items-center gap-0.5">
      {dotColor && <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} title={tc?.label} />}
    </div>
  );

  return (
    <div
      className="flex flex-col items-center gap-[3px]"
      style={{ width: geo.boxW + 4, transform: `translateY(${geo.shift})` }}
    >
      {isUpper ? (
        <>
          {numEl}
          {box}
          {dotsEl}
        </>
      ) : (
        <>
          {dotsEl}
          {box}
          {numEl}
        </>
      )}
    </div>
  );
}

function Arch({
  quadrants,
  isUpper,
  findings,
  selected,
  onToggle,
}: {
  quadrants: number[][];
  isUpper: boolean;
  findings: Findings;
  selected: Set<string>;
  onToggle: (num: number, key: SurfaceKey) => void;
}) {
  return (
    <div className="flex justify-center gap-3.5">
      {quadrants.map((teeth, qi) => (
        <div
          key={qi}
          className="flex gap-[3px] px-0.5"
          style={{ borderRight: qi === 0 ? "1.5px solid #EFEDE7" : "none" }}
        >
          {teeth.map((num) => (
            <Tooth
              key={num}
              num={num}
              isUpper={isUpper}
              finding={findings[num] ?? {}}
              selected={selected}
              onToggle={onToggle}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Odontogram({
  findings,
  selected,
  onToggle,
}: {
  findings: Findings;
  selected: Set<string>;
  onToggle: (num: number, key: SurfaceKey) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Arch quadrants={[QUADRANTS.ur, QUADRANTS.ul]} isUpper findings={findings} selected={selected} onToggle={onToggle} />
      <div className="h-px bg-[#EFEDE7] mx-10" />
      <Arch quadrants={[QUADRANTS.ll, QUADRANTS.lr]} isUpper={false} findings={findings} selected={selected} onToggle={onToggle} />
    </div>
  );
}

export const ODONTOGRAM_LEGEND = [
  ...Object.values(SURFACE_CONDITIONS).map((c) => ({
    bg: c.color,
    border: c.color === "#EAF1EE" ? "#20614E" : c.color,
    label: c.label,
  })),
  { bg: "#F2E4C0", border: "#B08529", label: "Crown" },
  { bg: "#DDE7E3", border: "#4E8A75", label: "Implant" },
  { bg: "#EFEDE7", border: "#CFCDC5", label: "Missing" },
];

export const SEED_FINDINGS: Findings = {
  16: { surfaces: { occlusal: "caries", mesial: "caries" }, tooth: "plannedTooth" },
  15: { surfaces: { distal: "caries" } },
  26: { surfaces: { occlusal: "filled" } },
  36: { tooth: "missing" },
  46: { tooth: "crown" },
  47: { tooth: "rct", surfaces: {} },
  11: { surfaces: { buccal: "wear" } },
  21: { surfaces: { buccal: "wear" } },
  38: { tooth: "missing" },
  48: { tooth: "missing" },
};
