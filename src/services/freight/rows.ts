import { num, parseDate, text } from "./format";
import { asStatus } from "./status";
import type { BoxType, Carrier, Environment, Order, Quote, Shipment } from "./types";

/** Linha de consulta: colunas pelo nome (como o executeQuery devolve). */
export type Row = Record<string, unknown>;

const int = (v: unknown) => {
  const n = num(v);
  return n == null ? null : Math.trunc(n);
};

const env = (v: unknown): Environment | null => {
  const s = text(v)?.toUpperCase();
  return s === "S" || s === "P" ? s : null;
};

const kind = (tipmov: unknown): "Pedido" | "Nota" => (text(tipmov) === "V" ? "Nota" : "Pedido");

export function toQuote(r: Row): Quote {
  return {
    id: int(r.NUCOT) ?? 0,
    orderId: int(r.NUNOTA) ?? 0,
    carrierId: int(r.CODPARCTRANSP),
    carrierName: text(r.TRANSPNOME),
    when: parseDate(r.DHCOTACAO),
    user: text(r.NOMEUSU),
    environment: env(r.AMBIENTE),
    originZip: text(r.CEPORIGEM),
    destinationZip: text(r.CEPDESTINO),
    weightKg: num(r.PESO),
    volumeCm3: num(r.VOLUMECM3),
    declaredValue: num(r.VLRDECLARADO),
    ok: text(r.STATUS)?.toUpperCase() === "OK",
    fee: num(r.VLRFRETE),
    chargedWeightKg: num(r.PESOCOBRADO),
    days: int(r.PRAZODIAS),
    httpStatus: int(r.HTTPSTATUS),
    message: text(r.MENSAGEM),
    boxCount: int(r.QTDCAIXAS),
    boxes: text(r.CAIXAS),
    invoiceNumber: text(r.NUMNOTA),
    kind: r.TIPMOV == null ? null : kind(r.TIPMOV),
    customerId: int(r.CODPARC),
    customer: text(r.NOMEPARC),
    city: text(r.NOMECID),
    state: text(r.UF),
  };
}

export function toShipment(r: Row): Shipment & { labels: string[] } {
  const waybills = (text(r.WAYBILLS) || "")
    .split(/\s*,\s*/)
    .map((w) => w.trim())
    .filter(Boolean);
  const labels = (text(r.LABELURLS) || "")
    .split(/\s*\n\s*/)
    .map((l) => l.trim())
    .filter(Boolean);
  return {
    id: int(r.NUENVIO) ?? 0,
    invoiceId: int(r.NUNOTA),
    orderId: int(r.NUNOTAORIG) ?? int(r.NUNOTA),
    carrierId: int(r.CODPARCTRANSP),
    carrierName: text(r.TRANSPNOME),
    when: parseDate(r.DHENVIO),
    user: text(r.NOMEUSU),
    environment: env(r.AMBIENTE),
    ok: text(r.STATUS)?.toUpperCase() === "OK",
    cancelled: text(r.STATUS)?.toUpperCase() === "CANC",
    customerNumber: text(r.CUSTOMERNUMBER),
    carrierOrder: text(r.ORDERNUMBER),
    waybills,
    boxCount: int(r.QTDCAIXAS),
    weightKg: num(r.PESO),
    httpStatus: int(r.HTTPSTATUS),
    message: text(r.MENSAGEM),
    situationCode: text(r.SITUACAO),
    situation: text(r.SITUACAODESCR),
    situationWhen: parseDate(r.DHSITUACAO),
    finished: text(r.FINALIZADO)?.toUpperCase() === "S",
    boxes: text(r.CAIXAS),
    invoiceNumber: text(r.NUMNOTA),
    invoiceSeries: text(r.SERIENOTA),
    invoiceValue: num(r.VLRNOTA),
    customerId: int(r.CODPARC),
    customer: text(r.NOMEPARC),
    city: text(r.NOMECID),
    state: text(r.UF),
    fee: num(r.VLRFRETE),
    days: int(r.PRAZODIAS),
    status: asStatus(r.AD_FRETESTATUS),
    labels,
  };
}

export function toOrder(r: Row): Order {
  return {
    id: int(r.NUNOTA) ?? 0,
    number: text(r.NUMNOTA),
    series: text(r.SERIENOTA),
    kind: kind(r.TIPMOV),
    date: parseDate(r.DTNEG),
    companyId: int(r.CODEMP),
    company: text(r.NOMEFANTASIA),
    customerId: int(r.CODPARC),
    customer: text(r.NOMEPARC),
    city: text(r.NOMECID),
    state: text(r.UF),
    value: num(r.VLRNOTA),
    grossWeightKg: num(r.PESOBRUTO),
    volumes: int(r.QTDVOL),
    seller: text(r.APELIDO),
    status: asStatus(r.AD_FRETESTATUS),
    fee: num(r.AD_FRETEVLR),
    days: int(r.AD_FRETEPRAZO),
    quotedAt: parseDate(r.AD_FRETEDHCOT),
    quotedBy: text(r.USUCOT),
    carrierId: int(r.AD_FRETETRANSP),
    carrierName: text(r.TRANSPNOME),
    tracking: text(r.AD_FRETERASTREIO),
    situation: text(r.AD_FRETESITUACAO),
    situationWhen: parseDate(r.AD_FRETEDHSIT),
  };
}

export function toBox(r: Row): BoxType {
  return {
    id: int(r.CODCAIXA) ?? 0,
    name: text(r.NOME) || `Caixa ${r.CODCAIXA}`,
    lengthCm: num(r.COMPRIMENTO),
    widthCm: num(r.LARGURA),
    heightCm: num(r.ALTURA),
    weightKg: num(r.PESO),
    active: text(r.ATIVO)?.toUpperCase() !== "N",
    order: int(r.ORDEM),
  };
}

export function toCarrier(r: Row): Carrier {
  return {
    id: int(r.CODPARC) ?? 0,
    name: text(r.NOMEPARC) || `Transportadora ${r.CODPARC}`,
    legalName: text(r.RAZAOSOCIAL),
    document: text(r.CGC_CPF),
    city: text(r.NOMECID),
    state: text(r.UF),
  };
}
