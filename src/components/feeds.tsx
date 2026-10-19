import { AlertTriangle, Ban, Calculator, CircleAlert, Clock, Hourglass, Send, Truck, type LucideIcon } from "lucide-react";
import { useCentral } from "@/app/central-context";
import { ATTENTION_LABEL, type Activity, type Attention, type AttentionKind } from "@/services/freight/analytics";
import { fmtAgo, fmtDateTime } from "@/services/freight/format";
import { STATUS_ICON, cx } from "./ui";

export const ATTENTION_ICON: Record<AttentionKind, { icon: LucideIcon; color: string }> = {
  problem: { icon: AlertTriangle, color: "text-status-critical" },
  refused: { icon: Ban, color: "text-status-critical" },
  stale: { icon: Hourglass, color: "text-[#c77700]" },
  quoteError: { icon: CircleAlert, color: "text-[#c77700]" },
  idle: { icon: Clock, color: "text-muted" },
};

/** Lista de pendências: ícone + tipo + registro + motivo; clique abre o pedido. */
export function AttentionList({ items, limit, compact }: { items: Attention[]; limit?: number; compact?: boolean }) {
  const { openOrder } = useCentral();
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <ul className="m-0 list-none divide-y divide-line p-0">
      {shown.map((a, i) => {
        const { icon: Icon, color } = ATTENTION_ICON[a.kind];
        return (
          <li key={`${a.kind}-${a.orderId}-${i}`}>
            <button
              type="button"
              onClick={() => a.orderId && openOrder(a.orderId, a.shipment ? "route" : a.quote ? "quotes" : "summary")}
              className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-[#f6faf6]"
            >
              <Icon size={16} className={cx("mt-0.5 shrink-0", color)} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-muted">{ATTENTION_LABEL[a.kind]}</span>
                <span className="block truncate font-bold">{a.title}</span>
                {!compact && <span className="block text-[13px] text-[#555]">{a.detail}</span>}
                {compact && <span className="block truncate text-xs text-[#555]">{a.detail}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted" title={fmtDateTime(a.when)}>
                {fmtAgo(a.when)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const ACTIVITY_ICON: Record<Activity["kind"], { icon: LucideIcon; color: string }> = {
  quote: { icon: Calculator, color: "bg-[#e3eefb] text-series-1" },
  quoteError: { icon: CircleAlert, color: "bg-[#f9e3e3] text-status-critical" },
  shipment: { icon: Send, color: "bg-snk-green-soft text-snk-green-dark" },
  refused: { icon: Ban, color: "bg-[#f9e3e3] text-status-critical" },
  cancelled: { icon: Ban, color: "bg-[#ececec] text-[#555]" },
  tracking: { icon: Truck, color: "bg-[#fdf1dc] text-[#b26a00]" },
};

/** Linha do tempo das últimas cotações, envios e atualizações de rastreio. */
export function ActivityFeed({ items }: { items: Activity[] }) {
  const { openOrder } = useCentral();
  return (
    <ol className="m-0 list-none p-0">
      {items.map((a, i) => {
        const meta = ACTIVITY_ICON[a.kind];
        const Icon = a.kind === "tracking" && a.status ? STATUS_ICON[a.status] : meta.icon;
        const color = a.kind === "tracking" && a.status === "E" ? "bg-snk-green-soft text-snk-green-dark" : a.kind === "tracking" && a.status === "P" ? "bg-[#f9e3e3] text-status-critical" : meta.color;
        return (
          <li key={i} className="relative">
            {i < items.length - 1 && <span className="absolute bottom-0 left-[27px] top-9 w-px bg-line" aria-hidden />}
            <button
              type="button"
              onClick={() => a.orderId && openOrder(a.orderId, a.kind === "tracking" ? "route" : a.kind.startsWith("quote") ? "quotes" : "shipment")}
              className="flex w-full items-start gap-3 px-4 py-2 text-left hover:bg-[#f6faf6]"
            >
              <span className={cx("relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", color)}>
                <Icon size={13} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold">{a.title}</span>
                <span className="block truncate text-xs text-[#666]">{a.detail}</span>
              </span>
              <span className="shrink-0 pt-0.5 text-xs text-muted" title={fmtDateTime(a.when)}>
                {fmtAgo(a.when)}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
