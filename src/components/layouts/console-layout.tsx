import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { navGroups } from "@/config/nav";
import { clinicConfig, TODAY_LABEL } from "@/config/clinic";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/hooks/use-ui-store";
import { CommandPalette } from "@/components/common/command-palette";
import { ToastHost } from "@/components/common/toast";
import { PatientPreviewDrawer } from "@/components/common/patient-preview-drawer";
import { NotificationsPanel } from "@/features/notifications/notifications-panel";

const CREATE_ITEMS = [
  { label: "New appointment", key: "A", to: "/app/calendar" },
  { label: "New patient", key: "P", to: "/app/patients/new" },
  { label: "New invoice", key: "I", to: "/app/invoices" },
  { label: "New lead", key: "L", to: "/app/leads" },
];

export function ConsoleLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { setPaletteOpen } = useUIStore();

  const isActive = (match: string) => new RegExp(match).test(location.pathname);
  const closeMenus = () => { setPlusOpen(false); setNotifOpen(false); };

  return (
    <div
      className="flex h-screen overflow-hidden bg-bg text-ink"
      onClick={() => (plusOpen || notifOpen) && closeMenus()}
    >
      {/* Sidebar */}
      <nav
        className="flex-none flex flex-col border-r border-border bg-bg overflow-hidden transition-[width] duration-200"
        style={{ width: collapsed ? 60 : 224 }}
      >
        <div className="flex items-center gap-2.5 px-3.5 pt-4 pb-3.5 min-w-0">
          <Link
            to="/app"
            title="Dashboard"
            className="w-7 h-7 flex-none rounded-[7px] bg-primary text-on-primary grid place-items-center text-[13px] font-bold"
          >
            {clinicConfig.shortInitial}
          </Link>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold tracking-[-0.01em] whitespace-nowrap">
                {clinicConfig.name}
              </div>
              <div className="text-[10.5px] text-muted-2 whitespace-nowrap">
                {clinicConfig.locality} · {clinicConfig.city}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 flex flex-col gap-0.5">
          {navGroups.map((grp, gi) => (
            <div key={gi} className="flex flex-col gap-px" style={{ marginTop: gi === 0 ? 0 : 10 }}>
              {grp.label && !collapsed && (
                <div className="text-[10px] font-semibold tracking-[0.08em] text-muted-2 px-2.5 pt-2 pb-1">
                  {grp.label}
                </div>
              )}
              {grp.items.map((nv) => {
                const active = isActive(nv.match ?? nv.to);
                return (
                  <Link
                    key={nv.id}
                    to={nv.to}
                    title={nv.label}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px] no-underline",
                      active
                        ? "bg-surface text-primary font-semibold"
                        : "text-muted-strong font-medium hover:bg-[var(--nav-hover)]",
                    )}
                  >
                    <Icon name={nv.icon} size={16} />
                    {!collapsed && (
                      <>
                        <span className="text-[13px] whitespace-nowrap flex-1">{nv.label}</span>
                        {nv.count && (
                          <span className="text-[10.5px] font-semibold bg-primary text-on-primary rounded-[9px] px-[7px] py-px font-mono">
                            {nv.count}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="px-3.5 py-2.5 border-t border-border cursor-pointer flex items-center gap-2.5 text-muted text-xs hover:bg-[var(--nav-hover)]"
        >
          <Icon
            name="chevronLeft"
            size={16}
            style={{ transform: collapsed ? "rotate(180deg)" : "none" }}
          />
          {!collapsed && <span className="whitespace-nowrap">Collapse</span>}
        </button>
      </nav>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 bg-bg-content">
        <header className="h-[52px] flex-none flex items-center gap-3 px-4 border-b border-border bg-surface">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 w-[320px] max-w-[34vw] px-2.5 py-1.5 border border-border rounded-md bg-bg-content text-muted-2 text-[12.5px] hover:border-border-strong"
          >
            <Icon name="search" size={14} />
            <span className="flex-1 text-left">Search patients, appointments, bills…</span>
            <span className="font-mono text-[10.5px] border border-border rounded-sm px-1.5 py-px bg-surface">
              ⌘K
            </span>
          </button>

          <div className="flex-1" />

          <div className="text-[12.5px] text-muted flex items-center gap-2">
            <span className="font-semibold text-ink">{TODAY_LABEL}</span>
            <span className="text-border-strong">·</span>
            <span>{clinicConfig.branch}</span>
          </div>

          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setPlusOpen(false); setNotifOpen((o) => !o); }}
              title="Notifications"
              className="relative w-8 h-8 grid place-items-center rounded-md cursor-pointer text-muted hover:bg-bg"
            >
              <Icon name="bell" size={17} />
              <span className="absolute top-[5px] right-1.5 w-[7px] h-[7px] rounded-full bg-danger border-[1.5px] border-surface" />
            </button>
            <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
          </div>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNotifOpen(false);
                setPlusOpen((o) => !o);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-on-primary text-[12.5px] font-semibold hover:bg-primary-hover"
            >
              <Icon name="plus" size={13} strokeWidth={1.6} />
              Create
            </button>
            {plusOpen && (
              <div className="absolute right-0 top-10 z-[60] w-[190px] bg-surface border border-border rounded-lg shadow-dropdown p-[5px] animate-dc-fade">
                {CREATE_ITEMS.map((pi) => (
                  <button
                    key={pi.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlusOpen(false);
                      navigate(pi.to);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-[7px] text-[12.5px] hover:bg-bg"
                  >
                    <span className="font-medium">{pi.label}</span>
                    <span className="font-mono text-[10px] text-muted-2">{pi.key}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            title={`${clinicConfig.ownerName} — Owner`}
            onClick={() => navigate("/app/settings")}
            className="w-[30px] h-[30px] rounded-full bg-primary-tint text-primary grid place-items-center text-[11.5px] font-bold border border-primary-tint-border"
          >
            AM
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-6 pt-5 pb-10">
          <Outlet />
        </main>
      </div>

      {/* Overlays */}
      <CommandPalette />
      <PatientPreviewDrawer />
      <ToastHost />
    </div>
  );
}
