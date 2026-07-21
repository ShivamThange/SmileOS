import { create } from "zustand";
import { DEFAULT_TEMPLATES, renderTemplate, type TemplateDef } from "./templates-data";

/*
 * Template overrides.
 *
 * Only the edited body is stored, keyed by template id — so a clinic that has
 * changed two messages carries two rows, and everything else follows the
 * shipped default forever. That also means "reset to default" is a delete
 * rather than a copy, and a future improvement to the default prose reaches
 * every clinic that hasn't deliberately overridden it.
 */

interface TemplatesState {
  /** id → edited body. Absent means "use the shipped default". */
  overrides: Record<string, string>;
  setBody: (id: string, body: string) => void;
  reset: (id: string) => void;
  isOverridden: (id: string) => boolean;
  /** The template as it stands now, default or overridden. */
  resolve: (id: string) => TemplateDef | undefined;
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  overrides: {},

  setBody: (id, body) => set((s) => ({ overrides: { ...s.overrides, [id]: body } })),

  reset: (id) =>
    set((s) => {
      const next = { ...s.overrides };
      delete next[id];
      return { overrides: next };
    }),

  isOverridden: (id) => get().overrides[id] !== undefined,

  resolve: (id) => {
    const def = DEFAULT_TEMPLATES.find((t) => t.id === id);
    if (!def) return undefined;
    const override = get().overrides[id];
    return override === undefined ? def : { ...def, body: override };
  },
}));

/**
 * Render a template by id, outside React.
 *
 * The message drafts in `lib/whatsapp.ts` and the recovery queue call this, so
 * an edit in Settings actually changes what goes out rather than only changing
 * what's shown in Settings. That distinction is the whole point of the feature.
 */
export function renderById(id: string, vars: Record<string, string>): string {
  const def = useTemplatesStore.getState().resolve(id);
  if (!def) return "";
  return renderTemplate(def.body, vars);
}
