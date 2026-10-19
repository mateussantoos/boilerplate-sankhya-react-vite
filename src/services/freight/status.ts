import type { FreightStatus, TrackingEvent } from "./types";

/** Situações do frete (lista do campo TGFCAB.AD_FRETESTATUS), na ordem do fluxo. */
export const STATUS_ORDER: FreightStatus[] = ["C", "S", "T", "E", "P", "X"];

export const STATUS_LABEL: Record<FreightStatus, string> = {
  C: "Cotado",
  S: "Envio solicitado",
  T: "Em trânsito",
  E: "Entregue",
  P: "Problema na entrega",
  X: "Envio cancelado",
};

/** Tom da etiqueta de cada situação (Bootstrap 3, como no Sankhya). */
export type Tone = "neutral" | "blue" | "sky" | "amber" | "green" | "red" | "outline";

export const STATUS_TONE: Record<FreightStatus, Tone> = {
  C: "blue",
  S: "sky",
  T: "amber",
  E: "green",
  P: "red",
  X: "neutral",
};

export function statusLabel(code: FreightStatus | null | undefined): string {
  return code ? STATUS_LABEL[code] : "Sem situação";
}

export function asStatus(v: unknown): FreightStatus | null {
  const s = v == null ? "" : String(v).trim().toUpperCase();
  return (STATUS_ORDER as string[]).includes(s) ? (s as FreightStatus) : null;
}

/* ------------------------------------------------------------------ trajeto */

/**
 * Marcos do trajeto de uma caixa, na ordem. Cada evento do rastreio cai num marco pelo código da
 * transportadora (quando vier) ou pelo texto já traduzido pelo módulo (TrackingCodes.java).
 */
export const MILESTONES = [
  { key: "requested", label: "Envio solicitado" },
  { key: "collected", label: "Coletado" },
  { key: "transit", label: "Em trânsito" },
  { key: "agency", label: "Na agência de entrega" },
  { key: "delivering", label: "Saiu para entrega" },
  { key: "delivered", label: "Entregue" },
] as const;

export type MilestoneKey = (typeof MILESTONES)[number]["key"];

const BY_CODE: Record<string, MilestoneKey> = {
  collected: "collected",
  lastmile_collected: "collected",
  pack_bag: "collected",
  warehouse_pack: "collected",
  collect_uploading_truck: "transit",
  transfer_in_storage: "transit",
  transfer_out_storage: "transit",
  delivery_uploading_truck: "transit",
  delivery_site_in_storage: "agency",
  delivery_unloading_truck: "agency",
  arrive_to_collect: "agency",
  delivering: "delivering",
  signed: "delivered",
};

const BY_LABEL: [RegExp, MilestoneKey][] = [
  [/^entregue/i, "delivered"],
  [/rota de entrega|saiu para entrega/i, "delivering"],
  [/agência|disponível para retirada/i, "agency"],
  [/centro de distribuição|em trânsito|a caminho/i, "transit"],
  [/coletado|separado para transporte|consolidado/i, "collected"],
];

export function milestoneOf(e: TrackingEvent): MilestoneKey | null {
  const code = e.code ? BY_CODE[e.code.trim().toLowerCase()] : undefined;
  if (code) {
    return code;
  }
  for (const [re, key] of BY_LABEL) {
    if (re.test(e.label)) {
      return key;
    }
  }
  return null;
}

/** Evento de falha, devolução ou cancelamento (fica em vermelho no trajeto). */
export function isProblemEvent(e: TrackingEvent): boolean {
  if (e.problem) {
    return true;
  }
  const c = (e.code || "").toLowerCase();
  if (c.endsWith("_failed") || c.startsWith("return") || c.startsWith("back_") || c === "cancelled") {
    return true;
  }
  return /falha|retornando|devolvid|cancelad/i.test(e.label);
}

/** Índice do marco mais avançado já alcançado (0 = só solicitado). */
export function reachedMilestone(events: TrackingEvent[]): number {
  let best = 0;
  for (const e of events) {
    const key = milestoneOf(e);
    const i = key ? MILESTONES.findIndex((m) => m.key === key) : -1;
    if (i > best) {
      best = i;
    }
  }
  return best;
}
