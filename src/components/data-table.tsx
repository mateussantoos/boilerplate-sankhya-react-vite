import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Empty, cx } from "./ui";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Valor para ordenar; sem ele a coluna não ordena. */
  sort?: (row: T) => string | number | Date | null | undefined;
  /** Texto na exportação CSV; sem ele a coluna não é exportada. */
  csv?: (row: T) => string | number | null | undefined;
  align?: "left" | "right" | "center";
  width?: number | string;
}

/** Grade no padrão do Sankhya: cabeçalho fixo, linhas zebradas, ordenação e páginas de 50. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  selectedKey,
  defaultSort,
  pageSize = 50,
  empty,
  exportName,
  toolbar,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  selectedKey?: string | number | null;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
  empty?: ReactNode;
  exportName?: string;
  toolbar?: ReactNode;
}) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    const dir = sort!.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const na = va instanceof Date ? va.getTime() : va;
      const nb = vb instanceof Date ? vb.getTime() : vb;
      if (typeof na === "number" && typeof nb === "number") return (na - nb) * dir;
      return String(na).localeCompare(String(nb), "pt-BR") * dir;
    });
  }, [rows, columns, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page >= pages) setPage(0);
  }, [page, pages]);
  const shown = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (c: Column<T>) => {
    if (!c.sort) return;
    setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "desc" }));
  };

  const exportCsv = () => {
    const cols = columns.filter((c) => c.csv);
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      cols.map((c) => esc(typeof c.header === "string" ? c.header : c.key)).join(";"),
      ...sorted.map((r) => cols.map((c) => esc(c.csv!(r))).join(";")),
    ];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportName ?? "central-frete"}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="flex min-h-0 flex-col">
      {(toolbar || exportName) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          {exportName && (
            <button type="button" className="btn btn-outline btn-sm" onClick={exportCsv} disabled={!rows.length}>
              <Download size={13} /> Exportar CSV
            </button>
          )}
        </div>
      )}
      {rows.length === 0 ? (
        empty ?? <Empty title="Nenhum registro" />
      ) : (
        <div className="min-h-0 overflow-auto">
          <table className="grid-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    style={{ width: c.width, textAlign: c.align }}
                    className={cx(c.sort && "cursor-pointer select-none hover:bg-[#f0f0f0]")}
                    onClick={() => toggleSort(c)}
                    aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    <span className={cx("inline-flex items-center gap-1", c.align === "right" && "flex-row-reverse")}>
                      {c.header}
                      {sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const key = rowKey(r);
                return (
                  <tr
                    key={key}
                    className={cx(onRowClick && "is-clickable", selectedKey != null && selectedKey === key && "is-selected")}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                  >
                    {columns.map((c) => (
                      <td key={c.key} style={{ textAlign: c.align }} className={cx(c.align === "right" && "num")}>
                        {c.render(r)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-muted">
          <span>
            {sorted.length > pageSize
              ? `${page * pageSize + 1}–${Math.min(sorted.length, (page + 1) * pageSize)} de ${sorted.length}`
              : `${sorted.length} registro${sorted.length === 1 ? "" : "s"}`}
          </span>
          {pages > 1 && (
            <span className="flex items-center gap-1">
              <button type="button" className="btn btn-ghost btn-sm btn-icon" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior">
                <ChevronLeft size={14} />
              </button>
              <span className="px-1">
                {page + 1} / {pages}
              </span>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Próxima página">
                <ChevronRight size={14} />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Campo de busca com ícone, para a barra das grades. */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      className="field h-7 w-[260px] text-xs"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
    />
  );
}

/** Busca sem acento e sem caixa. */
export function matches(needle: string, ...hay: (string | number | null | undefined)[]): boolean {
  const n = norm(needle);
  if (!n) return true;
  return hay.some((h) => h != null && norm(String(h)).includes(n));
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
