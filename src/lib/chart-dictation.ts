import type {
  Findings,
  SurfaceCondition,
  SurfaceKey,
  ToothCondition,
} from "@/components/domain/odontogram";

/*
 * The tooth-notation grammar.
 *
 * A dental examination is *already* spoken. The dentist calls findings as a
 * stream, in a standardised grammar, at speed:
 *
 *     "eighteen occlusal caries, seventeen missing, sixteen MOD amalgam,
 *      fifteen sound, fourteen distal caries..."
 *
 * Every dental exam on earth sounds roughly like this. And yet the interface
 * the profession is given is a picture of thirty-two teeth to be clicked, which
 * breaks the rhythm entirely — so charting gets done by an assistant
 * transcribing, or after the patient has left, from memory. Both are lossy.
 * The industry's answer has been to sell a chairside monitor with a plastic
 * cover, which is a hardware answer to an interaction-design problem.
 *
 * What makes dictation tractable here — and not a general speech problem — is
 * that the vocabulary is small and closed:
 *
 *     ~32 tooth identifiers · 5 surfaces · ~12 conditions
 *
 * That is a constrained grammar, so accuracy can be high, ambiguity resolves
 * against position ("distal" only ever follows a tooth number), and correction
 * is cheap because every utterance maps to exactly one visible change.
 *
 * This module is deliberately pure: text in, structured findings out. It has no
 * opinion about where the text came from, which is what lets the same parser
 * serve the microphone, the keyboard, and the bulk paper-migration mode.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

const UNITS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, zero: 0,
};

const TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
};

const SURFACE_WORDS: Record<string, SurfaceKey[]> = {
  occlusal: ["occlusal"], occlusive: ["occlusal"], o: ["occlusal"],
  mesial: ["mesial"], m: ["mesial"],
  distal: ["distal"], d: ["distal"],
  buccal: ["buccal"], b: ["buccal"], facial: ["buccal"], labial: ["buccal"],
  lingual: ["lingual"], l: ["lingual"], palatal: ["lingual"],
  incisal: ["occlusal"],
  // The abbreviations a dentist actually says out loud.
  mod: ["mesial", "occlusal", "distal"],
  mo: ["mesial", "occlusal"],
  od: ["occlusal", "distal"],
  do: ["distal", "occlusal"],
  // Front teeth have an incisal edge rather than an occlusal table; the
  // odontogram models five surfaces, so incisal maps onto occlusal.
  mid: ["mesial", "occlusal", "distal"],
  ob: ["occlusal", "buccal"],
};

/** Words that describe the state of a surface. */
const SURFACE_CONDITION_WORDS: Record<string, SurfaceCondition> = {
  caries: "caries", carious: "caries", decay: "caries", decayed: "caries",
  cavity: "caries", cavities: "caries", lesion: "caries",
  amalgam: "filled", composite: "filled", filling: "filled", filled: "filled",
  restoration: "filled", restored: "filled", gic: "filled", silver: "filled",
  wear: "wear", attrition: "wear", worn: "wear", abrasion: "wear", erosion: "wear",
  planned: "planned", plan: "planned",
};

/** Words that describe the whole tooth. */
const TOOTH_CONDITION_WORDS: Record<string, ToothCondition> = {
  missing: "missing", absent: "missing", extracted: "missing", edentulous: "missing",
  gone: "missing", unerupted: "missing",
  crown: "crown", capped: "crown", cap: "crown", crowned: "crown",
  rct: "rct", endo: "rct", "root-canal": "rct", rootcanal: "rct", obturated: "rct",
  implant: "implant", fixture: "implant",
  "for-extraction": "plannedTooth", plannedtooth: "plannedTooth",
};

/** Words meaning "nothing wrong here" — they clear a tooth rather than mark it. */
const SOUND_WORDS = new Set(["sound", "healthy", "normal", "clear", "intact", "unremarkable", "nad"]);

/** Noise words a dentist says between findings. */
const FILLER = new Set([
  "tooth", "teeth", "and", "then", "next", "the", "a", "on", "with", "has", "is",
  "there", "also", "um", "uh", "ok", "okay", "right", "surface", "surfaces", "of",
]);

/** Shown in the help panel so the grammar is discoverable rather than folklore. */
export const DICTATION_VOCAB = {
  teeth: 'FDI two-digit — say "one six", "sixteen", or "tooth 16"',
  surfaces: "occlusal · mesial · distal · buccal · lingual · MOD · MO · DO",
  surfaceConditions: "caries · amalgam / composite / filling · wear · planned",
  toothConditions: "missing · crown · root canal (RCT) · implant",
  clearing: "sound · healthy · normal — clears anything recorded on that tooth",
};

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

export interface DictationSegment {
  id: string;
  /** What was heard for this tooth, verbatim. */
  raw: string;
  tooth: number;
  surfaces: SurfaceKey[];
  surfaceCondition?: SurfaceCondition;
  toothCondition?: ToothCondition;
  /** Explicitly declared healthy — clears the tooth. */
  sound: boolean;
  /** Low when we heard a tooth but couldn't make sense of what followed. */
  confidence: "high" | "low";
  problem?: string;
}

let seq = 0;

/**
 * Turn a spoken stream into segments, one per tooth.
 *
 * The parser is forgiving on purpose. A dentist mid-examination will say
 * "sixteen, uh, MOD amalgam" and "one six occlusal decay" in the same breath,
 * and an interface that rejects either is an interface that gets abandoned
 * inside a week.
 */
export function parseDictation(text: string): DictationSegment[] {
  const tokens = tokenise(text);
  const segments: DictationSegment[] = [];
  let current: DictationSegment | null = null;
  let rawParts: string[] = [];

  const flush = () => {
    if (!current) return;
    current.raw = rawParts.join(" ");

    // A surface condition with no surface named defaults to occlusal, which is
    // where the overwhelming majority of unqualified findings actually are.
    if (current.surfaceCondition && current.surfaces.length === 0) {
      current.surfaces = ["occlusal"];
    }
    // Surfaces named with no condition are meaningless on their own.
    if (current.surfaces.length > 0 && !current.surfaceCondition) {
      current.confidence = "low";
      current.problem = "Heard a surface but no condition — say what's on it.";
    }
    if (
      !current.surfaceCondition &&
      !current.toothCondition &&
      !current.sound &&
      current.surfaces.length === 0
    ) {
      current.confidence = "low";
      current.problem = "Heard a tooth number but nothing about it.";
    }

    segments.push(current);
    current = null;
    rawParts = [];
  };

  for (const tok of tokens) {
    const asTooth = toothFrom(tok);
    if (asTooth !== null) {
      flush();
      current = {
        id: `seg_${Date.now().toString(36)}_${seq++}`,
        raw: "",
        tooth: asTooth,
        surfaces: [],
        sound: false,
        confidence: "high",
      };
      rawParts = [tok];
      continue;
    }

    if (!current) continue; // words before the first tooth number are ignored
    rawParts.push(tok);

    if (FILLER.has(tok)) continue;

    if (SOUND_WORDS.has(tok)) {
      current.sound = true;
      continue;
    }

    const surfaces = SURFACE_WORDS[tok];
    if (surfaces) {
      for (const s of surfaces) if (!current.surfaces.includes(s)) current.surfaces.push(s);
      continue;
    }

    const sc = SURFACE_CONDITION_WORDS[tok];
    if (sc) {
      current.surfaceCondition = sc;
      continue;
    }

    const tc = TOOTH_CONDITION_WORDS[tok];
    if (tc) {
      current.toothCondition = tc;
      continue;
    }

    // Unrecognised word inside a segment — note it, don't discard the segment.
    if (current.confidence === "high" && tok.length > 2) {
      current.problem = `Didn't recognise "${tok}".`;
    }
  }

  flush();
  return segments;
}

/** Apply parsed segments on top of an existing chart. */
export function applySegments(base: Findings, segments: DictationSegment[]): Findings {
  const next: Findings = { ...base };

  for (const seg of segments) {
    if (seg.confidence === "low" && !seg.toothCondition && !seg.surfaceCondition && !seg.sound) {
      continue;
    }

    if (seg.sound) {
      delete next[seg.tooth];
      continue;
    }

    const existing = next[seg.tooth] ?? {};
    const merged = { ...existing, surfaces: { ...(existing.surfaces ?? {}) } };

    if (seg.toothCondition) {
      merged.tooth = seg.toothCondition;
      // A missing tooth has no surfaces to speak of.
      if (seg.toothCondition === "missing") merged.surfaces = {};
    }

    if (seg.surfaceCondition) {
      for (const s of seg.surfaces) merged.surfaces[s] = seg.surfaceCondition;
    }

    next[seg.tooth] = merged;
  }

  return next;
}

/** A readable line for the running transcript beside the arch. */
export function describeSegment(seg: DictationSegment): string {
  if (seg.sound) return `${seg.tooth} — sound`;

  const parts: string[] = [];
  if (seg.surfaces.length > 0 && seg.surfaceCondition) {
    parts.push(`${seg.surfaces.map(abbrev).join("")} ${seg.surfaceCondition}`);
  }
  if (seg.toothCondition) parts.push(labelForTooth(seg.toothCondition));

  return parts.length > 0 ? `${seg.tooth} — ${parts.join(", ")}` : `${seg.tooth} — ?`;
}

function abbrev(s: SurfaceKey): string {
  return { mesial: "M", occlusal: "O", distal: "D", buccal: "B", lingual: "L" }[s] ?? "?";
}

function labelForTooth(t: ToothCondition): string {
  return { missing: "missing", crown: "crown", rct: "root canal", implant: "implant", plannedTooth: "planned" }[t];
}

// ---------------------------------------------------------------------------
// Tokenising
// ---------------------------------------------------------------------------

/**
 * Normalise a spoken stream into tokens, with number words resolved.
 *
 * The tricky part is that "one six" and "sixteen" both mean tooth 16, while
 * "one" on its own means nothing useful. Composition happens here so the main
 * parser only ever sees resolved two-digit tokens.
 */
function tokenise(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/root canal/g, "rootcanal")
    .replace(/for extraction/g, "for-extraction")
    .replace(/[.,;:!?()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const out: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];

    // "forty seven" → 47
    if (TENS[w] !== undefined) {
      const nextUnit = UNITS[words[i + 1]];
      if (nextUnit !== undefined && nextUnit >= 1 && nextUnit <= 8) {
        out.push(String(TENS[w] + nextUnit));
        i++;
        continue;
      }
      out.push(String(TENS[w]));
      continue;
    }

    // "eighteen" → 18
    if (TEENS[w] !== undefined) {
      out.push(String(TEENS[w]));
      continue;
    }

    // "one eight" → 18 (quadrant then position, how it's usually said)
    if (UNITS[w] !== undefined) {
      const q = UNITS[w];
      const p = UNITS[words[i + 1]] ?? numeric(words[i + 1]);
      if (q >= 1 && q <= 4 && p !== null && p >= 1 && p <= 8) {
        out.push(String(q * 10 + p));
        i++;
        continue;
      }
      out.push(String(q));
      continue;
    }

    // "1 8" typed as digits
    const n = numeric(w);
    if (n !== null) {
      if (n >= 1 && n <= 4) {
        const p = UNITS[words[i + 1]] ?? numeric(words[i + 1]);
        if (p !== null && p >= 1 && p <= 8) {
          out.push(String(n * 10 + p));
          i++;
          continue;
        }
      }
      out.push(String(n));
      continue;
    }

    out.push(w);
  }

  return out;
}

function numeric(w: string | undefined): number | null {
  if (!w) return null;
  return /^\d{1,2}$/.test(w) ? parseInt(w, 10) : null;
}

/** A valid FDI permanent-dentition number, or null. */
function toothFrom(token: string): number | null {
  if (!/^\d{2}$/.test(token)) return null;
  const n = parseInt(token, 10);
  const quadrant = Math.floor(n / 10);
  const position = n % 10;
  if (quadrant < 1 || quadrant > 4) return null;
  if (position < 1 || position > 8) return null;
  return n;
}
