import { useLocation, useNavigate } from "react-router-dom";
import { Panel } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { useUIStore } from "@/hooks/use-ui-store";

/*
 * A real 404.
 *
 * The router used to bounce every unmatched path silently to /app. That is the
 * worst of both worlds: the person who mistyped a URL, or followed a stale
 * bookmark from before a route moved, lands somewhere unexplained and concludes
 * the product lost their page. Silence reads as a bug.
 *
 * So: say what happened, show the path they asked for, and put the fastest way
 * out — the command palette — directly under it.
 */

const COMMON: { label: string; to: string }[] = [
  { label: "Today", to: "/app" },
  { label: "Schedule", to: "/app/calendar" },
  { label: "Patients", to: "/app/patients" },
  { label: "Recovery", to: "/app/revenue/unscheduled" },
  { label: "Insight", to: "/app/insight" },
];

export function NotFoundScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setPaletteOpen } = useUIStore();

  return (
    <div className="max-w-[560px] mx-auto pt-10">
      <Panel className="px-6 py-8 flex flex-col gap-4 text-center items-center">
        <div className="w-10 h-10 rounded-full bg-bg text-muted-2 grid place-items-center">
          <Icon name="search" size={18} />
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[17px] font-semibold tracking-[-0.01em]">
            There's nothing at this address
          </h1>
          <p className="m-0 text-[13px] text-muted leading-relaxed max-w-[400px]">
            <code className="font-mono text-[12px] bg-bg px-1.5 py-0.5 rounded-sm border border-border">
              {location.pathname}
            </code>{" "}
            doesn't match any screen. If you followed a link from inside the app, that's a bug worth
            reporting — nothing here should point at a page that doesn't exist.
          </p>
        </div>

        <button
          onClick={() => setPaletteOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-primary text-on-primary text-[12.5px] font-semibold hover:bg-primary-hover"
        >
          <Icon name="search" size={13} />
          Search for what you wanted
          <span className="font-mono text-[10px] border border-white/25 rounded-sm px-1.5 py-px">
            ⌘K
          </span>
        </button>

        <div className="flex flex-wrap justify-center gap-1.5 pt-1">
          {COMMON.map((c) => (
            <button
              key={c.to}
              onClick={() => navigate(c.to)}
              className="text-[12px] font-medium px-2.5 py-1 rounded-md border border-border bg-surface text-muted hover:border-primary hover:text-primary"
            >
              {c.label}
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
