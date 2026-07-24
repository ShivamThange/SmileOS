import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "tint" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

/*
 * Buttons carry a hint of physical depth: a tactile gradient + soft shadow on
 * the primary, a hairline elevation on the rest, and a 1px press-down on
 * :active so a click feels like it lands. `transition-[transform,box-shadow,…]`
 * (not `transition-all`) keeps the motion to the properties we mean; reduced
 * motion is honoured globally in tokens.css.
 */
const base =
  "inline-flex items-center justify-center gap-1.5 font-semibold rounded-md cursor-pointer select-none whitespace-nowrap transition-[transform,box-shadow,background-color,border-color,color] duration-150 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:shadow-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary-grad text-on-primary shadow-primary hover:bg-primary-grad-hover hover:shadow-md active:shadow-xs",
  secondary:
    "bg-surface text-ink border border-border shadow-xs hover:bg-bg hover:border-border-strong hover:shadow-sm",
  tint: "bg-primary-tint text-primary border border-primary-tint-border hover:bg-primary-tint-border hover:shadow-xs",
  ghost: "bg-transparent text-ink hover:bg-bg",
  danger: "bg-surface text-danger border border-border shadow-xs hover:bg-danger-bg hover:border-danger-border",
};

const sizes: Record<Size, string> = {
  sm: "text-[11.5px] px-2.5 py-1.5",
  md: "text-[12.5px] px-3 py-1.5",
  lg: "text-[13px] px-4 py-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
