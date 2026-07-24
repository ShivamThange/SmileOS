import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/*
 * One input treatment for the whole product. Text fields were previously styled
 * inline and inconsistently (some `rounded-md bg-bg-content`, some `rounded-lg
 * bg-bg`); this is the single source of truth: a soft `rounded-lg` field on the
 * content tint, a hairline border that firms up on hover, and — on focus — the
 * brand tint plus the same soft halo (`--ring-primary`) the rest of the app uses
 * for focus. Import `inputClass` to style a bespoke `<input>`/`<select>`/
 * `<textarea>`, or use the `<Input>` component for the common case.
 */
export const inputClass = cn(
  "w-full rounded-lg border border-border bg-bg-content px-3 py-2 text-[13px] text-ink",
  "outline-none transition-[border-color,box-shadow] duration-150",
  "placeholder:text-muted-2 hover:border-border-strong",
  "focus:border-primary focus:shadow-[var(--ring-primary)]",
  "disabled:opacity-60 disabled:cursor-not-allowed",
);

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputClass, className)} {...props} />
  ),
);
Input.displayName = "Input";
