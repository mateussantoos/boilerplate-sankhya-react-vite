import { boxTotal, parseBoxes } from "./boxes";
import { addDays, daysBetween, isoDay } from "./format";
import type { BoxType, Carrier, Dataset, Filters, FreightStatus, Order, Quote, Shipment } from "./types";

/**
 * Tudo o que as telas mostram sai daqui, a partir do conjunto carregado e dos filtros: nenhuma
 * tela consulta o banco por conta própria (só o detalhe do pedido).
 */

/** Sem atualização do rastreio há mais que isto (dias): pede atenção. */
export const STALE_DAYS = 3;
/** Cotado e sem envio há mais que isto (dias): pede atenção. */
export const QUOTED_IDLE_DAYS = 5;

/** Código de situação da transportadora → situação do frete (TrackingCodes.toFreightStatus). */
export function statusFromCode(code: string | null | undefined): FreightStatus {
  const c = (code || "").trim().toLowerCase();
  if (!c) {
    return "S";
  }
  if (c === "signed") {
    return "E";
  }
  if (c === "cancelled") {
    return "X";
  }
  if (c.endsWith("_failed") || c.startsWith("return") || c.startsWith("back_")) {
    return "P";
  }
  return "T";
}

/** Situação de um envio: a gravada no pedido, senão a do último código de rastreio. Recusado: null. */
export function shipmentStatus(s: Shipment): FreightStatus | null {
  if (s.cancelled) {
    return "X";
  }
  if (!s.ok) {
    return null;
  }
  if (s.status && s.status !== "C") {
    return s.status;
  }
  return statusFromCode(s.situationCode);
}

export interface View {
  filters: Filters;
  from: Date;
  /** Fim exclusivo (dia seguinte ao "até"). */
  to: Date;
  quotes: Quote[];
  /** Envios solicitados no período (OK e recusados). */
  shipments: Shipment[];
  /** Envios OK ainda em acompanhamento, de qualquer data (até 90 dias). */
  open: Shipment[];
  /** Todos os envios carregados que passam nos filtros de transportadora e ambiente. */
  allShipments: Shipment[];
  orders: Order[];
  boxes: BoxType[];
  carriers: Carrier[];
  /** Último envio OK por registro (pedido de origem e nota). */
  shipmentByOrder: Map<number, Shipment>;
  /** Cotações por registro, mais recente primeiro. */
  quotesByOrder: Map<number, Quote[]>;
  /** Situação efetiva de cada registro. */
  statusByOrder: Map<number, FreightStatus | null>;
}

export function buildView(data: Dataset, filters: Filters): View {
  const from = new Date(`${filters.from}T00:00:00`);
  const to = addDays(new Date(`${filters.to}T00:00:00`), 1);
  const inRange = (d: Date | null) => !!d && d >= from && d < to;
  const carrierOk = (id: number | null) => filters.carrier === "all" || String(id) === filters.carrier;
  const envOk = (e: string | null) => filters.environment === "all" || e === filters.environment;

  const quotes = data.quotes.filter((q) => carrierOk(q.carrierId) && envOk(q.environment) && inRange(q.when));
  const allShipments = data.shipments.filter((s) => carrierOk(s.carrierId) && envOk(s.environment));
  const shipments = allShipments.filter((s) => inRange(s.when));
  const open = allShipments.filter((s) => s.ok && !s.finished);

  const shipmentByOrder = new Map<number, Shipment>();
  for (const s of [...allShipments].reverse()) {
    if (s.ok) {
      if (s.orderId) shipmentByOrder.set(s.orderId, s);
      if (s.invoiceId) shipmentByOrder.set(s.invoiceId, s);
    }
  }
  const quotesByOrder = new Map<number, Quote[]>();
  for (const q of quotes) {
    const list = quotesByOrder.get(q.orderId) || [];
    list.push(q);
    quotesByOrder.set(q.orderId, list);
  }

  const ids = new Set<number>([...quotes.map((q) => q.orderId), ...allShipments.map((s) => s.orderId ?? 0)]);
  const orders = data.orders.filter((o) => ids.has(o.id));

  const statusByOrder = new Map<number, FreightStatus | null>();
  for (const o of orders) {
    const s = shipmentByOrder.get(o.id);
    const fromShipment = s ? shipmentStatus(s) : null;
    const quoted = (quotesByOrder.get(o.id) || []).some((q) => q.ok) ? "C" : null;
    statusByOrder.set(o.id, o.status ?? fromShipment ?? quoted);
  }

  return {
    filters,
    from,
    to,
    quotes,
    shipments,
    open,
    allShipments,
    orders,
    boxes: data.boxes,
    carriers: data.carriers,
    shipmentByOrder,
    quotesByOrder,
    statusByOrder,
  };
}

/* ------------------------------------------------------------------ indicadores */

export interface Kpis {
  quotedOrders: number;
  quotes: number;
  quoteErrors: number;
  errorRate: number | null;
  shipments: number;
  refused: number;
  cancelled: number;
  inTransit: number;
  requested: number;
  delivered: number;
  problems: number;
  feeTotal: number;
  feeAverage: number | null;
  daysAverage: number | null;
  deliveryDaysAverage: number | null;
  onTimeRate: number | null;
  boxesShipped: number;
  weightShipped: number;
}

export function kpis(v: View): Kpis {
  const okQuotes = v.quotes.filter((q) => q.ok);
  const lastOkByOrder = new Map<number, Quote>();
  for (const q of okQuotes) {
    if (!lastOkByOrder.has(q.orderId)) {
      lastOkByOrder.set(q.orderId, q);
    }
  }
  const fees = [...lastOkByOrder.values()].map((q) => q.fee ?? 0);
  const days = [...lastOkByOrder.values()].filter((q) => q.days != null).map((q) => q.days!);
  const okShipments = v.shipments.filter((s) => s.ok);
  const delivered = okShipments.filter((s) => shipmentStatus(s) === "E");
  const deliveryDays = delivered
    .filter((s) => s.when && s.situationWhen)
    .map((s) => ({ took: daysBetween(s.when!, s.situationWhen!), promised: s.days }));
  const withPromise = deliveryDays.filter((d) => d.promised != null);
  return {
    quotedOrders: lastOkByOrder.size,
    quotes: v.quotes.length,
    quoteErrors: v.quotes.length - okQuotes.length,
    errorRate: v.quotes.length ? (v.quotes.length - okQuotes.length) / v.quotes.length : null,
    shipments: okShipments.length,
    refused: v.shipments.filter((s) => !s.ok && !s.cancelled).length,
    cancelled: v.shipments.filter((s) => s.cancelled).length,
    requested: v.open.filter((s) => shipmentStatus(s) === "S").length,
    inTransit: v.open.filter((s) => shipmentStatus(s) === "T").length,
    delivered: delivered.length,
    problems: v.allShipments.filter((s) => shipmentStatus(s) === "P" && (!s.finished || inPeriod(v, s.when))).length,
    feeTotal: fees.reduce((a, b) => a + b, 0),
    feeAverage: fees.length ? fees.reduce((a, b) => a + b, 0) / fees.length : null,
    daysAverage: days.length ? days.reduce((a, b) => a + b, 0) / days.length : null,
    deliveryDaysAverage: deliveryDays.length
      ? deliveryDays.reduce((a, d) => a + d.took, 0) / deliveryDays.length
      : null,
    onTimeRate: withPromise.length
      ? withPromise.filter((d) => d.took <= (d.promised as number) + 0.5).length / withPromise.length
      : null,
    boxesShipped: okShipments.reduce((a, s) => a + (s.boxCount ?? s.waybills.length), 0),
    weightShipped: okShipments.reduce((a, s) => a + (s.weightKg ?? 0), 0),
  };
}

function inPeriod(v: View, d: Date | null): boolean {
  return !!d && d >= v.from && d < v.to;
}

/* ------------------------------------------------------------------ séries */

export interface DayPoint {
  day: string;
  date: Date;
  quotes: number;
  shipments: number;
  fee: number;
}

/** Uma linha por dia do período: cotações, envios OK e frete cotado (cotações OK). */
export function daily(v: View): DayPoint[] {
  const map = new Map<string, DayPoint>();
  for (let d = new Date(v.from); d < v.to; d = addDays(d, 1)) {
    map.set(isoDay(d), { day: isoDay(d), date: new Date(d), quotes: 0, shipments: 0, fee: 0 });
  }
  for (const q of v.quotes) {
    const p = q.when && map.get(isoDay(q.when));
    if (p) {
      p.quotes++;
      p.fee += q.ok ? q.fee ?? 0 : 0;
    }
  }
  for (const s of v.shipments) {
    const p = s.ok && s.when && map.get(isoDay(s.when));
    if (p) {
      p.shipments++;
    }
  }
  return [...map.values()];
}

export interface Ranked {
  key: string;
  label: string;
  value: number;
  count: number;
}

/** Frete cotado (última cotação OK de cada registro) por UF de destino. */
export function feeByState(v: View): Ranked[] {
  const seen = new Set<number>();
  const map = new Map<string, Ranked>();
  for (const q of v.quotes) {
    if (!q.ok || seen.has(q.orderId)) {
      continue;
    }
    seen.add(q.orderId);
    const key = q.state || "—";
    const r = map.get(key) || { key, label: key, value: 0, count: 0 };
    r.value += q.fee ?? 0;
    r.count++;
    map.set(key, r);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

/** Clientes com mais envios no período (frete somado das cotações). */
export function topCustomers(v: View): Ranked[] {
  const map = new Map<string, Ranked>();
  for (const s of v.shipments) {
    if (!s.ok) continue;
    const key = String(s.customerId ?? s.customer ?? "—");
    const r = map.get(key) || {
      key,
      label: `${s.customer ?? "—"}${s.state ? ` · ${s.city ?? ""}/${s.state}` : ""}`,
      value: 0,
      count: 0,
    };
    r.value += s.fee ?? 0;
    r.count++;
    map.set(key, r);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.value - a.value);
}

/** Registros por situação, na ordem do fluxo. */
export function statusCounts(v: View): Map<FreightStatus | "none", number> {
  const out = new Map<FreightStatus | "none", number>();
  for (const o of v.orders) {
    const s = v.statusByOrder.get(o.id) ?? "none";
    out.set(s, (out.get(s) || 0) + 1);
  }
  return out;
}

/* ------------------------------------------------------------------ pendências */

export type AttentionKind = "problem" | "stale" | "refused" | "idle" | "quoteError";

export interface Attention {
  kind: AttentionKind;
  orderId: number;
  title: string;
  detail: string;
  when: Date | null;
  shipment?: Shipment;
  quote?: Quote;
}

export const ATTENTION_LABEL: Record<AttentionKind, string> = {
  problem: "Problema na entrega",
  stale: `Rastreio parado há mais de ${STALE_DAYS} dias`,
  refused: "Envio recusado pela transportadora",
  idle: `Cotado e sem envio há mais de ${QUOTED_IDLE_DAYS} dias`,
  quoteError: "Cotação com erro (sem cotação OK depois)",
};

export function attention(v: View, now = new Date()): Attention[] {
  const out: Attention[] = [];
  const shippedOrders = new Set<number>(
    v.allShipments.filter((s) => s.ok).flatMap((s) => [s.orderId ?? 0, s.invoiceId ?? 0])
  );
  for (const s of v.allShipments) {
    const st = shipmentStatus(s);
    const orderId = s.orderId ?? s.invoiceId ?? 0;
    if (st === "P" && (!s.finished || inPeriod(v, s.when))) {
      out.push({
        kind: "problem",
        orderId,
        title: `${s.customer ?? "—"} · NF ${s.invoiceNumber ?? "—"}`,
        detail: s.situation || "Problema na entrega",
        when: s.situationWhen ?? s.when,
        shipment: s,
      });
    } else if (s.ok && !s.finished && (st === "S" || st === "T")) {
      const last = s.situationWhen ?? s.when;
      if (last && daysBetween(last, now) > STALE_DAYS) {
        out.push({
          kind: "stale",
          orderId,
          title: `${s.customer ?? "—"} · NF ${s.invoiceNumber ?? "—"}`,
          detail: `${s.situation || "Envio solicitado"} · sem novidade há ${Math.floor(daysBetween(last, now))} dias`,
          when: last,
          shipment: s,
        });
      }
    }
  }
  for (const s of v.shipments) {
    if (!s.ok && !s.cancelled && !shippedOrders.has(s.orderId ?? 0)) {
      out.push({
        kind: "refused",
        orderId: s.orderId ?? s.invoiceId ?? 0,
        title: `${s.customer ?? "—"} · NF ${s.invoiceNumber ?? "—"}`,
        detail: s.message || "Envio recusado",
        when: s.when,
        shipment: s,
      });
    }
  }
  for (const o of v.orders) {
    const quotes = v.quotesByOrder.get(o.id) || [];
    const lastOk = quotes.find((q) => q.ok);
    if (lastOk && !shippedOrders.has(o.id) && lastOk.when && daysBetween(lastOk.when, now) > QUOTED_IDLE_DAYS) {
      out.push({
        kind: "idle",
        orderId: o.id,
        title: `${o.kind} ${o.id} · ${o.customer ?? "—"}`,
        detail: `Cotado em ${lastOk.when.toLocaleDateString("pt-BR")} por ${lastOk.user ?? "—"} · sem envio`,
        when: lastOk.when,
        quote: lastOk,
      });
    }
    const last = quotes[0];
    if (last && !last.ok && !shippedOrders.has(o.id)) {
      out.push({
        kind: "quoteError",
        orderId: o.id,
        title: `${o.kind} ${o.id} · ${o.customer ?? "—"}`,
        detail: last.message || "Erro na cotação",
        when: last.when,
        quote: last,
      });
    }
  }
  const rank: AttentionKind[] = ["problem", "refused", "stale", "quoteError", "idle"];
  return out.sort(
    (a, b) => rank.indexOf(a.kind) - rank.indexOf(b.kind) || (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0)
  );
}

/* ------------------------------------------------------------------ atividade */

export interface Activity {
  kind: "quote" | "quoteError" | "shipment" | "refused" | "cancelled" | "tracking";
  when: Date;
  orderId: number;
  title: string;
  detail: string;
  status?: FreightStatus | null;
}

/** Linha do tempo do período: cotações, envios e a última atualização de rastreio de cada envio. */
export function activity(v: View, limit = 40): Activity[] {
  const out: Activity[] = [];
  for (const q of v.quotes) {
    if (!q.when) continue;
    out.push({
      kind: q.ok ? "quote" : "quoteError",
      when: q.when,
      orderId: q.orderId,
      title: q.ok ? `Cotação de ${shortName(q.carrierName)}` : "Cotação com erro",
      detail: `${q.customer ?? "—"} · ${q.ok ? `frete ${money(q.fee)} em ${q.days ?? "—"} dias` : q.message ?? ""}`,
    });
  }
  for (const s of v.allShipments) {
    if (s.when && inPeriod(v, s.when)) {
      out.push({
        kind: s.ok || s.cancelled ? "shipment" : "refused",
        when: s.when,
        orderId: s.orderId ?? s.invoiceId ?? 0,
        title: s.ok || s.cancelled ? `Envio solicitado · NF ${s.invoiceNumber ?? "—"}` : "Envio recusado",
        detail: `${s.customer ?? "—"} · ${s.ok || s.cancelled ? `${s.waybills.length} etiqueta(s)` : s.message ?? ""}`,
      });
    }
    if (s.cancelled && s.situationWhen && inPeriod(v, s.situationWhen)) {
      out.push({
        kind: "cancelled",
        when: s.situationWhen,
        orderId: s.orderId ?? s.invoiceId ?? 0,
        title: `Envio cancelado · NF ${s.invoiceNumber ?? "—"}`,
        detail: `${s.customer ?? "—"} · ${s.carrierOrder ?? ""}`,
        status: "X",
      });
    }
    if (s.ok && s.situationWhen && s.situation && inPeriod(v, s.situationWhen)) {
      out.push({
        kind: "tracking",
        when: s.situationWhen,
        orderId: s.orderId ?? s.invoiceId ?? 0,
        title: s.situation,
        detail: `${s.customer ?? "—"} · NF ${s.invoiceNumber ?? "—"} · ${s.city ?? ""}/${s.state ?? ""}`,
        status: shipmentStatus(s),
      });
    }
  }
  return out.sort((a, b) => b.when.getTime() - a.when.getTime()).slice(0, limit);
}

function money(v: number | null): string {
  return v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "ANJUN EXPRESS LOGISTICA E TRANSPORTES LTDA" → "Anjun Express". */
export function shortName(name: string | null | undefined): string {
  if (!name) {
    return "—";
  }
  const cut = name.split(/\s+(?:TRANSPORTES?|LOG[IÍ]STICA|URGENTES|LTDA|S\/?A|EIRELI|ME|EPP)\b/i)[0].trim() || name;
  return cut
    .split(/\s+/)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/* ------------------------------------------------------------------ transportadoras */

export interface CarrierStats {
  carrier: Carrier;
  quotes: number;
  quoteErrors: number;
  quotedOrders: number;
  shipments: number;
  refused: number;
  open: number;
  delivered: number;
  problems: number;
  feeTotal: number;
  feeAverage: number | null;
  daysAverage: number | null;
  deliveryDaysAverage: number | null;
  onTimeRate: number | null;
  environments: Set<string>;
  lastActivity: Date | null;
  /** Vezes em que foi a mais barata entre cotações OK do mesmo registro (com 2+ transportadoras). */
  cheapest: number;
  compared: number;
}

export function carrierStats(data: Dataset, filters: Filters): CarrierStats[] {
  const base = buildView(data, { ...filters, carrier: "all" });
  const ids = new Set<number>([
    ...data.carriers.map((c) => c.id),
    ...base.quotes.map((q) => q.carrierId ?? 0),
    ...base.allShipments.map((s) => s.carrierId ?? 0),
  ]);
  ids.delete(0);

  /* Disputa: registros com cotação OK em duas ou mais transportadoras. */
  const best = new Map<number, Map<number, number>>();
  for (const q of base.quotes) {
    if (!q.ok || q.fee == null || !q.carrierId) continue;
    const m = best.get(q.orderId) || new Map<number, number>();
    if (!m.has(q.carrierId)) m.set(q.carrierId, q.fee);
    best.set(q.orderId, m);
  }

  return [...ids]
    .map((id) => {
      const carrier = data.carriers.find((c) => c.id === id) || {
        id,
        name: `Transportadora ${id}`,
        legalName: null,
        document: null,
        city: null,
        state: null,
      };
      const v = buildView(data, { ...filters, carrier: String(id) });
      const k = kpis(v);
      let cheapest = 0;
      let compared = 0;
      for (const m of best.values()) {
        if (m.size < 2 || !m.has(id)) continue;
        compared++;
        if (m.get(id)! <= Math.min(...m.values())) cheapest++;
      }
      const dates = [...v.quotes.map((q) => q.when), ...v.allShipments.map((s) => s.situationWhen ?? s.when)]
        .filter((d): d is Date => !!d)
        .map((d) => d.getTime());
      return {
        carrier,
        quotes: k.quotes,
        quoteErrors: k.quoteErrors,
        quotedOrders: k.quotedOrders,
        shipments: k.shipments,
        refused: k.refused,
        open: v.open.length,
        delivered: k.delivered,
        problems: k.problems,
        feeTotal: k.feeTotal,
        feeAverage: k.feeAverage,
        daysAverage: k.daysAverage,
        deliveryDaysAverage: k.deliveryDaysAverage,
        onTimeRate: k.onTimeRate,
        environments: new Set<string>(
          [...v.quotes.map((q) => q.environment), ...v.allShipments.map((s) => s.environment)].filter(
            (e): e is "S" | "P" => !!e
          )
        ),
        lastActivity: dates.length ? new Date(Math.max(...dates)) : null,
        cheapest,
        compared,
      };
    })
    .sort((a, b) => b.shipments - a.shipments || b.quotes - a.quotes);
}

/* ------------------------------------------------------------------ caixas */

export interface BoxUsage {
  key: string;
  label: string;
  box: BoxType | null;
  quantity: number;
  orders: number;
}

/** Caixas usadas nos envios OK do período (ou nas cotações, se ainda não há envio). */
export function boxUsage(v: View): { usage: BoxUsage[]; source: "shipments" | "quotes"; perOrder: number | null } {
  const shipped = v.shipments.filter((s) => s.ok && s.boxes);
  const lastQuote = new Map<number, Quote>();
  for (const q of v.quotes) {
    if (q.ok && q.boxes && !lastQuote.has(q.orderId)) lastQuote.set(q.orderId, q);
  }
  const source = shipped.length ? "shipments" : "quotes";
  const texts = source === "shipments" ? shipped.map((s) => s.boxes!) : [...lastQuote.values()].map((q) => q.boxes!);
  const map = new Map<string, BoxUsage>();
  let total = 0;
  for (const t of texts) {
    const groups = parseBoxes(t);
    total += boxTotal(groups);
    const seen = new Set<string>();
    for (const g of groups) {
      const box = g.code != null ? v.boxes.find((b) => b.id === g.code) ?? null : null;
      const key = g.code != null ? `c${g.code}` : "avulsa";
      const u = map.get(key) || {
        key,
        label: box?.name ?? (g.code != null ? `Caixa ${g.code}` : "Avulsas"),
        box,
        quantity: 0,
        orders: 0,
      };
      u.quantity += g.quantity;
      if (!seen.has(key)) {
        u.orders++;
        seen.add(key);
      }
      map.set(key, u);
    }
  }
  return {
    usage: [...map.values()].sort((a, b) => b.quantity - a.quantity),
    source,
    perOrder: texts.length ? total / texts.length : null,
  };
}
