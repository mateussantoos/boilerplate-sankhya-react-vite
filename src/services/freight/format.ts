/** Formatação pt-BR usada em toda a central. */

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function fmtMoney(v: number | null | undefined, compact = false): string {
  if (v == null || Number.isNaN(v)) {
    return "—";
  }
  return compact && Math.abs(v) >= 10000 ? compactMoney.format(v) : money.format(v);
}

export function fmtNumber(v: number | null | undefined, decimals = 0): string {
  if (v == null || Number.isNaN(v)) {
    return "—";
  }
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Até `max` casas, sem zeros à direita: 125.790 → "125,79". */
export function fmtDecimal(v: number | null | undefined, max = 2): string {
  if (v == null || Number.isNaN(v)) {
    return "—";
  }
  return v.toLocaleString("pt-BR", { maximumFractionDigits: max });
}

export function fmtKg(v: number | null | undefined): string {
  return v == null ? "—" : `${fmtDecimal(v, 2)} kg`;
}

/** cm³ → "0,618 m³". */
export function fmtM3(cm3: number | null | undefined): string {
  return cm3 == null ? "—" : `${fmtNumber(cm3 / 1_000_000, 3)} m³`;
}

export function fmtDays(v: number | null | undefined): string {
  if (v == null) {
    return "—";
  }
  return `${fmtDecimal(v, 1)} ${v === 1 ? "dia" : "dias"}`;
}

export function fmtPercent(v: number | null | undefined, decimals = 0): string {
  return v == null || Number.isNaN(v) ? "—" : `${fmtNumber(v * 100, decimals)}%`;
}

export function fmtDate(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("pt-BR") : "—";
}

export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) {
    return "—";
  }
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** "há 3 h", "há 2 dias", "agora". */
export function fmtAgo(d: Date | null | undefined, now = new Date()): string {
  if (!d) {
    return "—";
  }
  const min = Math.round((now.getTime() - d.getTime()) / 60000);
  if (min < 1) {
    return "agora";
  }
  if (min < 60) {
    return `há ${min} min`;
  }
  const h = Math.round(min / 60);
  if (h < 24) {
    return `há ${h} h`;
  }
  const days = Math.round(h / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export function fmtZip(z: string | null | undefined): string {
  const d = String(z || "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : z || "—";
}

export function fmtCnpj(doc: string | null | undefined): string {
  const d = String(doc || "").replace(/\D/g, "");
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return doc || "—";
}

/** "yyyy-mm-dd hh:mi:ss" (SQL Server, CONVERT 120) ou "dd/mm/yyyy hh:mi" → Date. */
export function parseDate(v: unknown): Date | null {
  if (v == null || v === "") {
    return null;
  }
  if (v instanceof Date) {
    return v;
  }
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  m = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) {
    return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** yyyy-mm-dd de uma data local. */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86400000;
}

export function num(v: unknown): number | null {
  if (v == null || v === "") {
    return null;
  }
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export function text(v: unknown): string | null {
  if (v == null) {
    return null;
  }
  const s = String(v).trim();
  return s ? s : null;
}
