import { sankhyaService } from "@/services/sankhya";
import type { SankhyaQueryParam } from "@/types/global";
import { decodeRow } from "./encoded";
import { num, text } from "./format";
import { callButton, toActionReply, toQuoteReply, toTracking } from "./java";
import { toBox, toCarrier, toOrder, toQuote, toShipment, type Row } from "./rows";
import * as SQL from "./sql";
import type {
  ActionReply,
  Address,
  Dataset,
  Filters,
  OrderDetail,
  QuoteReply,
  Setup,
  TrackingReply,
} from "./types";

/**
 * De onde a central lê e o que ela pode pedir ao módulo. Dentro do Sankhya: SQL pelo executeQuery
 * nativo (<snk:load/>) e o botão "Cotar frete" para rastrear e recotar. Fora (pnpm dev): dados de
 * exemplo (sample-source.ts).
 */
export interface FreightSource {
  readonly sample: boolean;
  loadDataset(filters: Filters, progress?: (step: string) => void): Promise<Dataset>;
  loadOrderDetail(orderId: number, setup: Setup): Promise<OrderDetail>;
  loadJson(kind: "quote" | "shipment", id: number): Promise<{ request: string | null; response: string | null }>;
  /** Consulta o rastreio na transportadora (atualiza também a situação gravada). */
  track(orderId: number): Promise<TrackingReply>;
  /** Nova cotação com as mesmas caixas e o mesmo peso de uma cotação anterior. */
  requote(orderId: number, carrierId: number, boxes: string, weightKg: number): Promise<QuoteReply>;
  /** Cancela na transportadora o envio ativo do registro (só antes da coleta). */
  cancel(orderId: number): Promise<ActionReply>;
  /** Id do botão "Cotar frete" (TSIBTA); null quando não encontrado. */
  buttonId(): Promise<number | null>;
}

/** Carriers com integração no módulo (CarrierRegistry.java): aparecem mesmo sem movimento. */
export const INTEGRATED_CARRIERS = [31656];

/** Chave do id do botão informado à mão (Configurações), quando a busca automática falhar. */
export const BUTTON_KEY = "central-frete.botao";

/* ------------------------------------------------------------------ Sankhya */

let sqlQueue: Promise<unknown> = Promise.resolve();

/**
 * Uma consulta por vez (o Sankhya cancela chamadas simultâneas da mesma sessão). As colunas de
 * texto livre chegam em Base64 (B64_…) e saem decodificadas, com o nome sem o prefixo.
 */
function query(sql: string, params: SankhyaQueryParam[] = []): Promise<Row[]> {
  const p = sqlQueue.then(async () => {
    let result: unknown;
    try {
      result = await sankhyaService.executeQuery(sql, params);
    } catch (e) {
      throw e instanceof SyntaxError ? unreadable(e) : e;
    }
    return onlyRows(result).map(decodeRow);
  });
  sqlQueue = p.catch(() => null);
  return p;
}

/** JSON.parse falhou: algum texto saiu do SQL sem passar por T() (sql.ts) e trouxe aspas ou quebra de linha. */
function unreadable(e: SyntaxError): Error {
  console.warn("[central-frete] resposta da consulta não é JSON válido", e);
  return new Error(
    `O Sankhya devolveu a consulta com texto que quebra o JSON (aspas ou quebra de linha sem escape): ${e.message}`
  );
}

/**
 * Só linhas de verdade. Em produção (26/10/2026) uma consulta de envios sem resultado chegou como uma
 * linha vazia e a central mostrou um "Envio nº 0 · Recusado" que não existia: linha sem nenhum valor
 * é descartada (e registrada no console para diagnóstico).
 */
function onlyRows(result: unknown): Row[] {
  if (!Array.isArray(result)) {
    if (result != null) console.warn("[central-frete] consulta não devolveu lista", result);
    return [];
  }
  const rows = result.filter(
    (r): r is Row => !!r && typeof r === "object" && Object.values(r as Row).some((v) => v != null && v !== "")
  );
  if (rows.length !== result.length) {
    console.warn("[central-frete] linhas vazias descartadas", result.length - rows.length, result);
  }
  return rows;
}

/** Registro sem chave (NUNOTA, NUCOT, NUENVIO…) não entra na tela. */
const withKey = <T extends { id: number }>(list: T[]): T[] => list.filter((x) => x.id > 0);

const S = (value: string): SankhyaQueryParam => ({ value, type: "S" });
const I = (value: number): SankhyaQueryParam => ({ value, type: "I" });

function describe(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  const m = (e as any)?.statusMessage;
  return m ? String(m) : String(e);
}

async function loadSetup(): Promise<Setup> {
  let tables: Row[];
  let columns: Row[];
  try {
    tables = await query(SQL.SETUP_TABLES);
    columns = await query(SQL.SETUP_COLUMNS);
  } catch {
    tables = await query(SQL.SETUP_TABLES_DICTIONARY);
    columns = await query(SQL.SETUP_COLUMNS_DICTIONARY);
  }
  const t = new Set(tables.map((r) => String(r.TABLE_NAME).toUpperCase()));
  const c = new Set(columns.map((r) => String(r.COLUMN_NAME).toUpperCase()));
  return {
    quotes: t.has("AD_FRETECOT"),
    shipments: t.has("AD_FRETEENV"),
    boxes: t.has("AD_FRETECAIXA"),
    orderColumns: SQL.ORDER_COLUMNS.every((col) => c.has(col)),
  };
}

let cachedButton: number | null | undefined;

export const sankhyaSource: FreightSource = {
  sample: false,

  async loadDataset(filters, progress) {
    const range = [S(filters.from), S(filters.to)];
    progress?.("Conferindo a estrutura do frete…");
    const setup = await loadSetup();

    progress?.("Carregando cotações…");
    const quotes = setup.quotes ? withKey((await query(SQL.QUOTES, range)).map(toQuote)) : [];

    progress?.("Carregando envios…");
    const shipments = setup.shipments
      ? withKey((await query(SQL.shipments(setup), range)).map(toShipment))
      : [];

    progress?.("Carregando pedidos…");
    const ordersSql = SQL.orders(setup);
    const orders = ordersSql
      ? (
          await query(
            ordersSql.sql,
            Array.from({ length: ordersSql.periods }).flatMap(() => range)
          )
        ).map(toOrder).filter((o) => o.id > 0)
      : [];

    progress?.("Carregando caixas e transportadoras…");
    const boxes = setup.boxes ? withKey((await query(SQL.BOXES)).map(toBox)) : [];
    const carrierIds = new Set<number>(INTEGRATED_CARRIERS);
    quotes.forEach((q) => q.carrierId && carrierIds.add(q.carrierId));
    shipments.forEach((s) => s.carrierId && carrierIds.add(s.carrierId));
    orders.forEach((o) => o.carrierId && carrierIds.add(o.carrierId));
    const carriers = withKey((await query(SQL.carriers([...carrierIds]))).map(toCarrier));

    return { setup, quotes, shipments, orders, boxes, carriers, loadedAt: new Date(), sample: false };
  },

  async loadOrderDetail(orderId, setup) {
    const header = await query(SQL.order(setup), [I(orderId)]);
    if (!header.length) {
      throw new Error(`Registro ${orderId} não encontrado na TGFCAB.`);
    }
    const order = toOrder(header[0]);
    const shipments = setup.shipments ? withKey((await query(SQL.shipmentsOf(setup, [orderId]))).map(toShipment)) : [];
    const linked = [orderId, ...shipments.flatMap((s) => [s.invoiceId ?? 0, s.orderId ?? 0])];
    const quotes = setup.quotes ? withKey((await query(SQL.quotesOf(linked))).map(toQuote)) : [];
    const items = (await query(SQL.ITEMS, [I(orderId)])).map((r) => ({
      sequence: num(r.SEQUENCIA) ?? 0,
      productId: num(r.CODPROD) ?? 0,
      description: text(r.DESCRPROD) || "—",
      quantity: num(r.QTDNEG) ?? 0,
      unit: text(r.CODVOL),
      unitPrice: num(r.VLRUNIT),
      total: num(r.VLRTOT),
      grossWeightKg: num(r.PESOBRUTO),
    }));
    let destination: Address = emptyAddress();
    let origin: Address & { company: string | null } = { ...emptyAddress(), company: order.company };
    try {
      const a = (await query(SQL.ADDRESSES, [I(orderId)]))[0];
      if (a) {
        destination = {
          street: text(a.NOMEEND),
          number: text(a.NUMEND),
          complement: text(a.COMPLEMENTO),
          district: text(a.NOMEBAI),
          city: text(a.NOMECID),
          state: text(a.UF),
          zip: text(a.CEP),
        };
        origin = {
          company: text(a.EMPRESA) || order.company,
          street: text(a.EMP_NOMEEND),
          number: text(a.EMP_NUMEND),
          complement: null,
          district: text(a.EMP_NOMEBAI),
          city: text(a.EMP_NOMECID),
          state: text(a.EMP_UF),
          zip: text(a.EMP_CEP),
        };
      }
    } catch (e) {
      console.warn("[central-frete] endereços indisponíveis", e);
    }
    return { order, destination, origin, items, quotes, shipments };
  },

  async loadJson(kind, id) {
    const rows = await query(kind === "quote" ? SQL.QUOTE_JSON : SQL.SHIPMENT_JSON, [I(id)]);
    return { request: text(rows[0]?.REQ), response: text(rows[0]?.RESP) };
  },

  async buttonId() {
    const manual = Number(safeStorage()?.getItem(BUTTON_KEY));
    if (manual > 0) {
      return manual;
    }
    if (cachedButton !== undefined) {
      return cachedButton;
    }
    for (const sql of [SQL.BUTTON, SQL.BUTTON_TEXT]) {
      try {
        const id = num((await query(sql))[0]?.IDBTNACAO);
        if (id) {
          cachedButton = id;
          return id;
        }
      } catch {
        /* tenta a próxima forma de ler o CONFIG */
      }
    }
    cachedButton = null;
    return null;
  },

  async track(orderId) {
    try {
      const id = await requireButton();
      return toTracking(await callButton(id, `0|ACAO=RASTREAR|NUNOTA=${orderId}`, orderId), orderId);
    } catch (e) {
      return { ok: false, message: describe(e), boxes: [] };
    }
  },

  async requote(orderId, carrierId, boxes, weightKg) {
    const weight = String(Math.round(weightKg * 1000) / 1000);
    try {
      const id = await requireButton();
      return toQuoteReply(
        await callButton(id, `${carrierId}|ACAO=COTAR|NUNOTA=${orderId}|PESO=${weight}|CAIXAS=${boxes}`, orderId),
        orderId
      );
    } catch (e) {
      return { ok: false, message: describe(e), fee: null, days: null, chargedWeightKg: null };
    }
  },

  async cancel(orderId) {
    try {
      const id = await requireButton();
      return toActionReply(await callButton(id, `0|ACAO=CANCELAR|NUNOTA=${orderId}`, orderId));
    } catch (e) {
      return { ok: false, message: describe(e) };
    }
  },
};

async function requireButton(): Promise<number> {
  const id = await sankhyaSource.buttonId();
  if (!id) {
    throw new Error(
      'Não encontrei o botão "Cotar frete" (Rotina Java FreightQuoteAction) na TSIBTA. Informe o id do botão em Configurações.'
    );
  }
  return id;
}

function emptyAddress(): Address {
  return { street: null, number: null, complement: null, district: null, city: null, state: null, zip: null };
}

export function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Dentro do Sankhya (o <snk:load/> injeta o executeQuery nativo) ou servido pelo /mge. */
export function insideSankhya(): boolean {
  return typeof window.executeQuery === "function" || window.location.pathname.startsWith("/mge/");
}
