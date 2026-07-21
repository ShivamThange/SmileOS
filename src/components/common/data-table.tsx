import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import type { IconName } from "@/components/ui/icon";

/*
 * DataTable — the single most-used console composite. Server-driven in
 * production (sort/filter/paginate emit upward); here it renders a provided
 * row array. Uses CSS grid so column widths use the fr/px sizing the design
 * relies on. Highly-bespoke tables (recovery worklist) are hand-built with
 * the same tokens; this covers the many list screens.
 */

export interface Column<T> {
  key: string;
  header: string;
  /** grid-template width, e.g. "1.5fr" | "120px". Defaults to "1fr". */
  width?: string;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /**
   * Every empty list must end in the one thing to do instead. A list that
   * simply stops is the most common reason a screen feels broken.
   */
  empty?: { icon?: IconName; title: string; body: string; cta?: string; onCta?: () => void };
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  /** Accessible name for the table region. */
  label?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  toolbar,
  footer,
  label,
}: DataTableProps<T>) {
  const template = columns.map((c) => c.width ?? "1fr").join(" ");
  const alignCls = (a?: Column<T>["align"]) =>
    a === "right" ? "text-right justify-end" : a === "center" ? "text-center justify-center" : "text-left";

  return (
    <div
      role="table"
      aria-label={label}
      aria-rowcount={rows.length}
      className="bg-surface border border-border rounded-lg overflow-hidden"
    >
      {toolbar && <div className="px-3.5 py-2.5 border-b border-border">{toolbar}</div>}

      <div
        role="row"
        className="grid gap-2.5 items-center px-3.5 py-2.5 border-b border-border bg-bg-content text-[10.5px] font-bold tracking-[0.06em] text-muted-2"
        style={{ gridTemplateColumns: template }}
      >
        {columns.map((c) => (
          <span key={c.key} className={cn(alignCls(c.align))}>
            {c.header}
          </span>
        ))}
      </div>

      {rows.length === 0 && empty ? (
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          body={empty.body}
          cta={empty.cta}
          onCta={empty.onCta}
        />
      ) : (
        rows.map((row) => (
          /*
           * Rows are focusable and Enter-activatable. A receptionist tabbing
           * through a table with a phone wedged under her chin should never
           * need the mouse to open a record.
           */
          <div
            key={rowKey(row)}
            role="row"
            data-row
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={
              onRowClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }
                : undefined
            }
            className={cn(
              "grid gap-2.5 items-center px-3.5 py-2.5 border-b border-border-faint text-[12.5px] outline-none",
              onRowClick && "cursor-pointer hover:bg-bg-content",
            )}
            style={{ gridTemplateColumns: template }}
          >
            {columns.map((c) => (
              <div key={c.key} role="cell" className={cn("min-w-0", alignCls(c.align))}>
                {c.render(row)}
              </div>
            ))}
          </div>
        ))
      )}

      {footer && <div className="px-3.5 py-2.5 text-[12px] text-muted">{footer}</div>}
    </div>
  );
}
