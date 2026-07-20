import { Link } from "react-router-dom";
import { clinicConfig } from "@/config/clinic";

/**
 * Patient Portal — designed in Portal.dc.html; out of scope for this
 * Console-first pass. Minimal branded placeholder that links back to the hub.
 */
export function PortalHome() {
  return (
    <div className="min-h-screen bg-bg text-ink grid place-items-center px-5">
      <div className="max-w-[420px] text-center flex flex-col items-center gap-3">
        <div className="w-11 h-11 rounded-lg bg-primary text-on-primary grid place-items-center text-xl font-bold">
          {clinicConfig.shortInitial}
        </div>
        <h1 className="font-serif text-2xl font-medium m-0">Patient Portal</h1>
        <p className="text-[13px] text-muted leading-relaxed">
          The at-home patient experience — next visit, what's owed, and treatment plans awaiting a
          decision — is designed and comes next. The Console ships first.
        </p>
        <Link to="/" className="text-[12.5px] font-semibold px-4 py-2 rounded-md bg-primary text-on-primary hover:bg-primary-hover">
          Back to hub
        </Link>
      </div>
    </div>
  );
}
