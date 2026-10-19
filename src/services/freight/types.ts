/**
 * Dados da Central de Fretes, lidos das tabelas do módulo de frete (brasfoot-sankhya-transportadora):
 *
 * - TGFCAB: colunas AD_FRETE* (situação, último frete cotado, rastreio e situação do rastreio);
 * - AD_FRETECOT: toda cotação feita (OK ou ERRO), com caixas, peso, CEPs e o JSON trocado;
 * - AD_FRETEENV: todo envio solicitado (OK ou ERRO), com códigos de rastreio, etiquetas e a
 *   situação mais recente do rastreio;
 * - AD_FRETECAIXA: caixas padrão da expedição.
 *
 * Datas chegam como texto "yyyy-mm-dd hh:mi:ss" (CONVERT 120 no SQL) e viram Date aqui.
 */

/** Situação do frete no pedido (TGFCAB.AD_FRETESTATUS). */
export type FreightStatus = "C" | "S" | "T" | "E" | "P" | "X";

/** Ambiente da integração: S = sandbox (testes), P = produção. */
export type Environment = "S" | "P";

export interface Setup {
  /** AD_FRETECOT existe. */
  quotes: boolean;
  /** AD_FRETEENV existe. */
  shipments: boolean;
  /** AD_FRETECAIXA existe. */
  boxes: boolean;
  /** Colunas AD_FRETE* existem na TGFCAB. */
  orderColumns: boolean;
}

export interface Quote {
  id: number;
  orderId: number;
  carrierId: number | null;
  carrierName: string | null;
  when: Date | null;
  user: string | null;
  environment: Environment | null;
  originZip: string | null;
  destinationZip: string | null;
  weightKg: number | null;
  volumeCm3: number | null;
  declaredValue: number | null;
  ok: boolean;
  fee: number | null;
  chargedWeightKg: number | null;
  days: number | null;
  httpStatus: number | null;
  message: string | null;
  boxCount: number | null;
  boxes: string | null;
  invoiceNumber: string | null;
  kind: "Pedido" | "Nota" | null;
  customerId: number | null;
  customer: string | null;
  city: string | null;
  state: string | null;
}

export interface Shipment {
  id: number;
  /** NUNOTA da nota enviada. */
  invoiceId: number | null;
  /** NUNOTA do registro selecionado no clique (pedido ou a própria nota). */
  orderId: number | null;
  carrierId: number | null;
  carrierName: string | null;
  when: Date | null;
  user: string | null;
  environment: Environment | null;
  /** Envio criado na transportadora e ativo (STATUS = OK). */
  ok: boolean;
  /** Envio cancelado na transportadora pela central ou pelo pop-up (STATUS = CANC). */
  cancelled: boolean;
  customerNumber: string | null;
  carrierOrder: string | null;
  waybills: string[];
  boxCount: number | null;
  weightKg: number | null;
  httpStatus: number | null;
  message: string | null;
  situationCode: string | null;
  situation: string | null;
  situationWhen: Date | null;
  finished: boolean;
  boxes: string | null;
  invoiceNumber: string | null;
  invoiceSeries: string | null;
  invoiceValue: number | null;
  customerId: number | null;
  customer: string | null;
  city: string | null;
  state: string | null;
  /** Frete e prazo da última cotação OK do pedido ou da nota. */
  fee: number | null;
  days: number | null;
  /** Situação do frete no pedido (AD_FRETESTATUS), quando as colunas existem. */
  status: FreightStatus | null;
}

/** Registro cotado ou enviado (pedido ou nota) com o que a TGFCAB guarda do frete. */
export interface Order {
  id: number;
  number: string | null;
  series: string | null;
  kind: "Pedido" | "Nota";
  date: Date | null;
  companyId: number | null;
  company: string | null;
  customerId: number | null;
  customer: string | null;
  city: string | null;
  state: string | null;
  value: number | null;
  grossWeightKg: number | null;
  volumes: number | null;
  seller: string | null;
  status: FreightStatus | null;
  fee: number | null;
  days: number | null;
  quotedAt: Date | null;
  quotedBy: string | null;
  carrierId: number | null;
  carrierName: string | null;
  tracking: string | null;
  situation: string | null;
  situationWhen: Date | null;
}

export interface BoxType {
  id: number;
  name: string;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  weightKg: number | null;
  active: boolean;
  order: number | null;
}

export interface Carrier {
  id: number;
  name: string;
  legalName: string | null;
  document: string | null;
  city: string | null;
  state: string | null;
}

/** Tudo o que as telas usam, carregado de uma vez para o período escolhido. */
export interface Dataset {
  setup: Setup;
  quotes: Quote[];
  /** Envios do período e, de qualquer data (até 90 dias), os ainda em acompanhamento. */
  shipments: Shipment[];
  orders: Order[];
  boxes: BoxType[];
  carriers: Carrier[];
  loadedAt: Date;
  /** Dados de exemplo (fora do Sankhya). */
  sample: boolean;
}

export interface Filters {
  /** yyyy-mm-dd */
  from: string;
  /** yyyy-mm-dd */
  to: string;
  /** "all" ou CODPARC da transportadora. */
  carrier: string;
  environment: "all" | Environment;
}

/* ------------------------------------------------------------------ detalhe do pedido */

export interface OrderItem {
  sequence: number;
  productId: number;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
  total: number | null;
  grossWeightKg: number | null;
}

export interface Address {
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export interface OrderDetail {
  order: Order;
  destination: Address;
  origin: Address & { company: string | null };
  items: OrderItem[];
  quotes: Quote[];
  shipments: (Shipment & { labels: string[] })[];
}

/* ------------------------------------------------------------------ rastreio ao vivo */

export interface TrackingEvent {
  when: string | null;
  label: string;
  place: string | null;
  problem: string | null;
  /** statusCode da transportadora, quando o módulo o envia. */
  code?: string | null;
}

export interface BoxTracking {
  waybill: string;
  label: string;
  status: FreightStatus;
  events: TrackingEvent[];
}

export interface TrackingReply {
  ok: boolean;
  message: string | null;
  boxes: BoxTracking[];
}

/** Resposta de uma ação do botão do módulo (ex.: cancelar envio). */
export interface ActionReply {
  ok: boolean;
  message: string | null;
}

export interface QuoteReply {
  ok: boolean;
  message: string | null;
  fee: number | null;
  days: number | null;
  chargedWeightKg: number | null;
}
