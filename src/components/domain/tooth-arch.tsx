/*
 * ToothArch — the radially-positioned dental arch used by the patient-facing
 * Treatment Plan and Cost Calculator (ported from TreatmentPlan/Calculator.dc.html).
 * Distinct from the console Odontogram (flat FDI quadrants): here teeth are
 * placed on an ellipse so a patient reads it as a mouth, not a chart.
 *
 * FDI two-digit numbering. Each tooth is a rounded box whose size and corner
 * radius vary by position (molars square, incisors tall). Pass `styleFor` to
 * colour teeth and an optional `onToggle` to make them selectable.
 */

export const UPPER_FDI = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_FDI = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

export interface ToothStyle {
  bg: string;
  border: string;
  shadow?: string;
}

interface Geom {
  w: number;
  h: number;
  cx: number;
  rx: number;
  upperY: number;
  lowerY: number;
  ry: number;
  scale: number;
}

const GEOM: Record<"plan" | "calc", Geom> = {
  plan: { w: 400, h: 300, cx: 200, rx: 168, upperY: 128, lowerY: 172, ry: 106, scale: 1 },
  calc: { w: 420, h: 320, cx: 210, rx: 178, upperY: 136, lowerY: 184, ry: 112, scale: 1.06 },
};

function toothDims(num: number, scale: number) {
  const d = num % 10;
  let w: number;
  let h: number;
  if (d >= 6) { w = 30; h = 25; }
  else if (d >= 4) { w = 25; h = 24; }
  else if (d === 3) { w = 22; h = 29; }
  else if (d === 2) { w = 21; h = 28; }
  else { w = 25; h = 31; }
  return { w: w * scale, h: h * scale };
}

function toothRadius(num: number, isUpper: boolean): string {
  const d = num % 10;
  let r: string[];
  if (d >= 6) r = ["38%", "38%", "42%", "42%"];
  else if (d >= 4) r = ["45%", "45%", "48%", "48%"];
  else if (d === 3) r = ["42%", "42%", "62%", "62%"];
  else r = ["32%", "32%", "52%", "52%"];
  if (!isUpper) r = [r[2], r[3], r[0], r[1]];
  return r.join(" ");
}

function place(num: number, i: number, isUpper: boolean, g: Geom) {
  const th = ((-76 + i * (152 / 15)) * Math.PI) / 180;
  const x = g.cx + g.rx * Math.sin(th);
  const y = isUpper ? g.upperY - g.ry * Math.cos(th) : g.lowerY + g.ry * Math.cos(th);
  const rot = ((isUpper ? 1 : -1) * th * 180) / Math.PI;
  return { x, y, rot };
}

export function ToothArch({
  size = "plan",
  styleFor,
  onToggle,
  titleFor,
}: {
  size?: "plan" | "calc";
  styleFor: (num: number) => ToothStyle;
  onToggle?: (num: number) => void;
  titleFor?: (num: number) => string;
}) {
  const g = GEOM[size];
  const rows: { arr: number[]; isUpper: boolean }[] = [
    { arr: UPPER_FDI, isUpper: true },
    { arr: LOWER_FDI, isUpper: false },
  ];
  return (
    <div
      className="relative mx-auto max-w-full"
      style={{ width: g.w, height: g.h }}
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] tracking-[0.1em] text-[#C9C1AF] font-mono">
        UPPER · LOWER
      </div>
      {rows.map(({ arr, isUpper }) =>
        arr.map((num, i) => {
          const { x, y, rot } = place(num, i, isUpper, g);
          const dims = toothDims(num, g.scale);
          const st = styleFor(num);
          return (
            <div
              key={num}
              title={titleFor ? titleFor(num) : `Tooth ${num}`}
              onClick={onToggle ? () => onToggle(num) : undefined}
              className={onToggle ? "cursor-pointer hover:brightness-[0.94]" : ""}
              style={{
                position: "absolute",
                left: `${x.toFixed(1)}px`,
                top: `${y.toFixed(1)}px`,
                width: `${dims.w}px`,
                height: `${dims.h}px`,
                transform: `translate(-50%,-50%) rotate(${rot.toFixed(1)}deg)`,
                background: st.bg,
                border: `1.5px solid ${st.border}`,
                borderRadius: toothRadius(num, isUpper),
                boxShadow: st.shadow ?? "none",
                boxSizing: "border-box",
              }}
            />
          );
        }),
      )}
    </div>
  );
}
