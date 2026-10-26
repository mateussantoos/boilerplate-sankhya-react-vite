import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Braces,
  Calculator,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  ListOrdered,
  Package,
  Printer,
  RefreshCw,
  Route,
  Send,
  X,
} from "lucide-react";
import { useCentral, type DrawerTab } from "@/app/central-context";
import { sankhyaService } from "@/services/sankhya";
import { shipmentStatus, shortName } from "@/services/freight/analytics";
import { boxTotal, boxVolumeCm3, describeBoxes, isLarge, parseBoxes } from "@/services/freight/boxes";
import { fmtDate, fmtDateTime, fmtDays, fmtDecimal, fmtKg, fmtM3, fmtMoney, fmtNumber, fmtZip } from "@/services/freight/format";
import { downloadPdf, labelsA4, labelsFileName } from "@/services/freight/labels";
import type { BoxType, OrderDetail, Quote, TrackingReply } from "@/services/freight/types";
import { JsonViewer } from "./json-viewer";
import { Milestones, RouteHeader, Timeline, groupBoxes } from "./route-view";
import { Alert, Badge, EnvBadge, Empty, Field, Modal, Spinner, StatusBadge, Tabs, cx } from "./ui";

/** Tela do pedido no Sankhya (Central de Notas), aberta com a chave NUNOTA. */
const ORDER_SCREEN = "br.com.sankhya.com.mov.CentralNotas";

export function OrderDrawer() {
  const { drawer, closeOrder, openOrder, source, data, view, notify, reload } = useCentral();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<{ reply: TrackingReply; at: Date } | null>(null);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [json, setJson] = useState<{ kind: "quote" | "shipment"; id: number } | null>(null);
  const [requoting, setRequoting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OrderDetail["shipments"][number] | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const orderId = drawer?.orderId ?? null;
  const tab = drawer?.tab ?? "summary";
  const setTab = (t: DrawerTab) => orderId && openOrder(orderId, t);

  useEffect(() => {
    if (!orderId || !data) return;
    let alive = true;
    setDetail(null);
    setError(null);
    setTracking(null);
    source
      .loadOrderDetail(orderId, data.setup)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : (e as any)?.statusMessage || String(e)));
    return () => {
      alive = false;
    };
  }, [orderId, source, data]);

  const shipment = detail?.shipments.find((s) => s.ok) ?? null;

  const track = useCallback(async () => {
    if (!orderId) return;
    setTrackingBusy(true);
    try {
      const reply = await source.track(orderId);
      setTracking({ reply, at: new Date() });
      if (!reply.ok && reply.message) notify("error", reply.message);
    } finally {
      setTrackingBusy(false);
    }
  }, [orderId, source, notify]);

  /* Trajeto: consulta a transportadora na primeira vez que a aba abre. */
  useEffect(() => {
    if (tab === "route" && shipment && !tracking && !trackingBusy) {
      track();
    }
  }, [tab, shipment, tracking, trackingBusy, track]);

  useEffect(() => {
    if (!orderId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !json && closeOrder();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [orderId, json, closeOrder]);

  if (!orderId) return null;
  const o = detail?.order;
  const status = (o && view?.statusByOrder.get(o.id)) ?? o?.status ?? (shipment ? shipmentStatus(shipment) : null);

  /* Cancelamento pelo botão do módulo (ACAO=CANCELAR): a Anjun só aceita antes da coleta. */
  const cancelShipment = async () => {
    setCancelTarget(null);
    setCancelling(true);
    try {
      const r = await source.cancel(orderId);
      notify(r.ok ? "success" : "error", r.message || (r.ok ? "Envio cancelado." : "O cancelamento falhou."));
      if (r.ok) {
        reload();
      }
    } finally {
      setCancelling(false);
    }
  };

  const requote = async (q: Quote) => {
    if (!q.carrierId || !q.boxes || !q.weightKg) return;
    if (!window.confirm(`Cotar de novo o ${o?.kind.toLowerCase() ?? "pedido"} ${orderId} na ${shortName(q.carrierName)} com as mesmas caixas (${q.boxCount}) e o mesmo peso (${fmtKg(q.weightKg)})?`)) return;
    setRequoting(true);
    try {
      const r = await source.requote(orderId, q.carrierId, q.boxes, q.weightKg);
      if (r.ok) {
        notify("success", `Nova cotação: ${fmtMoney(r.fee)} em ${fmtDays(r.days)}.`);
        reload();
      } else {
        notify("error", r.message || "A cotação falhou.");
      }
    } finally {
      setRequoting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && closeOrder()}>
      <aside
        className="flex h-full w-[min(780px,calc(100vw-48px))] flex-col bg-page shadow-[-8px_0_30px_rgba(0,0,0,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label={`Pedido ${orderId}`}
      >
        <header className="shrink-0 border-b border-edge bg-white px-5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="m-0 text-lg font-bold">
                  {o?.kind ?? "Registro"} {orderId}
                </h2>
                {o && <StatusBadge status={status} />}
                {shipment?.invoiceNumber && <Badge tone="outline">NF-e {shipment.invoiceNumber}{shipment.invoiceSeries ? `/${shipment.invoiceSeries}` : ""}</Badge>}
              </div>
              <div className="mt-0.5 truncate text-[13px] text-muted">
                {o ? `${o.customer ?? "—"} · ${o.city ?? "—"}/${o.state ?? "—"}` : "Carregando…"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={source.sample}
                title={source.sample ? "Disponível dentro do Sankhya" : "Abrir na Central de Notas"}
                onClick={() => sankhyaService.openApp(ORDER_SCREEN, { NUNOTA: orderId })}
              >
                <ExternalLink size={13} /> Abrir no Sankhya
              </button>
              <button type="button" className="btn btn-ghost btn-icon" onClick={closeOrder} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="mt-2">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "summary", label: "Resumo", icon: ClipboardList },
                { value: "route", label: "Trajeto", icon: Route },
                { value: "quotes", label: "Cotações", icon: Calculator, count: detail?.quotes.length },
                { value: "shipment", label: "Envio", icon: Send, count: detail?.shipments.length },
                { value: "items", label: "Itens", icon: ListOrdered, count: detail?.items.length },
              ]}
            />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error && <Alert kind="error">{error}</Alert>}
          {!detail && !error && (
            <div className="flex items-center gap-2 py-10 text-muted">
              <Spinner /> Carregando o pedido…
            </div>
          )}
          {detail && tab === "summary" && <Summary detail={detail} boxes={data?.boxes ?? []} />}
          {detail && tab === "route" && (
            <RouteTab detail={detail} tracking={tracking} busy={trackingBusy} onTrack={track} hasShipment={!!shipment} />
          )}
          {detail && tab === "quotes" && (
            <QuotesTab detail={detail} boxes={data?.boxes ?? []} onJson={(id) => setJson({ kind: "quote", id })} onRequote={requote} requoting={requoting} />
          )}
          {detail && tab === "shipment" && (
            <ShipmentTab
              detail={detail}
              boxes={data?.boxes ?? []}
              onJson={(id) => setJson({ kind: "shipment", id })}
              notify={notify}
              onCancel={setCancelTarget}
              cancelling={cancelling}
            />
          )}
          {detail && tab === "items" && <ItemsTab detail={detail} />}
        </div>
      </aside>
      {json && <JsonViewer kind={json.kind} id={json.id} onClose={() => setJson(null)} />}
      {cancelTarget && (
        <Modal title="Cancelar envio" onClose={() => setCancelTarget(null)} width={520}>
          <p className="m-0 text-[13px] leading-relaxed">
            O envio <b>{cancelTarget.carrierOrder ?? cancelTarget.customerNumber}</b> da NF-e{" "}
            <b>
              {cancelTarget.invoiceNumber ?? "—"}
              {cancelTarget.invoiceSeries ? `/${cancelTarget.invoiceSeries}` : ""}
            </b>{" "}
            ({cancelTarget.waybills.length} etiqueta(s)) será cancelado na {shortName(cancelTarget.carrierName)}.
          </p>
          <Alert kind="warning" className="mt-3">
            Só é possível <b>antes da coleta</b>; depois dela, fale com a transportadora. As etiquetas impressas deixam de valer e o
            pedido volta a poder ser cotado e enviado.
          </Alert>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setCancelTarget(null)}>
              Voltar
            </button>
            <button type="button" className="btn btn-danger" onClick={cancelShipment}>
              <X size={14} /> Confirmar cancelamento
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ resumo */

function Summary({ detail, boxes }: { detail: OrderDetail; boxes: BoxType[] }) {
  const o = detail.order;
  const lastOk = detail.quotes.find((q) => q.ok);
  const shipment = detail.shipments.find((s) => s.ok);
  const boxesText = shipment?.boxes ?? lastOk?.boxes ?? null;
  const groups = parseBoxes(boxesText);
  return (
    <div className="flex flex-col gap-4">
      <RouteHeader
        origin={detail.origin}
        destination={detail.destination}
        customer={o.customer}
        carrier={shortName(shipment?.carrierName ?? o.carrierName ?? lastOk?.carrierName)}
      />
      <section className="panel p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Field label="Data">{fmtDate(o.date)}</Field>
          <Field label="Vendedor">{o.seller ?? "—"}</Field>
          <Field label="Valor">{fmtMoney(o.value)}</Field>
          <Field label="Peso bruto">{fmtKg(o.grossWeightKg)}</Field>
          <Field label="Frete cotado">{fmtMoney(o.fee ?? lastOk?.fee)}</Field>
          <Field label="Prazo cotado">{fmtDays(o.days ?? lastOk?.days)}</Field>
          <Field label="Cotado por">
            {o.quotedBy ?? lastOk?.user ?? "—"}
            <span className="block text-xs font-normal text-muted">{fmtDateTime(o.quotedAt ?? lastOk?.when)}</span>
          </Field>
          <Field label="Transportadora">{shortName(o.carrierName ?? lastOk?.carrierName)}</Field>
          <Field label="Situação do rastreio">
            {o.situation ?? shipment?.situation ?? "—"}
            <span className="block text-xs font-normal text-muted">{fmtDateTime(o.situationWhen ?? shipment?.situationWhen)}</span>
          </Field>
          <Field label="Códigos de rastreio">
            <span className="font-mono text-xs">{(shipment?.waybills.length ? shipment.waybills.slice(0, 4).join(", ") + (shipment.waybills.length > 4 ? ` +${shipment.waybills.length - 4}` : "") : o.tracking) ?? "—"}</span>
          </Field>
          <Field label="Pedido na transportadora">{shipment?.carrierOrder ?? "—"}</Field>
          <Field label="Empresa">{o.company ?? "—"}</Field>
        </div>
      </section>
      <section className="panel">
        <header className="panel-head">
          <h3 className="panel-title m-0">
            <Package size={16} aria-hidden /> Caixas {shipment ? "do envio" : "da última cotação"}
          </h3>
          {groups.length > 0 && (
            <span className="text-xs text-muted">
              {boxTotal(groups)} volume(s) · {fmtM3(boxVolumeCm3(groups))} · {isLarge(groups) ? "grande porte" : "pequeno porte"}
            </span>
          )}
        </header>
        {groups.length ? <BoxesTable groups={groups} boxes={boxes} /> : <Empty icon={Package} title="Sem caixas informadas" />}
      </section>
    </div>
  );
}

function BoxesTable({ groups, boxes }: { groups: ReturnType<typeof parseBoxes>; boxes: BoxType[] }) {
  return (
    <table className="grid-table">
      <thead>
        <tr>
          <th>Caixa</th>
          <th className="num">Qtd.</th>
          <th>C × L × A (cm)</th>
          <th className="num">Volume</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g, i) => (
          <tr key={i}>
            <td>
              <b>{g.code != null ? boxes.find((b) => b.id === g.code)?.name ?? `Caixa ${g.code}` : "Avulsa"}</b>
            </td>
            <td className="num">{g.quantity}</td>
            <td>
              {fmtDecimal(g.lengthCm, 1)} × {fmtDecimal(g.widthCm, 1)} × {fmtDecimal(g.heightCm, 1)}
            </td>
            <td className="num">{fmtM3(g.quantity * g.lengthCm * g.widthCm * g.heightCm)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ trajeto */

function RouteTab({
  detail,
  tracking,
  busy,
  onTrack,
  hasShipment,
}: {
  detail: OrderDetail;
  tracking: { reply: TrackingReply; at: Date } | null;
  busy: boolean;
  onTrack: () => void;
  hasShipment: boolean;
}) {
  const shipment = detail.shipments.find((s) => s.ok);
  const groups = useMemo(() => (tracking ? groupBoxes(tracking.reply.boxes) : []), [tracking]);
  if (!hasShipment) {
    const cancelled = detail.shipments.find((s) => s.cancelled);
    if (cancelled) {
      return (
        <Empty icon={Route} title="Envio cancelado">
          {cancelNote(cancelled.message) ?? `O envio ${cancelled.carrierOrder ?? ""} foi cancelado.`} O pedido pode ser cotado e
          enviado de novo pelo pop-up Cotar frete.
        </Empty>
      );
    }
    return (
      <Empty icon={Route} title="Ainda sem envio">
        O trajeto aparece depois que o envio é solicitado no pop-up Cotar frete (Solicitar envio).
      </Empty>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <RouteHeader origin={detail.origin} destination={detail.destination} customer={detail.order.customer} carrier={shortName(shipment?.carrierName)} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-muted">
          {busy
            ? "Consultando a transportadora…"
            : tracking
              ? `Consultado na transportadora em ${fmtDateTime(tracking.at)}`
              : `Situação gravada: ${shipment?.situation ?? "Envio solicitado"} (${fmtDateTime(shipment?.situationWhen ?? shipment?.when)})`}
        </span>
        <button type="button" className="btn btn-primary btn-sm" onClick={onTrack} disabled={busy}>
          {busy ? <Spinner size={13} className="text-white" /> : <RefreshCw size={13} />} Consultar agora
        </button>
      </div>
      {tracking && !tracking.reply.ok && tracking.reply.message && <Alert kind="error">{tracking.reply.message}</Alert>}
      {busy && !tracking && (
        <div className="flex items-center gap-2 py-6 text-muted">
          <Spinner /> Buscando o trajeto de cada caixa…
        </div>
      )}
      {groups.map((g, i) => (
        <section key={i} className="panel">
          <header className="panel-head flex-wrap">
            <h3 className="panel-title m-0 min-w-0">
              <Package size={16} aria-hidden />
              {g.boxes.length === 1 ? `Caixa ${g.sample.waybill}` : `${g.boxes.length} caixas com o mesmo trajeto`}
            </h3>
            <StatusBadge status={g.sample.status} />
          </header>
          <div className="p-4">
            <div className={cx("mb-3 text-[13px] font-bold", (g.sample.status === "P" || g.sample.status === "X") && "text-[#a94442]")}>{g.sample.label}</div>
            <Milestones box={g.sample} />
            <div className="mt-5">
              <Timeline box={g.sample} />
            </div>
            {g.boxes.length > 1 && (
              <details className="mt-3 text-xs text-muted">
                <summary className="cursor-pointer select-none font-bold">Códigos de rastreio ({g.boxes.length})</summary>
                <div className="mt-1.5 font-mono leading-relaxed">{g.boxes.map((b) => b.waybill).join(", ")}</div>
              </details>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ cotações */

function QuotesTab({
  detail,
  boxes,
  onJson,
  onRequote,
  requoting,
}: {
  detail: OrderDetail;
  boxes: BoxType[];
  onJson: (id: number) => void;
  onRequote: (q: Quote) => void;
  requoting: boolean;
}) {
  const lastOk = detail.quotes.find((q) => q.ok && q.boxes && q.weightKg && q.carrierId);
  if (!detail.quotes.length) {
    return <Empty icon={Calculator} title="Sem cotações gravadas" />;
  }
  return (
    <div className="flex flex-col gap-3">
      {lastOk && !detail.shipments.some((s) => s.ok) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-line bg-white px-4 py-3">
          <div className="text-[13px]">
            <b>Recotar com as mesmas caixas</b>
            <div className="text-xs text-muted">
              {describeBoxes(parseBoxes(lastOk.boxes), boxes)} · {fmtKg(lastOk.weightKg)} · {shortName(lastOk.carrierName)}
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onRequote(lastOk)} disabled={requoting}>
            {requoting ? <Spinner size={13} className="text-white" /> : <RefreshCw size={13} />} Recotar
          </button>
        </div>
      )}
      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Transportadora</th>
                <th>Resultado</th>
                <th className="num">Frete</th>
                <th className="num">Prazo</th>
                <th className="num">Peso / cobrado</th>
                <th>Caixas</th>
                <th>Usuário</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {detail.quotes.map((q) => (
                <tr key={q.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(q.when)}</td>
                  <td>
                    {shortName(q.carrierName)}
                    <div className="mt-0.5">
                      <EnvBadge env={q.environment} />
                    </div>
                  </td>
                  <td className="max-w-[200px]">
                    {q.ok ? (
                      <Badge tone="green">OK</Badge>
                    ) : (
                      <>
                        <Badge tone="red">Erro{q.httpStatus ? ` ${q.httpStatus}` : ""}</Badge>
                        <div className="mt-1 text-xs text-[#a94442]">{q.message}</div>
                      </>
                    )}
                  </td>
                  <td className="num font-bold">{fmtMoney(q.fee)}</td>
                  <td className="num">{fmtDays(q.days)}</td>
                  <td className="num">
                    {fmtKg(q.weightKg)}
                    <div className="text-xs text-muted">{fmtKg(q.chargedWeightKg)}</div>
                  </td>
                  <td className="max-w-[180px]">
                    <b>{q.boxCount ?? "—"}</b>
                    <div className="truncate text-xs text-muted" title={q.boxes ?? undefined}>
                      {describeBoxes(parseBoxes(q.boxes), boxes) || "—"}
                    </div>
                  </td>
                  <td>{q.user ?? "—"}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onJson(q.id)} title="JSON trocado">
                      <Braces size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="m-0 text-xs text-muted">
        CEP de origem {fmtZip(detail.quotes[0].originZip)} → destino {fmtZip(detail.quotes[0].destinationZip)} · valor declarado{" "}
        {fmtMoney(detail.quotes[0].declaredValue)} · volume {fmtM3(detail.quotes[0].volumeCm3)}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ envio */

/** "… | Cancelado na transportadora em 19/10/2026 10:30 por MATEUS" → o trecho do cancelamento. */
function cancelNote(message: string | null): string | null {
  const m = /Cancelado na transportadora em .*$/.exec(message ?? "");
  return m ? m[0] : null;
}

function ShipmentTab({
  detail,
  boxes,
  onJson,
  notify,
  onCancel,
  cancelling,
}: {
  detail: OrderDetail;
  boxes: BoxType[];
  onJson: (id: number) => void;
  notify: (kind: "success" | "error" | "info", text: string) => void;
  onCancel: (s: OrderDetail["shipments"][number]) => void;
  cancelling: boolean;
}) {
  const [printing, setPrinting] = useState<number | null>(null);
  if (!detail.shipments.length) {
    return (
      <Empty icon={Send} title="Envio ainda não solicitado">
        Solicite o envio no Portal, pelo botão Cotar frete (etapa Cotação e envio).
      </Empty>
    );
  }
  const copy = (text: string) =>
    navigator.clipboard?.writeText(text).then(
      () => notify("success", "Copiado."),
      () => notify("error", "Não foi possível copiar.")
    );
  const printA4 = async (s: OrderDetail["shipments"][number]) => {
    setPrinting(s.id);
    try {
      const r = await labelsA4(s.labels.filter(Boolean));
      downloadPdf(r.bytes, labelsFileName(s.carrierOrder, s.id));
      notify(
        "success",
        `Etiquetas em A4: ${r.labels} ${r.labels === 1 ? "etiqueta" : "etiquetas"} em ${r.pages} ${r.pages === 1 ? "folha" : "folhas"}. Imprima em tamanho real (100%).`
      );
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    } finally {
      setPrinting(null);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      {detail.shipments.map((s) => (
        <section key={s.id} className="panel">
          <header className="panel-head flex-wrap">
            <h3 className="panel-title m-0">
              <Send size={16} aria-hidden /> Envio nº {s.id} · {fmtDateTime(s.when)}
            </h3>
            <div className="flex items-center gap-1.5">
              <EnvBadge env={s.environment} />
              {s.ok || s.cancelled ? <StatusBadge status={shipmentStatus(s)} /> : <Badge tone="red">Recusado</Badge>}
            </div>
          </header>
          <div className="p-4">
            {s.cancelled && (
              <Alert kind="info" className="mb-3">
                <b>Envio cancelado.</b> {cancelNote(s.message) ? `${cancelNote(s.message)}.` : `Cancelado em ${fmtDateTime(s.situationWhen)}.`} As etiquetas
                deste envio não valem mais.
              </Alert>
            )}
            {s.ok && shipmentStatus(s) === "S" && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-line bg-[#fafafa] px-3 py-2.5">
                <span className="text-[13px] text-[#555]">
                  Solicitado por engano? Dá para cancelar na transportadora <b>antes da coleta</b>.
                </span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => onCancel(s)} disabled={cancelling}>
                  {cancelling ? <Spinner size={13} /> : <X size={13} />} Cancelar envio
                </button>
              </div>
            )}
            {!s.ok && !s.cancelled && (
              <Alert kind="error" className="mb-3">
                {s.message ?? "A transportadora recusou o envio."}
                {s.httpStatus ? ` (HTTP ${s.httpStatus})` : ""}
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Field label="Pedido na transportadora">{s.carrierOrder ?? "—"}</Field>
              <Field label="Referência enviada">{s.customerNumber ?? "—"}</Field>
              <Field label="NF-e">
                {s.invoiceNumber ?? "—"}
                {s.invoiceSeries ? `/${s.invoiceSeries}` : ""}
                <span className="block text-xs font-normal text-muted">Nº único {s.invoiceId ?? "—"}</span>
              </Field>
              <Field label="Solicitado por">{s.user ?? "—"}</Field>
              <Field label="Caixas">{fmtNumber(s.boxCount)}</Field>
              <Field label="Peso">{fmtKg(s.weightKg)}</Field>
              <Field label="Frete cotado">{fmtMoney(s.fee)}</Field>
              <Field label="Situação">
                {s.situation ?? (s.ok ? "Envio solicitado" : "—")}
                <span className="block text-xs font-normal text-muted">{fmtDateTime(s.situationWhen)}</span>
              </Field>
            </div>
            {s.boxes && (
              <p className="mb-0 mt-3 text-xs text-muted">
                Caixas: {describeBoxes(parseBoxes(s.boxes), boxes)} · <span className="font-mono">{s.boxes}</span>
              </p>
            )}
            {s.waybills.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <b className="text-[13px]">Etiquetas e códigos de rastreio ({s.waybills.length})</b>
                  <div className="flex flex-wrap gap-2">
                    {!s.cancelled && s.labels.some(Boolean) && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={printing === s.id}
                        title="Todas as etiquetas num PDF, 4 por folha A4"
                        onClick={() => printA4(s)}
                      >
                        {printing === s.id ? <Spinner /> : <Printer size={12} />} Etiquetas em A4
                      </button>
                    )}
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(s.waybills.join(", "))}>
                      <Copy size={12} /> Copiar códigos
                    </button>
                  </div>
                </div>
                <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
                  {s.waybills.map((w, i) => (
                    <li key={w} className="flex items-center justify-between gap-2 rounded-[3px] border border-line bg-white px-2.5 py-1.5">
                      <span className="min-w-0">
                        <span className="text-xs text-muted">Caixa {i + 1}</span>
                        <span className="block truncate font-mono text-xs">{w}</span>
                      </span>
                      {s.cancelled ? (
                        <span className="text-xs text-muted">cancelada</span>
                      ) : s.labels[i] ? (
                        <a className="btn btn-ghost btn-sm" href={s.labels[i]} target="_blank" rel="noopener noreferrer" title="Abrir a etiqueta (PDF)">
                          <FileText size={13} /> Etiqueta
                        </a>
                      ) : (
                        <span className="text-xs text-muted">sem etiqueta</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onJson(s.id)}>
                <Braces size={13} /> JSON do envio
              </button>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ itens */

function ItemsTab({ detail }: { detail: OrderDetail }) {
  if (!detail.items.length) {
    return <Empty icon={ListOrdered} title="Sem itens" />;
  }
  const total = detail.items.reduce((a, i) => a + (i.total ?? 0), 0);
  const weight = detail.items.reduce((a, i) => a + (i.grossWeightKg ?? 0) * i.quantity, 0);
  return (
    <section className="panel overflow-hidden">
      <table className="grid-table">
        <thead>
          <tr>
            <th className="num">Seq.</th>
            <th>Produto</th>
            <th className="num">Qtd.</th>
            <th className="num">Unitário</th>
            <th className="num">Total</th>
            <th className="num">Peso bruto</th>
          </tr>
        </thead>
        <tbody>
          {detail.items.map((i) => (
            <tr key={i.sequence}>
              <td className="num">{i.sequence}</td>
              <td>
                <b>{i.description}</b>
                <div className="text-xs text-muted">Cód. {i.productId}</div>
              </td>
              <td className="num">
                {fmtDecimal(i.quantity, 3)} {i.unit ?? ""}
              </td>
              <td className="num">{fmtMoney(i.unitPrice)}</td>
              <td className="num font-bold">{fmtMoney(i.total)}</td>
              <td className="num">{i.grossWeightKg != null ? fmtKg(i.grossWeightKg * i.quantity) : "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="border-t border-[#ccc] text-right font-bold">
              Total
            </td>
            <td className="num border-t border-[#ccc] font-bold">{fmtMoney(total)}</td>
            <td className="num border-t border-[#ccc] font-bold">{fmtKg(weight)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
