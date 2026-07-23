import { describe, it, expect } from "vitest";
import { ROLE_PERMISSIONS, effectivePermissions, SENSITIVE_ACTIONS } from "./rbac";

/*
 * The RBAC matrix decides who can do what across the whole app; a wrong grant is
 * a security bug. These pin the load-bearing boundaries — a receptionist must
 * not reach full clinical notes or financial exports, the owner reaches
 * everything, and explicit grants/denials override the role baseline.
 */

describe("ROLE_PERMISSIONS baselines", () => {
  it("owner can do everything, including audit-log export", () => {
    expect(ROLE_PERMISSIONS.owner.has("audit_log:export")).toBe(true);
    expect(ROLE_PERMISSIONS.owner.has("patient:delete")).toBe(true);
  });

  it("receptionist has patients + appointments but not full clinical notes or financial exports", () => {
    expect(ROLE_PERMISSIONS.receptionist.has("patient:read")).toBe(true);
    expect(ROLE_PERMISSIONS.receptionist.has("appointment:create")).toBe(true);
    expect(ROLE_PERMISSIONS.receptionist.has("clinical_note:create")).toBe(false);
    expect(ROLE_PERMISSIONS.receptionist.has("chart:update")).toBe(false);
    expect(ROLE_PERMISSIONS.receptionist.has("invoice:export")).toBe(false);
  });

  it("doctor has full clinical + plan approval but not billing creation or settings", () => {
    expect(ROLE_PERMISSIONS.doctor.has("chart:update")).toBe(true);
    expect(ROLE_PERMISSIONS.doctor.has("treatment_plan:approve")).toBe(true);
    expect(ROLE_PERMISSIONS.doctor.has("invoice:create")).toBe(false);
    expect(ROLE_PERMISSIONS.doctor.has("settings:update")).toBe(false);
  });

  it("accountant has financial exports but no clinical access", () => {
    expect(ROLE_PERMISSIONS.accountant.has("payment:export")).toBe(true);
    expect(ROLE_PERMISSIONS.accountant.has("invoice:export")).toBe(true);
    expect(ROLE_PERMISSIONS.accountant.has("chart:read")).toBe(false);
  });

  it("admin is broad but cannot delete or export the audit log", () => {
    expect(ROLE_PERMISSIONS.admin.has("patient:delete")).toBe(true);
    expect(ROLE_PERMISSIONS.admin.has("audit_log:delete")).toBe(false);
    expect(ROLE_PERMISSIONS.admin.has("audit_log:export")).toBe(false);
  });
});

describe("effectivePermissions — grants and denials override the baseline", () => {
  it("adds explicit grants on top of the role", () => {
    const set = effectivePermissions("assistant", ["invoice:create"]);
    expect(set.has("invoice:create")).toBe(true);
    expect(set.has("patient:read")).toBe(true); // still has the baseline
  });
  it("removes explicit denials even from an owner", () => {
    const set = effectivePermissions("owner", [], ["patient:delete"]);
    expect(set.has("patient:delete")).toBe(false);
    expect(set.has("patient:read")).toBe(true);
  });
  it("does not mutate the shared role set", () => {
    effectivePermissions("receptionist", ["chart:update"]);
    expect(ROLE_PERMISSIONS.receptionist.has("chart:update")).toBe(false);
  });
});

describe("SENSITIVE_ACTIONS", () => {
  it("flags the actions that require re-auth", () => {
    expect(SENSITIVE_ACTIONS).toContain("patient:delete");
    expect(SENSITIVE_ACTIONS).toContain("refund:approve");
    expect(SENSITIVE_ACTIONS).toContain("settings:update");
  });
});
