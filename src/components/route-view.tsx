import { Check, MapPin, Warehouse, X } from "lucide-react";
import { MILESTONES, isProblemEvent, reachedMilestone } from "@/services/freight/status";
import { fmtZip, parseDate, fmtDateTime } from "@/services/freight/format";
import type { Address, BoxTracking } from "@/services/freight/types";
import { cx } from "./ui";

/** Origem → destino, com a transportadora no meio. */
export function RouteHeader({
  origin,
  destination,
  customer,
  carrier,
}: {
  origin: Address & { company: string | null };
  destination: Address;
  customer: string | null;
  carrier: string | null;
}) {
  const line = (a: Address) =>
    [a.street && `${a.street}${a.number ? `, ${a.number}` : ""}`, a.district].filter(Boolean).join(" · ") || "—";
  return (
    <div className="grid items-stretch gap-0 rounded-[3px] border border-line bg-white sm:grid-cols-[1fr_auto_1fr]">
      <div className="p-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
          <Warehouse size={13} aria-hidden /> Origem
        </div>
        <div className="mt-1 font-bold">{origin.company ?? "—"}</div>
        <div className="text-xs text-[#555]">{line(origin)}</div>
        <div className="text-xs text-[#555]">
          {origin.city ?? "—"}/{origin.state ?? "—"} · CEP {fmtZip(origin.zip)}
        </div>
      </div>
      <div className="hidden flex-col items-center justify-center px-2 text-xs text-muted sm:flex">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-snk-green" />
          <span className="h-px w-16 bg-[repeating-linear-gradient(90deg,#bbb_0_6px,transparent_6px_10px)]" />
          <span className="h-2 w-2 rounded-full border-2 border-snk-green bg-white" />
        </div>
        <div className="mt-1 max-w-[120px] truncate text-center">{carrier ?? ""}</div>
      </div>
      <div className="border-t border-line p-3 sm:border-l sm:border-t-0">
        <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
          <MapPin size={13} aria-hidden /> Destino
        </div>
        <div className="mt-1 font-bold">{customer ?? "—"}</div>
        <div className="text-xs text-[#555]">{line(destination)}</div>
        <div className="text-xs text-[#555]">
          {destination.city ?? "—"}/{destination.state ?? "—"} · CEP {fmtZip(destination.zip)}
        </div>
      </div>
    </div>
  );
}

/** Marcos do trajeto: solicitado → coletado → em trânsito → agência → saiu para entrega → entregue. */
export function Milestones({ box }: { box: BoxTracking }) {
  const reached = reachedMilestone(box.events);
  const failed = box.status === "P" || box.status === "X";
  return (
    <ol className="m-0 grid list-none p-0" style={{ gridTemplateColumns: `repeat(${MILESTONES.length}, minmax(0, 1fr))` }}>
      {MILESTONES.map((m, i) => {
        const done = i <= reached;
        const stopHere = failed && i === reached + 1;
        return (
          <li key={m.key} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span
                className={cx("absolute right-1/2 top-[11px] h-[3px] w-full", i <= reached ? "bg-snk-green" : "bg-[#e3e3e3]")}
                aria-hidden
              />
            )}
            <span
              className={cx(
                "relative z-[1] flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold",
                stopHere
                  ? "border-status-critical bg-status-critical text-white"
                  : done
                    ? "border-snk-green bg-snk-green text-white"
                    : "border-[#d5d5d5] bg-white text-[#aaa]"
              )}
            >
              {stopHere ? <X size={12} strokeWidth={3} /> : done ? <Check size={12} strokeWidth={3} /> : i + 1}
            </span>
            <span className={cx("mt-1 px-0.5 text-[11px] leading-tight", done ? "font-bold text-ink" : "text-muted", stopHere && "font-bold text-status-critical")}>
              {m.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Eventos de uma caixa, mais recentes primeiro. */
export function Timeline({ box }: { box: BoxTracking }) {
  if (!box.events.length) {
    return <p className="m-0 text-[13px] text-muted">Sem movimentação ainda: a transportadora ainda não registrou a coleta.</p>;
  }
  return (
    <ol className="m-0 list-none p-0">
      {box.events.map((e, i) => {
        const problem = isProblemEvent(e);
        return (
          <li key={i} className="relative pb-3 pl-6 last:pb-0">
            {i < box.events.length - 1 && <span className="absolute bottom-0 left-[7px] top-4 w-px bg-line" aria-hidden />}
            <span
              className={cx(
                "absolute left-[3px] top-[5px] h-[9px] w-[9px] rounded-full",
                problem ? "bg-status-critical" : i === 0 ? "bg-snk-green" : "bg-[#c4c4c4]"
              )}
              aria-hidden
            />
            <div className={cx("text-[13px] font-bold", problem && "text-[#a94442]")}>{e.label}</div>
            {e.problem && <div className="text-[13px] text-[#a94442]">{e.problem}</div>}
            <div className="text-xs text-muted">
              {fmtDateTime(parseDate(e.when))}
              {e.place ? ` · ${e.place}` : ""}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Caixas com o mesmo trajeto ficam juntas: "16 caixas · AJ1…01, AJ1…02 …". */
export function groupBoxes(boxes: BoxTracking[]): { boxes: BoxTracking[]; sample: BoxTracking }[] {
  const map = new Map<string, BoxTracking[]>();
  for (const b of boxes) {
    const sig = JSON.stringify(b.events.map((e) => [e.when, e.label, e.place, e.problem]));
    const list = map.get(sig) || [];
    list.push(b);
    map.set(sig, list);
  }
  return [...map.values()].map((list) => ({ boxes: list, sample: list[0] }));
}
