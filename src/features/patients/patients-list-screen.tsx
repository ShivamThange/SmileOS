import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type Column } from "@/components/common/data-table";
import { Avatar } from "@/components/ui/avatar";
import { MoneyText } from "@/components/common/money-text";
import { Button } from "@/components/ui/button";
import { PhoneLink } from "@/components/common/phone-link";
import { useDeskStore } from "@/hooks/use-desk-store";
import { clinicConfig } from "@/config/clinic";
import { fmtDate } from "@/lib/format";
import { usePatientsList } from "./queries";
import type { PatientListRow, PatientListParams } from "./api";

/*
 * Patients list (T2.2) — server-driven. Pagination, sort and search all live in
 * the URL, so a filtered list is linkable and the back button restores it. The
 * search box is debounced into the `search` param; changing any filter resets to
 * page 1. The list is the record shell everything else opens from.
 */

const PAGE_SIZE = 25;

/** Compact "52 M" from whatever age/sex data the record carries. */
function ageSex(p: PatientListRow): string {
  let age: number | undefined = p.ageFallback;
  if (p.dob) {
    const d = new Date(p.dob);
    if (!Number.isNaN(d.getTime())) age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  }
  const sex = p.gender ? p.gender[0].toUpperCase() : "";
  return [age != null ? String(age) : "", sex].filter(Boolean).join(" ") || "—";
}

export function PatientsListScreen() {
  const navigate = useNavigate();
  const { openBooking } = useDeskStore();
  const [params, setParams] = useSearchParams();

  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const search = params.get("search") ?? "";
  const sort = params.get("sort") ?? "createdAt";
  const order = (params.get("order") as "asc" | "desc") ?? "desc";

  // Debounce the search box into the URL so we don't query on every keystroke.
  const [draft, setDraft] = useState(search);
  useEffect(() => setDraft(search), [search]);
  useEffect(() => {
    if (draft === search) return;
    const t = setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (draft.trim()) next.set("search", draft.trim());
        else next.delete("search");
        next.delete("page"); // a new search starts at page 1
        return next;
      });
    }, 300);
    return () => clearTimeout(t);
  }, [draft, search, setParams]);

  const query: PatientListParams = { page, limit: PAGE_SIZE, sort, order, search: search || undefined };
  const { data, isLoading, isError, isPlaceholderData } = usePatientsList(query);
  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const setSort = (field: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      const sameField = (prev.get("sort") ?? "createdAt") === field;
      next.set("sort", field);
      next.set("order", sameField && (prev.get("order") ?? "desc") === "desc" ? "asc" : "desc");
      next.delete("page");
      return next;
    });

  const goToPage = (p: number) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(p));
      return next;
    });

  const columns: Column<PatientListRow>[] = [
    {
      key: "name",
      header: "PATIENT",
      width: "1.7fr",
      sortKey: "firstName",
      render: (p) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={p.name} size={30} />
          <div className="min-w-0">
            <div className="font-semibold truncate">{p.name}</div>
            <div className="text-[11px] text-muted-2 font-mono">{p.patientNumber}</div>
          </div>
        </div>
      ),
    },
    { key: "agesex", header: "AGE / SEX", width: "0.7fr", render: (p) => <span className="text-muted">{ageSex(p)}</span> },
    {
      key: "phone",
      header: "PHONE",
      width: "1.2fr",
      render: (p) => <PhoneLink phone={p.phone} message={`Hello ${p.name}, this is ${clinicConfig.name}.`} />,
    },
    {
      key: "lastVisit",
      header: "LAST VISIT",
      width: "1fr",
      sortKey: "lastVisit",
      render: (p) => <span className="text-muted">{p.lastVisit ? fmtDate(p.lastVisit) : "—"}</span>,
    },
    {
      key: "balance",
      header: "BALANCE",
      width: "0.8fr",
      align: "right",
      sortKey: "balancePaise",
      render: (p) =>
        p.balancePaise ? <MoneyText paise={p.balancePaise} className="font-semibold text-danger" /> : <span className="text-muted-2">Nil</span>,
    },
  ];

  const total = pagination?.total ?? rows.length;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = (page - 1) * PAGE_SIZE + rows.length;

  return (
    <div className="max-w-[1240px] mx-auto flex flex-col gap-3.5">
      <PageHeader
        title="Patients"
        subtitle={pagination ? `${total.toLocaleString("en-IN")} records` : "Patient records"}
        aside={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => openBooking()}>Book</Button>
            <Button variant="primary" onClick={() => navigate("/app/patients/new")}>＋ New patient</Button>
          </div>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        loading={isLoading || isPlaceholderData}
        sort={{ field: sort, order }}
        onSort={setSort}
        onRowClick={(p) => navigate(`/app/patients/${p.id}`)}
        toolbar={
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by name, number or phone…"
            className="w-full max-w-[360px] text-[12.5px] px-3 py-1.5 border border-border rounded-md bg-bg-content outline-none focus:border-border-strong"
          />
        }
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <span className={isPlaceholderData ? "opacity-60" : ""}>
              {isError ? "Couldn't load patients." : total === 0 ? "No patients" : `Showing ${from}–${to} of ${total.toLocaleString("en-IN")}`}
            </span>
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button disabled={!pagination.hasPrev} onClick={() => goToPage(page - 1)} className="px-2.5 py-1 rounded-md border border-border text-[12px] disabled:opacity-40 disabled:cursor-not-allowed hover:border-border-strong">Prev</button>
                <span className="text-[12px] text-muted-2 tabular-nums px-1">{page} / {pagination.totalPages}</span>
                <button disabled={!pagination.hasNext} onClick={() => goToPage(page + 1)} className="px-2.5 py-1 rounded-md border border-border text-[12px] disabled:opacity-40 disabled:cursor-not-allowed hover:border-border-strong">Next</button>
              </div>
            )}
          </div>
        }
        empty={{
          icon: "patients",
          title: search ? "No patients match" : "No patients yet",
          body: search
            ? "Nothing here for that name, number or phone. If they're calling now, book them straight in — the record gets created on confirm."
            : "Add your first patient, or book someone in — the record is created on confirm.",
          cta: search ? "Book them in" : "New patient",
          onCta: () => (search ? openBooking({ phone: /^\d/.test(search.trim()) ? search.trim() : "" }) : navigate("/app/patients/new")),
        }}
      />
    </div>
  );
}
