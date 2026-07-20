import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "tint" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-1.5 font-semibold rounded-md cursor-pointer select-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "bg-surface text-ink border border-border hover:bg-bg",
  tint: "bg-primary-tint text-primary border border-primary-tint-border hover:bg-primary-tint-border",
  ghost: "bg-transparent text-ink hover:bg-bg",
  danger: "bg-surface text-danger border border-border hover:bg-danger-bg",
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
