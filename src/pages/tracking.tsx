import { useMemo, useRef, useState } from "react";
import { Hourglass, Package, RefreshCw, Route, Square } from "lucide-react";
import { useCentral } from "@/app/central-context";
import { Alert, Empty, STATUS_ICON, Spinner, cx } from "@/components/ui";
import { STALE_DAYS, shipmentStatus, shortName } from "@/services/freight/analytics";
import { daysBetween, fmtAgo, fmtDateTime, fmtNumber } from "@/services/freight/format";
import { STATUS_LABEL } from "@/services/freight/status";
import type { FreightStatus, Shipment } from "@/services/freight/types";

const COLUMNS: { status: FreightStatus; title: string; hint: string }[] = [
  { status: "S", title: "Aguardando coleta", hint: "Envio solicitado, sem movimentação ainda" },
  { status: "T", title: "Em trânsito", hint: "Coletado e a caminho do destino" },
  { status: "P", title: "Problema", hint: "Falha na entrega, devolução ou extravio" },
  { status: "E", title: "Entregues no período", hint: "Últimas entregas confirmadas" },
];

export function TrackingPage() {
  const { view, source, openOrder, notify, reload } = useCentral();
  const [run, setRun] = useState<{ done: number; total: number; errors: number } | null>(null);
  const stop = useRef(false);

  const groups = useMemo(() => {
    const map = new Map<FreightStatus, Shipment[]>();
    if (!view) return map;
    const inPeriod = (d: Date | null) => !!d && d >= view.from && d < view.to;
    for (const s of view.allShipments) {
      const st = shipmentStatus(s);
      if (!st) continue;
      const show = st === "E" ? inPeriod(s.situationWhen ?? s.when) : st === "X" ? false : !s.finished || inPeriod(s.when);
      if (!show) continue;
      const list = map.get(st) || [];
      list.push(s);
      map.set(st, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (b.situationWhen ?? b.when ?? new Date(0)).getTime() - (a.situationWhen ?? a.when ?? new Date(0)).getTime());
    }
    return map;
  }, [view]);

  if (!view) return null;
  const open = view.open;

  const refreshAll = async () => {
    stop.current = false;
    const ids = Array.from(new Set(open.map((s) => s.orderId ?? s.invoiceId ?? 0).filter(Boolean)));
    let errors = 0;
    setRun({ done: 0, total: ids.length, errors: 0 });
    for (let i = 0; i < ids.length; i++) {
      if (stop.current) break;
      try {
        const r = await source.track(ids[i]);
        if (!r.ok) errors++;
      } catch {
        errors++;
      }
      setRun({ done: i + 1, total: ids.length, errors });
    }
    setRun(null);
    notify(errors ? "error" : "success", errors ? `Rastreio atualizado com ${errors} falha(s) de ${ids.length}.` : `Rastreio de ${ids.length} pedido(s) atualizado.`);
    reload();
  };

  const now = new Date();

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[13px] text-muted">
          {fmtNumber(open.length)} envio(s) em acompanhamento. O módulo atualiza o rastreio sozinho pela ação agendada; aqui você
          força a consulta agora na transportadora.
        </p>
        {run ? (
          <div className="flex items-center gap-3">
            <Spinner />
            <span className="text-[13px] font-bold">
              Consultando {run.done} de {run.total}…
            </span>
            <div className="h-2 w-40 overflow-hidden rounded bg-[#e5e5e5]">
              <div className="h-full bg-snk-green transition-[width]" style={{ width: `${(run.done / Math.max(1, run.total)) * 100}%` }} />
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => (stop.current = true)}>
              <Square size={12} /> Parar
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary" onClick={refreshAll} disabled={!open.length}>
            <RefreshCw size={14} /> Atualizar rastreio de todos ({open.length})
          </button>
        )}
      </div>
      {source.sample && (
        <Alert kind="info">Fora do Sankhya a consulta é simulada; dentro dele, cada pedido chama a ação RASTREAR do botão Cotar frete.</Alert>
      )}
      <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: "repeat(4, minmax(240px, 1fr))" }}>
        {COLUMNS.map((col) => {
          const list = groups.get(col.status) || [];
          const Icon = STATUS_ICON[col.status];
          return (
            <section key={col.status} className="panel flex min-h-0 flex-col">
              <header className="panel-head">
                <h2 className="panel-title m-0" title={col.hint}>
                  <Icon size={16} className={col.status === "P" ? "!text-status-critical" : col.status === "E" ? "!text-snk-green-dark" : undefined} aria-hidden />
                  {col.title}
                </h2>
                <span className="rounded-full bg-white px-2 text-xs font-bold leading-5 text-muted">{list.length}</span>
              </header>
              <div className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto bg-[#f7f7f7] p-2">
                {list.length === 0 && <Empty icon={Package} title="Nenhum envio" />}
                {list.slice(0, 60).map((s) => {
                  const last = s.situationWhen ?? s.when;
                  const stale = !s.finished && last && daysBetween(last, now) > STALE_DAYS && col.status !== "E";
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => openOrder(s.orderId ?? s.invoiceId ?? 0, "route")}
                      className={cx(
                        "panel w-full p-3 text-left transition-shadow hover:shadow-md",
                        col.status === "P" && "border-l-4 border-l-status-critical"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-bold">{s.customer ?? "—"}</span>
                          <span className="block text-xs text-muted">
                            NF {s.invoiceNumber ?? "—"} · {s.city ?? "—"}/{s.state ?? "—"}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted" title={`Enviado em ${fmtDateTime(s.when)}`}>
                          {s.when ? `${Math.max(0, Math.floor(daysBetween(s.when, s.finished && s.situationWhen ? s.situationWhen : now)))} d` : ""}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-xs">
                        <Route size={12} className="shrink-0 text-muted" aria-hidden />
                        <span className="truncate" title={s.situation ?? undefined}>
                          {s.situation ?? STATUS_LABEL[col.status]}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted">
                        <span>
                          {s.waybills.length} caixa(s) · {shortName(s.carrierName)}
                        </span>
                        <span className={cx(stale && "font-bold text-[#c77700]")} title={fmtDateTime(last)}>
                          {stale && <Hourglass size={11} className="mr-0.5 inline" aria-hidden />}
                          {fmtAgo(last)}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {list.length > 60 && <p className="m-0 p-2 text-center text-xs text-muted">+{list.length - 60} na tela Envios</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
