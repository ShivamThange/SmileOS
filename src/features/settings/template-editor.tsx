import { useMemo, useRef, useState } from "react";
import { Panel, MicroLabel } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { useUIStore } from "@/hooks/use-ui-store";
import { useTemplatesStore } from "./use-templates-store";
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_VARIABLES,
  GROUP_LABEL,
  GROUP_BLURB,
  WHATSAPP_LIMIT,
  renderTemplate,
  sampleVars,
  unknownTokens,
  type TemplateGroup,
} from "./templates-data";
import { clinicConfig } from "@/config/clinic";
import { cn } from "@/lib/utils";

/*
 * The template editor.
 *
 * Nobody can proofread a string full of {curly braces}, so the preview is not a
 * tab — it sits beside the source and updates on every keystroke, rendered as
 * the thing it will actually be: a WhatsApp bubble for messages, a plan callout
 * for clinical prose, a document for consent.
 *
 * Variables are inserted at the cursor by clicking a chip, because typing
 * braces from memory is how you end up with {nmae} in four hundred messages.
 * Anything outside the vocabulary is flagged rather than silently blanked.
 */

const GROUPS: TemplateGroup[] = ["messages", "clinical", "documents"];

export function TemplateEditor() {
  const { showToast } = useUIStore();
  const { overrides, setBody, reset, resolve } = useTemplatesStore();

  const [selectedId, setSelectedId] = useState(DEFAULT_TEMPLATES[0].id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const template = resolve(selectedId) ?? DEFAULT_TEMPLATES[0];
  const overridden = overrides[selectedId] !== undefined;

  const vars = useMemo(() => sampleVars(), []);
  const preview = renderTemplate(template.body, vars);
  const unknown = unknownTokens(template.body);
  const tooLong = template.body.length > WHATSAPP_LIMIT;

  const insert = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      setBody(selectedId, template.body + token);
      return;
    }
    const start = el.selectionStart ?? template.body.length;
    const end = el.selectionEnd ?? start;
    const next = template.body.slice(0, start) + token + template.body.slice(end);
    setBody(selectedId, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="grid gap-3.5 items-start max-lg:grid-cols-1" style={{ gridTemplateColumns: "230px 1fr" }}>
      {/* The list */}
      <Panel className="p-1.5 flex flex-col gap-0.5 max-h-[640px] overflow-y-auto">
        {GROUPS.map((g) => (
          <div key={g} className="flex flex-col gap-0.5">
            <div className="text-[10px] font-bold tracking-[0.07em] text-muted-2 px-3 pt-2.5 pb-1">
              {GROUP_LABEL[g].toUpperCase()}
            </div>
            {DEFAULT_TEMPLATES.filter((t) => t.group === g).map((t) => {
              const sel = selectedId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "text-left text-[12px] font-medium px-3 py-2 rounded-md transition-colors flex items-center gap-1.5",
                    sel ? "text-primary font-semibold" : "text-muted-strong hover:bg-bg-content",
                  )}
                  style={
                    sel
                      ? { background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--primary-tint-border)" }
                      : undefined
                  }
                >
                  <span className="flex-1 min-w-0 truncate">{t.name}</span>
                  {overrides[t.id] !== undefined && (
                    <span
                      title="Edited by this clinic"
                      className="w-[6px] h-[6px] rounded-full bg-primary flex-none"
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </Panel>

      {/* The editor */}
      <div className="flex flex-col gap-3">
        <Panel className="px-5 py-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-semibold">{template.name}</span>
                {template.metaApproved && (
                  <span
                    title="This is a WhatsApp template. Substantial edits need re-approval by Meta."
                    className="text-[9.5px] font-bold px-1.5 py-px rounded-[4px] bg-warning-bg text-warning border border-warning-border"
                  >
                    NEEDS META APPROVAL
                  </span>
                )}
                {overridden && (
                  <span className="text-[9.5px] font-bold px-1.5 py-px rounded-[4px] bg-primary-tint text-primary border border-primary-tint-border">
                    EDITED
                  </span>
                )}
              </div>
              <div className="text-[12px] text-muted mt-0.5">{template.description}</div>
            </div>

            {overridden && (
              <button
                onClick={() => {
                  reset(selectedId);
                  showToast("Reset to the shipped wording");
                }}
                className="text-[11.5px] font-semibold text-muted hover:text-ink whitespace-nowrap"
              >
                Reset to default
              </button>
            )}
          </div>

          {/* Guidance that belongs next to the writing, not in a design doc. */}
          <div className="text-[11.5px] text-muted-2 leading-relaxed border-l-2 border-border pl-2.5">
            {GROUP_BLURB[template.group]}
          </div>

          <textarea
            ref={textareaRef}
            value={template.body}
            onChange={(e) => setBody(selectedId, e.target.value)}
            rows={template.group === "documents" ? 10 : 5}
            className="text-[13px] leading-relaxed px-3 py-2.5 border border-border rounded-md bg-bg-content outline-none focus:border-primary resize-y font-sans"
          />

          {/* Variables, inserted at the cursor. */}
          <div className="flex flex-col gap-1.5">
            <MicroLabel>Insert</MicroLabel>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.token}
                  onClick={() => insert(v.token)}
                  title={`${v.label} — e.g. "${v.sample}"`}
                  className="text-[11px] font-mono px-1.5 py-1 rounded-[5px] border border-border bg-surface text-muted hover:border-primary hover:text-primary"
                >
                  {v.token}
                </button>
              ))}
            </div>
          </div>

          {/* Problems, stated plainly. */}
          <div className="flex flex-wrap items-center gap-3 text-[11.5px]">
            <span className={cn("tnum", tooLong ? "text-danger font-semibold" : "text-muted-2")}>
              {template.body.length} / {WHATSAPP_LIMIT} characters
            </span>
            {unknown.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-danger font-semibold">
                <Icon name="alert" size={11} />
                {unknown.join(", ")} {unknown.length === 1 ? "isn't" : "aren't"} a known variable —
                it'll be sent literally
              </span>
            )}
          </div>
        </Panel>

        {/* The preview — the thing they're actually proofreading. */}
        <Panel className="px-5 py-4 flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <MicroLabel>Preview</MicroLabel>
            <span className="text-[11px] text-muted-2">with sample values</span>
          </div>
          <PreviewSurface group={template.group} text={preview} />
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PreviewSurface({ group, text }: { group: TemplateGroup; text: string }) {
  if (group === "messages") {
    return (
      <div className="rounded-lg p-4" style={{ background: "#E5DDD3" }}>
        <div className="max-w-[440px] ml-auto">
          <div
            className="rounded-[10px] rounded-tr-sm px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap"
            style={{ background: "#D9FDD3", color: "#111B21" }}
          >
            {text}
            <div className="text-[10px] text-right mt-1" style={{ color: "#667781" }}>
              6:42 pm ✓✓
            </div>
          </div>
          <div className="text-[10.5px] text-right mt-1.5" style={{ color: "#54656F" }}>
            from {clinicConfig.name}
          </div>
        </div>
      </div>
    );
  }

  if (group === "clinical") {
    return (
      <div className="rounded-lg p-4" style={{ background: "#EFEBE3" }}>
        <div className="rounded-[10px] border px-3.5 py-2.5 max-w-[560px]" style={{ borderColor: "#E5D2AC", background: "#FAF3E7" }}>
          <div className="text-[10.5px] font-bold tracking-[0.05em]" style={{ color: "#8A6B33" }}>
            IF THIS WAITS
          </div>
          <div className="text-[12.5px] leading-relaxed mt-1" style={{ color: "#57534a" }}>
            {text}
          </div>
        </div>
        <div className="text-[10.5px] mt-2" style={{ color: "#8C887E" }}>
          As it appears under an item on the patient's treatment plan.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-5" style={{ background: "#EFEBE3" }}>
      <div className="bg-white rounded-md px-6 py-5 max-w-[600px] mx-auto shadow-card-hover">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border">
          <div className="w-6 h-6 rounded-[6px] bg-primary text-on-primary grid place-items-center text-[11px] font-bold">
            {clinicConfig.shortInitial}
          </div>
          <span className="text-[12px] font-semibold">{clinicConfig.name}</span>
          <span className="text-[10.5px] text-muted-2 ml-auto">
            {clinicConfig.locality}, {clinicConfig.city}
          </span>
        </div>
        <div className="text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink">{text}</div>
        <div className="mt-5 pt-3 border-t border-border-faint flex justify-between text-[10.5px] text-muted-2">
          <span>Signature</span>
          <span>Date</span>
        </div>
      </div>
    </div>
  );
}
