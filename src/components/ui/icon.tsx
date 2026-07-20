/*
 * Icon paths ported verbatim from the Claude Design project so the console's
 * iconography matches exactly (thin 1.4 stroke, 16px grid). Rendered as a
 * single <path> stroked with currentColor.
 */
export const ICONS = {
  dashboard: "M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5V7H9zM2.5 9H7v4.5H2.5zM9 9h4.5v4.5H9z",
  schedule: "M2.5 4h11v9.5h-11zM2.5 7.5h11M5.5 2.5V5M10.5 2.5V5",
  patients: "M8 7.5A2.75 2.75 0 1 0 8 2a2.75 2.75 0 0 0 0 5.5zM2.5 13.5c0-2.8 2.3-4.2 5.5-4.2s5.5 1.4 5.5 4.2",
  clinical: "M6.25 2.5h3.5v3.75h3.75v3.5H9.75v3.75h-3.5V9.75H2.5v-3.5h3.75z",
  revenue: "M5 2.5h6.5M5 5.5h6.5M5 2.5c3 0 4.75.9 4.75 3S8 8.5 5 8.5l5.5 5",
  growth: "M2.5 12.5l4-4 2.5 2.5L13.5 5M13.5 8V5h-3",
  operations: "M2.5 5.25L8 2.5l5.5 2.75v5.5L8 13.5l-5.5-2.75zM2.5 5.25L8 8l5.5-2.75M8 8v5.5",
  team: "M6 7a2.4 2.4 0 1 0 0-4.8A2.4 2.4 0 0 0 6 7zM1.5 13.5c0-2.4 1.9-3.7 4.5-3.7s4.5 1.3 4.5 3.7M10.2 6.9c1.2-.2 2.1-1.1 2.1-2.4 0-1.2-.8-2.1-1.9-2.3M11.6 10c1.7.4 2.9 1.5 2.9 3.5",
  insight: "M3 13.5V8M8 13.5v-11M13 13.5V6",
  settings: "M2.5 4.5h11M2.5 8h11M2.5 11.5h11M6 3v3M11 6.5v3M4.5 10v3",
  search: "M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.5 10.5l3 3",
  bell: "M3.5 11.5h9c-.9-1-1.4-2.1-1.4-3.9C11.1 5 9.7 3.5 8 3.5S4.9 5 4.9 7.6c0 1.8-.5 2.9-1.4 3.9zM6.6 13.5a1.5 1.5 0 0 0 2.8 0",
  plus: "M8 3v10M3 8h10",
  chevronLeft: "M9.5 4L5.5 8l4 4",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.4,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      style={{ flex: "none", ...style }}
    >
      <path
        d={ICONS[name]}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
