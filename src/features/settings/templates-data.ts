/*
 * Clinic-editable templates.
 *
 * A meaningful amount of this product's voice is prose: the message that chases
 * a deferred crown, the sentence explaining what happens if a cracked tooth
 * waits, the post-op instructions handed over at the desk. Every clinic will
 * want to change some of it — a paediatric practice does not sound like an
 * implant centre — and the whitelabel model's entire premise is that they can,
 * without a code change.
 *
 * Two rules shape the design:
 *
 *   Constrain hard. A clinic must not be able to configure itself into a broken
 *   workflow, so the variables are a fixed vocabulary, unknown ones are flagged,
 *   and every template can be reset to the shipped default.
 *
 *   Always preview. Nobody can proofread a string with {curly braces} in it.
 *   The editor renders the real thing beside the source, with sample values, at
 *   every keystroke.
 */

export type TemplateGroup = "messages" | "clinical" | "documents";

export interface TemplateVariable {
  token: string;
  label: string;
  sample: string;
}

/** The closed vocabulary. Anything else in a body is an error, not a feature. */
export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { token: "{name}", label: "Patient's first name", sample: "Ramesh" },
  { token: "{fullName}", label: "Patient's full name", sample: "Ramesh Iyer" },
  { token: "{clinic}", label: "Clinic name", sample: "Meher Dental Care" },
  { token: "{doctor}", label: "Treating doctor", sample: "Dr. Meher" },
  { token: "{date}", label: "Appointment date", sample: "Tue 28 Jul" },
  { token: "{time}", label: "Appointment time", sample: "6:30pm" },
  { token: "{procedure}", label: "Procedure", sample: "root canal" },
  { token: "{tooth}", label: "Tooth", sample: "tooth 46" },
  { token: "{amount}", label: "Amount", sample: "₹9,500" },
  { token: "{link}", label: "Link to the plan or portal", sample: "meher.care/p/4f2a" },
];

export interface TemplateDef {
  id: string;
  group: TemplateGroup;
  name: string;
  /** When this gets used, in one line. */
  description: string;
  /** WhatsApp templates need Meta approval; that constrains what may change. */
  metaApproved?: boolean;
  body: string;
}

/*
 * Defaults.
 *
 * The clinical ones are written conservatively on purpose. "What happens if you
 * wait" is a clinical-ethics boundary rather than a sales lever, and a clinic
 * editing these should be nudged toward description rather than pressure — which
 * is why the guidance sits in the editor rather than only in a design doc.
 */
export const DEFAULT_TEMPLATES: TemplateDef[] = [
  // --- messages ------------------------------------------------------------
  {
    id: "msg.confirmation",
    group: "messages",
    name: "Appointment confirmation",
    description: "Sent when a booking is made. Queued, never sent inline.",
    metaApproved: true,
    body: "Hello {name}, this is {clinic}. We have you booked for {date} at {time} with {doctor}. Reply YES to confirm, or tell us a better time and we'll move it.",
  },
  {
    id: "msg.reminder",
    group: "messages",
    name: "Day-before reminder",
    description: "Sent the evening before. The single biggest lever on no-shows.",
    metaApproved: true,
    body: "Hello {name}, a reminder that you're seeing {doctor} at {clinic} tomorrow at {time}. Reply YES to confirm — if something's come up, just tell us and we'll move it.",
  },
  {
    id: "msg.runningLate",
    group: "messages",
    name: "Running late",
    description: "Sent from the check-in screen when someone hasn't arrived.",
    body: "Hello {name}, {clinic} here — we have your slot held. Are you on your way? Happy to shift you later today if that's easier.",
  },
  {
    id: "msg.receipt",
    group: "messages",
    name: "Payment receipt",
    description: "Sent automatically after a settlement. Nobody prints unless asked.",
    metaApproved: true,
    body: "Thank you {name}. We've received {amount} at {clinic}. Your receipt is attached.",
  },
  {
    id: "msg.recovery.stuck",
    group: "messages",
    name: "Recovery — opened the plan, never replied",
    description: "For a patient who has read the plan repeatedly. They're stuck on something specific.",
    body: "Hello {name}, {clinic} here. I noticed you've had another look at the plan for your {procedure} — is there something on it you'd like explained, or a cost question? Happy to talk it through, no pressure either way.",
  },
  {
    id: "msg.recovery.unopened",
    group: "messages",
    name: "Recovery — never opened the plan",
    description: "The link may simply not have reached them. Ask before assuming.",
    body: "Hello {name}, {clinic} here. We sent through the plan for your {procedure} — I'm not sure it reached you. Would you like me to resend it?",
  },
  {
    id: "msg.recovery.urgent",
    group: "messages",
    name: "Recovery — clinically urgent",
    description: "Where delay materially changes the treatment. Keep it factual.",
    body: "Hello {name}, {clinic} here. {doctor} asked me to check in about the {procedure} on {tooth}. Leaving it longer usually makes it a bigger job, so I wanted to give you first refusal on a slot. Shall I hold one?",
  },
  {
    id: "msg.recovery.general",
    group: "messages",
    name: "Recovery — general follow-up",
    description: "When there's no strong signal either way. References what they told us last time.",
    body: "Hello {name}, {clinic} here. When we last spoke about the {procedure} ({amount}) you mentioned you wanted to hold off for a bit. Is now a better time to look at it?",
  },
  {
    id: "msg.recall",
    group: "messages",
    name: "Recall due",
    description: "Sent at the patient's own clinical interval, not a global six months.",
    metaApproved: true,
    body: "Hello {name}, it's been a while since we last saw you at {clinic}. {doctor} suggested a check-up around now. Shall I find you a time?",
  },
  {
    id: "msg.planSent",
    group: "messages",
    name: "Treatment plan sent",
    description: "Carries the link. The patient can accept or defer each item themselves.",
    body: "Hello {name}, here's the plan {doctor} put together for you: {link}. You can accept or set aside each part yourself, and there's a monthly view too. Nothing is decided until you tell us.",
  },

  // --- clinical prose ------------------------------------------------------
  {
    id: "clin.wait.caries",
    group: "clinical",
    name: "If this waits — a cavity",
    description: "Shown under a filling on the patient-facing plan.",
    body: "Cavities only grow. This one is currently a filling. If it reaches the nerve it becomes a root canal and a cap, which is several times the cost and several more visits.",
  },
  {
    id: "clin.wait.crackedTooth",
    group: "clinical",
    name: "If this waits — a cracked tooth",
    description: "Shown under a crown or onlay.",
    body: "It may hold for a long time, or it may split while you're eating. If it splits below the gumline the tooth usually can't be kept.",
  },
  {
    id: "clin.wait.missingTooth",
    group: "clinical",
    name: "If this waits — a missing tooth",
    description: "Shown under implant, bridge and denture options.",
    body: "The neighbouring teeth keep drifting, and past a point they need straightening before anything can go in the gap — which adds time and cost. The bone in the gap also thins slowly once a tooth is gone.",
  },
  {
    id: "clin.wait.gums",
    group: "clinical",
    name: "If this waits — gum treatment",
    description: "Shown under scaling and periodontal work.",
    body: "Gum inflammation tends to worsen slowly rather than suddenly. Left long enough it starts to affect the bone holding the teeth, and that part doesn't grow back.",
  },

  // --- documents -----------------------------------------------------------
  {
    id: "doc.consent.surgical",
    group: "documents",
    name: "Consent — surgical procedure",
    description: "Signed before extractions and implant placement.",
    body: "I, {fullName}, consent to {procedure} on {tooth}, to be carried out by {doctor} at {clinic}. The procedure, its alternatives and its risks — including bleeding, infection, swelling, and in rare cases nerve involvement — have been explained to me in a language I understand. I have had the opportunity to ask questions.",
  },
  {
    id: "doc.postop.extraction",
    group: "documents",
    name: "Post-op — after an extraction",
    description: "Sent on WhatsApp as the patient leaves.",
    body: "{name}, a few things for today:\n\n• Bite firmly on the gauze for 30 minutes.\n• No rinsing, spitting or straws today — it disturbs the clot.\n• Cold food and drink today; nothing hot.\n• Some swelling on day two is normal and settles.\n• Take the painkillers before the numbness wears off.\n\nIf bleeding doesn't settle or pain worsens after day three, call {clinic}.",
  },
  {
    id: "doc.postop.rct",
    group: "documents",
    name: "Post-op — after a root canal",
    description: "Sent after each root-canal visit.",
    body: "{name}, the tooth may feel tender for a few days — that's normal and settles. Please avoid chewing hard food on that side until the cap is fitted, because the tooth is more brittle until then. If you get swelling or the pain builds rather than settles, call {clinic}.",
  },
];

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const TOKEN_RE = /\{[a-zA-Z]+\}/g;

/** Substitute variables. Anything unknown is left visible rather than blanked. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(TOKEN_RE, (token) => {
    const key = token.slice(1, -1);
    return vars[key] ?? token;
  });
}

/** Sample values, for the editor's preview. */
export function sampleVars(): Record<string, string> {
  return Object.fromEntries(
    TEMPLATE_VARIABLES.map((v) => [v.token.slice(1, -1), v.sample]),
  );
}

/** Tokens used in a body that aren't in the vocabulary. */
export function unknownTokens(body: string): string[] {
  const known = new Set(TEMPLATE_VARIABLES.map((v) => v.token));
  return Array.from(new Set(body.match(TOKEN_RE) ?? [])).filter((t) => !known.has(t));
}

/**
 * WhatsApp's template limit. Not a hard failure in this prototype, but a clinic
 * writing a 900-character chase message should be told before Meta tells them.
 */
export const WHATSAPP_LIMIT = 1024;

export const GROUP_LABEL: Record<TemplateGroup, string> = {
  messages: "Messages",
  clinical: "Clinical prose",
  documents: "Consent & post-op",
};

export const GROUP_BLURB: Record<TemplateGroup, string> = {
  messages:
    "What the clinic sends. Keep them short and human — a message that reads like a form letter gets muted, and a muted patient is invisible to every other feature in this product.",
  clinical:
    "Shown to patients under each item on a treatment plan. Describe the consequence honestly and let them decide. This is a clinical-ethics boundary, not a place for urgency.",
  documents:
    "Printed or sent as documents. Consent wording should be reviewed by someone qualified before a clinic goes live on it.",
};
