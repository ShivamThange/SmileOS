import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { visibleNavGroups } from "@/config/nav";
import { usePermission } from "@/hooks/use-permission";
import { useFeatureEnabled } from "@/hooks/use-features";
import type { Permission } from "@/shared/rbac";
import { clinicConfig, TODAY_LABEL } from "@/config/clinic";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/hooks/use-ui-store";
import { useDeskStore } from "@/hooks/use-desk-store";
import { useSession, DEMO_USERS } from "@/hooks/use-session";
import { useAuth } from "@/hooks/use-auth";
import { session } from "@/lib/api";
import { logout as apiLogout } from "@/features/auth/api";
import { CommandPalette } from "@/components/common/command-palette";
import { ToastHost } from "@/components/common/toast";
import { PatientPreviewDrawer } from "@/components/common/patient-preview-drawer";
import { NotificationsPanel } from "@/features/notifications/notifications-panel";
import { BookingBar } from "@/components/desk/booking-bar";
import { SettleSheet } from "@/components/desk/settle-sheet";
import { ParkedTasks } from "@/components/desk/parked-tasks";

export function ConsoleLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [whoOpen, setWhoOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { setPaletteOpen } = useUIStore();
  const { openBooking } = useDeskStore();
  const { can, rolesFor } = usePermission();
  const featureOn = useFeatureEnabled();
  const { user, setUserId, isOverride } = useSession();

  async function handleSignOut() {
    setWhoOpen(false);
    setUserId(null); // clear any dev preview override
    await apiLogout(); // best-effort server-side session revoke
    session.clear();
    useAuth.getState().setGuest();
    navigate("/login", { replace: true });
  }

  const isActive = (match: string) => new RegExp(match).test(location.pathname);
  const closeMenus = () => {
    setPlusOpen(false);
    setNotifOpen(false);
    setWhoOpen(false);
  };

  /*
   * Create menu. "New appointment" opens the booking bar rather than navigating
   * to the calendar — the desk should never lose its place to start a task.
   */
  const createItems: { label: string; key: string; run: () => void; perm: Permission }[] = [
    { label: "New appointment", key: "A", run: () => openBooking(), perm: "appointment:create" },
    { label: "New patient", key: "P", run: () => navigate("/app/patients/new"), perm: "patient:create" },
    { label: "New invoice", key: "I", run: () => navigate("/app/invoices"), perm: "invoice:create" },
    { label: "New lead", key: "L", run: () => navigate("/app/leads"), perm: "lead:create" },
  ];
  const canBook = can("appointment:create");

  return (
    <div
      className="flex h-screen overflow-hidden bg-bg text-ink"
      onClick={() => (plusOpen || notifOpen || whoOpen) && closeMenus()}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* Sidebar */}
      <nav
        aria-label="Console sections"
        className="flex-none flex flex-col border-r border-border bg-bg overflow-hidden transition-[width] duration-200"
        style={{ width: collapsed ? 60 : 224 }}
      >
        <div className="flex items-center gap-2.5 px-3.5 pt-4 pb-3.5 min-w-0">
          <Link
            to="/app"
            title="Today"
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
          {visibleNavGroups(can, featureOn).map((grp, gi) => (
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
                    aria-current={active ? "page" : undefined}
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
        <header className="h-[52px] flex-none flex items-center gap-2.5 px-4 border-b border-border bg-surface">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 w-[290px] max-w-[28vw] px-2.5 py-1.5 border border-border rounded-md bg-bg-content text-muted-2 text-[12.5px] hover:border-border-strong"
          >
            <Icon name="search" size={14} />
            <span className="flex-1 text-left truncate">Search or do anything…</span>
            <span className="font-mono text-[10.5px] border border-border rounded-sm px-1.5 py-px bg-surface">
              ⌘K
            </span>
          </button>

          {/*
           * Book is always present in the shell. The palette is faster once you
           * know it exists, but the product has to be fast on day one, not day
           * ninety — so the highest-frequency task gets a permanent affordance.
           */}
          <button
            onClick={() => openBooking()}
            disabled={!canBook}
            title={canBook ? "Book an appointment" : `Booking is available to ${rolesFor("appointment:create")}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary-tint-border bg-primary-tint text-primary text-[12.5px] font-semibold hover:bg-primary-tint-border disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-tint"
          >
            <Icon name="schedule" size={13} />
            Book
          </button>

          <div className="flex-1" />

          <div className="text-[12.5px] text-muted flex items-center gap-2 max-lg:hidden">
            <span className="font-semibold text-ink">{TODAY_LABEL}</span>
            <span className="text-border-strong">·</span>
            <span>{clinicConfig.branch}</span>
          </div>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeMenus();
                setNotifOpen((o) => !o);
              }}
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
                closeMenus();
                setPlusOpen((o) => !o);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-on-primary text-[12.5px] font-semibold hover:bg-primary-hover"
            >
              <Icon name="plus" size={13} strokeWidth={1.6} />
              Create
            </button>
            {plusOpen && (
              <div className="absolute right-0 top-10 z-[60] w-[190px] bg-surface border border-border rounded-lg shadow-dropdown p-[5px] animate-dc-pop">
                {createItems.map((pi) => {
                  const allowed = can(pi.perm);
                  return (
                    <button
                      key={pi.key}
                      disabled={!allowed}
                      title={allowed ? undefined : `Available to ${rolesFor(pi.perm)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlusOpen(false);
                        pi.run();
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-[7px] text-[12.5px] hover:bg-bg disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <span className="font-medium">{pi.label}</span>
                      <span className="font-mono text-[10px] text-muted-2">{pi.key}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/*
           * Who is signed in. In production the role comes from the server's
           * RBAC claim and is not switchable here — this menu exists so each
           * console persona and its root screen can be seen side by side.
           */}
          <div className="relative">
            <button
              title={`${user.name} — ${user.roleLabel}`}
              onClick={(e) => {
                e.stopPropagation();
                closeMenus();
                setWhoOpen((o) => !o);
              }}
              className="w-[30px] h-[30px] rounded-full bg-primary-tint text-primary grid place-items-center text-[11.5px] font-bold border border-primary-tint-border"
            >
              {user.initials}
            </button>
            {whoOpen && (
              <div className="absolute right-0 top-10 z-[60] w-[236px] bg-surface border border-border rounded-lg shadow-dropdown p-[5px] animate-dc-pop">
                {/* The real signed-in user (from the server's RBAC claim). */}
                <div className="px-2.5 pt-2 pb-2">
                  <div className="text-[12.5px] font-semibold truncate">{user.name}</div>
                  <div className="text-[10.5px] text-muted-2 truncate">
                    {user.roleLabel}
                    {isOverride && " · preview"}
                  </div>
                </div>

                {/* Dev-only persona preview — never present in a production build. */}
                {import.meta.env.DEV && (
                  <div className="border-t border-border-faint mt-1 pt-1">
                    <div className="px-2.5 pt-1 pb-1 text-[10px] font-bold tracking-[0.07em] text-muted-2">
                      PREVIEW AS · DEV
                    </div>
                    {DEMO_USERS.map((u) => (
                      <button
                        key={u.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setWhoOpen(false);
                          setUserId(u.id);
                          navigate("/app");
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-[7px] text-left",
                          isOverride && u.id === user.id ? "bg-primary-tint" : "hover:bg-bg",
                        )}
                      >
                        <span className="w-[22px] h-[22px] rounded-full bg-bg text-muted grid place-items-center text-[9.5px] font-bold border border-border">
                          {u.initials}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-medium truncate">{u.name}</span>
                          <span className="block text-[10px] text-muted-2 truncate">{u.roleLabel}</span>
                        </span>
                        {isOverride && u.id === user.id && <span className="text-[11px] text-primary">✓</span>}
                      </button>
                    ))}
                    {isOverride && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setWhoOpen(false); setUserId(null); navigate("/app"); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-[7px] text-[11.5px] text-muted hover:bg-bg"
                      >
                        ← Back to signed-in user
                      </button>
                    )}
                  </div>
                )}

                <div className="border-t border-border-faint mt-1 pt-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setWhoOpen(false); navigate("/app/settings/profile"); }}
                    className="w-full text-left px-2.5 py-2 rounded-[7px] text-[12.5px] font-medium hover:bg-bg"
                  >
                    Settings
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleSignOut(); }}
                    className="w-full text-left px-2.5 py-2 rounded-[7px] text-[12.5px] font-medium text-danger hover:bg-danger-bg"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main id="main" className="flex-1 overflow-y-auto px-6 pt-5 pb-10">
          <Outlet />
        </main>
      </div>

      {/* Overlays — the console's non-navigating surfaces */}
      <CommandPalette />
      <BookingBar />
      <SettleSheet />
      <PatientPreviewDrawer />
      <ParkedTasks />
      <ToastHost />
    </div>
  );
}
