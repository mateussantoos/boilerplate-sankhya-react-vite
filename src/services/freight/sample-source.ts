import { statusFromCode } from "./analytics";
import { addDays, isoDay } from "./format";
import type { FreightSource } from "./source";
import type {
  BoxTracking,
  BoxType,
  Carrier,
  Dataset,
  FreightStatus,
  Order,
  OrderDetail,
  Quote,
  Shipment,
  TrackingEvent,
} from "./types";

/**
 * Dados de exemplo para rodar a central fora do Sankhya (pnpm dev): ~170 registros fictícios nos
 * últimos 80 dias, com cotações (algumas com erro), envios, rastreio e caixas do catálogo padrão.
 * Gerados por semente fixa: a mesma data gera os mesmos dados.
 */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BOXES: BoxType[] = (
  [
    [1, "PP", 28, 27, 32, 0.3],
    [2, "P", 44, 38, 31, 0.6],
    [3, "M", 57, 50, 35, 0.9],
    [4, "G", 53, 48, 46, 0.9],
    [5, "CP", 45, 31, 25, 0.45],
    [6, "CG", 44, 50, 39, 1],
    [7, "Neo", 40, 40, 28, 0.8],
    [8, "Emb", 48, 48, 40, 0.8],
    [9, "Taça", 24, 18, 32, 0.2],
    [10, "A", 41, 43, 51, 1],
    [11, "Germer", 33, 40, 23, 0.6],
    [12, "R", 30, 40, 40, null],
  ] as [number, string, number, number, number, number | null][]
).map(([id, name, l, w, h, kg], i) => ({
  id,
  name,
  lengthCm: l,
  widthCm: w,
  heightCm: h,
  weightKg: kg,
  active: true,
  order: i + 1,
}));

const CARRIERS: Carrier[] = [
  {
    id: 31656,
    name: "ANJUN EXPRESS LOGISTICA E TRANSPORTES LTDA",
    legalName: "ANJUN EXPRESS LOGISTICA E TRANSPORTES LTDA",
    document: "11605535000455",
    city: "Cajamar",
    state: "SP",
  },
  {
    id: 1200,
    name: "BRASPRESS TRANSPORTES URGENTES LTDA",
    legalName: "BRASPRESS TRANSPORTES URGENTES LTDA",
    document: "48740351000165",
    city: "São Paulo",
    state: "SP",
  },
];

const CUSTOMERS: [string, string, string, string][] = [
  ["ESPORTE CLUBE PLANALTO", "Brasília", "DF", "72405610"],
  ["LIGA PAULISTANA DE FUTSAL", "São Paulo", "SP", "01310100"],
  ["ACADEMIA GOL DE PLACA", "Belo Horizonte", "MG", "30130010"],
  ["FEDERAÇÃO PARANAENSE DE BOCHA", "Curitiba", "PR", "80010000"],
  ["GRÊMIO RECREATIVO SUL", "Porto Alegre", "RS", "90010150"],
  ["ASSOCIAÇÃO ATLÉTICA BAIANA", "Salvador", "BA", "40020000"],
  ["CLUBE NÁUTICO RECIFENSE", "Recife", "PE", "50030230"],
  ["ESCOLINHA BOLA NA REDE", "Goiânia", "GO", "74003010"],
  ["COPA NORDESTE EVENTOS", "Fortaleza", "CE", "60060440"],
  ["AMAZONAS SPORTS", "Manaus", "AM", "69005070"],
  ["TROFÉUS CAMPINAS", "Campinas", "SP", "13015001"],
  ["ARENA TRIÂNGULO", "Uberlândia", "MG", "38400100"],
  ["ILHA ESPORTES", "Florianópolis", "SC", "88010400"],
  ["CAPIXABA FUTEBOL CLUBE", "Vitória", "ES", "29010120"],
  ["COPA CARIOCA DE BASE", "Rio de Janeiro", "RJ", "20040002"],
  ["PARÁ ESPORTE CLUBE", "Belém", "PA", "66010020"],
  ["POTIGUAR ATLÉTICO", "Natal", "RN", "59012300"],
  ["PANTANAL SPORTS", "Cuiabá", "MT", "78005100"],
  ["MORENA ESPORTES", "Campo Grande", "MS", "79002070"],
  ["PIAUÍ CAMPEONATOS", "Teresina", "PI", "64000040"],
];

const USERS = ["MATEUS", "IZABELLA", "RAFAEL", "JULIANA"];
const SELLERS = ["CARLOS", "PATRÍCIA", "RENATO", "ALINE"];

const QUOTE_ERRORS = [
  "CEP destino não atendido pela transportadora.",
  "Falha na autenticação: token expirado (401).",
  "Peso por caixa acima do limite de 30 kg.",
  "Tempo esgotado ao consultar a transportadora.",
];

const SHIP_ERRORS = ["Nota fiscal sem autorização da SEFAZ.", "Endereço de entrega incompleto (número)."];

const PRODUCTS: [number, string, number, number][] = [
  [1012, "TAÇA CAMPEÃO 45 CM DOURADA", 89.9, 0.85],
  [1013, "TAÇA VICE-CAMPEÃO 38 CM PRATA", 74.5, 0.7],
  [2201, "MEDALHA HONRA AO MÉRITO 50 MM", 6.9, 0.05],
  [2205, "MEDALHA FUTEBOL 60 MM OURO", 8.4, 0.06],
  [3100, "TROFÉU ARTILHEIRO 32 CM", 64.0, 0.6],
  [3104, "TROFÉU GOLEIRO MENOS VAZADO 30 CM", 59.0, 0.55],
  [4002, "BOLA OFICIAL CAMPO PRO", 129.0, 0.45],
  [5010, "PLACA HOMENAGEM MDF 20X15", 39.9, 0.4],
];

const TRANSIT_PLACES = ["CD Contagem/MG", "CD Cajamar/SP", "CD Duque de Caxias/RJ", "CD Aparecida de Goiânia/GO"];

interface SampleWorld {
  dataset: Dataset;
  tracking: Map<number, BoxTracking[]>;
  items: Map<number, OrderDetail["items"]>;
}

let world: SampleWorld | null = null;

function build(): SampleWorld {
  const today = new Date();
  today.setSeconds(0, 0);
  const r = rng(Number(isoDay(today).replace(/-/g, "")));
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
  const between = (a: number, b: number) => a + r() * (b - a);
  const at = (base: Date, dayOffset: number) => {
    const d = addDays(base, dayOffset);
    d.setHours(8 + Math.floor(r() * 9), Math.floor(r() * 60), 0, 0);
    return d > today ? new Date(today.getTime() - (20 + r() * 300) * 60000) : d;
  };

  const quotes: Quote[] = [];
  const shipments: Shipment[] = [];
  const orders: Order[] = [];
  const tracking = new Map<number, BoxTracking[]>();
  const items = new Map<number, OrderDetail["items"]>();
  let nucot = 5400;
  let nuenvio = 820;

  for (let i = 0; i < 170; i++) {
    const id = 776000 + i * 7;
    const [customer, city, state, zip] = pick(CUSTOMERS);
    const created = at(today, -Math.floor(Math.pow(r(), 1.3) * 80));
    const groups: string[] = [];
    let count = 0;
    let cm3 = 0;
    for (let g = 0; g < 1 + Math.floor(r() * 3); g++) {
      const b = pick(BOXES.filter((x) => x.id !== 12));
      const q = 1 + Math.floor(r() * (g === 0 ? 10 : 3));
      groups.push(`${q}x${b.lengthCm}x${b.widthCm}x${b.heightCm}:${b.id}`);
      count += q;
      cm3 += q * b.lengthCm! * b.widthCm! * b.heightCm!;
    }
    if (r() < 0.25) {
      groups.push(`1x32x24x19`);
      count += 1;
      cm3 += 32 * 24 * 19;
    }
    const boxes = groups.join(";");
    const weight = Math.round(between(4, 18) * count * 100) / 100;
    const value = Math.round(between(600, 9000) * 100) / 100;
    const orderItems = Array.from({ length: 1 + Math.floor(r() * 4) }, (_, k) => {
      const [productId, description, price, kg] = pick(PRODUCTS);
      const quantity = 2 + Math.floor(r() * 40);
      return {
        sequence: k + 1,
        productId,
        description,
        quantity,
        unit: "UN",
        unitPrice: price,
        total: Math.round(price * quantity * 100) / 100,
        grossWeightKg: kg,
      };
    });
    items.set(id, orderItems);

    /* Cotações: às vezes uma com erro antes; às vezes também na Braspress, para comparar. */
    const user = pick(USERS);
    let lastOk: Quote | null = null;
    const attempts = 1 + (r() < 0.35 ? 1 : 0) + (r() < 0.15 ? 1 : 0);
    for (let k = 0; k < attempts; k++) {
      const carrier = k > 0 && r() < 0.45 ? CARRIERS[1] : CARRIERS[0];
      const ok = r() > 0.12;
      const fee = Math.round((18 + cm3 / 9000 + weight * 0.42) * between(0.9, 1.25) * (carrier.id === 1200 ? 1.18 : 1) * 100) / 100;
      const q: Quote = {
        id: ++nucot,
        orderId: id,
        carrierId: carrier.id,
        carrierName: carrier.name,
        when: new Date(created.getTime() + k * 1000 * 60 * (7 + r() * 50)),
        user,
        environment: carrier.id === 31656 ? "S" : "P",
        originZip: "35702051",
        destinationZip: zip,
        weightKg: weight,
        volumeCm3: cm3,
        declaredValue: value,
        ok,
        fee: ok ? fee : null,
        chargedWeightKg: ok ? Math.max(weight, Math.round((cm3 / 6000) * 100) / 100) : null,
        days: ok ? 2 + Math.floor(r() * 7) + (["AM", "PA", "RN", "PI", "CE"].includes(state) ? 3 : 0) : null,
        httpStatus: ok ? 200 : pick([400, 401, 422, 504]),
        message: ok ? null : pick(QUOTE_ERRORS),
        boxCount: count,
        boxes,
        invoiceNumber: null,
        kind: "Pedido",
        customerId: 20000 + CUSTOMERS.findIndex((c) => c[0] === customer),
        customer,
        city,
        state,
      };
      quotes.push(q);
      if (ok && carrier.id === 31656) {
        lastOk = q;
      }
    }

    const order: Order = {
      id,
      number: null,
      series: null,
      kind: "Pedido",
      date: created,
      companyId: 1,
      company: "BRASFOOT",
      customerId: 20000 + CUSTOMERS.findIndex((c) => c[0] === customer),
      customer,
      city,
      state,
      value,
      grossWeightKg: weight,
      volumes: 1,
      seller: pick(SELLERS),
      status: lastOk ? "C" : null,
      fee: lastOk?.fee ?? null,
      days: lastOk?.days ?? null,
      quotedAt: lastOk?.when ?? quotes[quotes.length - 1].when,
      quotedBy: user,
      carrierId: lastOk ? 31656 : null,
      carrierName: lastOk ? CARRIERS[0].name : null,
      tracking: null,
      situation: null,
      situationWhen: null,
    };

    /* Envio: a maioria dos cotados há mais de um dia. */
    const age = (today.getTime() - created.getTime()) / 86400000;
    if (lastOk && age > 1 && r() < 0.74) {
      const sent = new Date(Math.min(today.getTime() - 3600000, lastOk.when!.getTime() + between(2, 40) * 3600000));
      const refused = r() < 0.04;
      const invoiceNumber = String(97000 + i);
      const waybills = refused ? [] : Array.from({ length: count }, (_, k) => `AJ${id}${String(k + 1).padStart(2, "0")}`);
      const sinceSent = (today.getTime() - sent.getTime()) / 86400000;
      /* Até onde o pacote deveria ter ido; a situação final sai do último evento gerado (como no módulo). */
      let code: string | null = null;
      const roll = r();
      if (!refused && sinceSent > 0.6) {
        if (roll < 0.06) {
          code = "delivery_failed";
        } else if (roll < 0.08) {
          code = "cancelled";
        } else if (sinceSent > lastOk.days! * 0.8 && roll < 0.93) {
          code = "signed";
        } else {
          code = pick(["collected", "transfer_in_storage", "transfer_out_storage", "delivery_site_in_storage", "delivering"]);
        }
      }
      const events = refused ? [] : trajectory(sent, code, city, state, r, today);
      code = events.length ? events[0].code ?? null : null;
      const status: FreightStatus = statusFromCode(code);
      const situationWhen = events.length ? parseWhen(events[0].when) : refused ? null : sent;
      const label = events.length ? events[0].label + (events[0].problem ? `: ${events[0].problem}` : "") : "Envio solicitado";
      const shipment: Shipment = {
        id: ++nuenvio,
        invoiceId: id + 400000,
        orderId: id,
        carrierId: 31656,
        carrierName: CARRIERS[0].name,
        when: sent,
        user,
        environment: "S",
        ok: !refused,
        cancelled: false,
        customerNumber: `BF${id + 400000}`,
        carrierOrder: refused ? null : `ANJ${String(5200000 + i * 13)}`,
        waybills,
        boxCount: count,
        weightKg: weight,
        httpStatus: refused ? 422 : 200,
        message: refused ? pick(SHIP_ERRORS) : `Envio criado com ${count} etiqueta(s).`,
        situationCode: code,
        situation: refused ? null : label,
        situationWhen,
        finished: status === "E" || status === "X",
        boxes,
        invoiceNumber,
        invoiceSeries: "1",
        invoiceValue: value,
        customerId: order.customerId,
        customer,
        city,
        state,
        fee: lastOk.fee,
        days: lastOk.days,
        status: refused ? "C" : status,
      };
      shipments.push(shipment);
      /* Alguns cancelados pela expedição logo depois de pedir (solicitado por engano). */
      if (!refused && r() < 0.05) {
        markCancelled(shipment, order, new Date(sent.getTime() + between(1, 6) * 3600000), user);
      } else if (!refused) {
        order.status = status;
        order.tracking = waybills.join(", ").slice(0, 200);
        order.situation = label;
        order.situationWhen = situationWhen;
        order.number = invoiceNumber;
        /* Uma caixa às vezes fica um passo atrás das outras (acontece de verdade). */
        const lagging = waybills.length > 2 && events.length > 2 && r() < 0.5 ? waybills.length - 1 : -1;
        tracking.set(
          id,
          waybills.map((w, k) => {
            const own = k === lagging ? events.slice(1) : events;
            return {
              waybill: w,
              label: own.length ? own[0].label + (own[0].problem ? `: ${own[0].problem}` : "") : "Envio solicitado",
              status: k === lagging ? statusFromCode(own[0]?.code) : status,
              events: own,
            };
          })
        );
      }
    }
    orders.push(order);
  }

  quotes.sort((a, b) => b.when!.getTime() - a.when!.getTime());
  shipments.sort((a, b) => b.when!.getTime() - a.when!.getTime());
  return {
    dataset: {
      setup: { quotes: true, shipments: true, boxes: true, orderColumns: true },
      quotes,
      shipments,
      orders: orders.sort((a, b) => b.id - a.id),
      boxes: BOXES,
      carriers: CARRIERS,
      loadedAt: new Date(),
      sample: true,
    },
    tracking,
    items,
  };
}

/** Como o módulo grava um cancelamento: STATUS = CANC, situação "Envio cancelado", quem e quando na mensagem. */
function markCancelled(s: Shipment, order: Order | undefined, when: Date, user: string) {
  s.ok = false;
  s.cancelled = true;
  s.status = "X";
  s.situationCode = "cancelled";
  s.situation = "Envio cancelado";
  s.situationWhen = when;
  s.finished = true;
  s.message = `${s.message ?? ""} | Cancelado na transportadora em ${when.toLocaleDateString("pt-BR")} ${when
    .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} por ${user}`;
  if (order) {
    order.status = "X";
    order.situation = "Envio cancelado";
    order.situationWhen = when;
  }
}

const STEPS: [string, string][] = [
  ["collected", "Pacote coletado"],
  ["transfer_in_storage", "Chegou ao centro de distribuição"],
  ["transfer_out_storage", "Saiu do centro de distribuição"],
  ["delivery_uploading_truck", "Em trânsito"],
  ["delivery_site_in_storage", "Chegou à agência local"],
  ["delivering", "Em rota de entrega"],
  ["signed", "Entregue"],
];

/** Eventos até o código atual, mais recentes primeiro. */
function trajectory(
  sent: Date,
  code: string | null,
  city: string,
  state: string,
  r: () => number,
  today: Date
): TrackingEvent[] {
  if (!code) {
    return [];
  }
  const events: TrackingEvent[] = [];
  let when = new Date(sent.getTime() + (6 + r() * 14) * 3600000);
  const hub = TRANSIT_PLACES[Math.floor(r() * TRANSIT_PLACES.length)];
  const failing = code === "delivery_failed" || code === "cancelled";
  const last = failing ? "delivering" : code;
  for (const [step, label] of STEPS) {
    if (when > today) {
      break;
    }
    const place =
      step === "collected" ? "Sete Lagoas/MG" : step.startsWith("transfer") || step === "delivery_uploading_truck" ? hub : `Agência ${city}/${state}`;
    events.push({ when: fmtWhen(when), label, place, problem: null, code: step });
    if (step === last) {
      break;
    }
    when = new Date(when.getTime() + (5 + r() * 26) * 3600000);
  }
  if (failing && when <= today) {
    events.push(
      code === "cancelled"
        ? { when: fmtWhen(when), label: "Pedido cancelado", place: hub, problem: "Pedido cancelado pelo remetente", code }
        : {
            when: fmtWhen(when),
            label: "Falha na entrega",
            place: `Agência ${city}/${state}`,
            problem: "Não foi possível contactar o destinatário",
            code,
          }
    );
  }
  return events.reverse();
}

function fmtWhen(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${isoDay(d)} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

function parseWhen(s: string | null): Date | null {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(s) : null;
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

function getWorld(): SampleWorld {
  if (!world) {
    world = build();
  }
  return world;
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const sampleSource: FreightSource = {
  sample: true,

  async loadDataset(filters, progress) {
    progress?.("Gerando dados de exemplo…");
    await delay(250);
    const w = getWorld();
    const from = new Date(`${filters.from}T00:00:00`);
    const to = addDays(new Date(`${filters.to}T00:00:00`), 1);
    const inRange = (d: Date | null) => !!d && d >= from && d < to;
    const quotes = w.dataset.quotes.filter((q) => inRange(q.when));
    const shipments = w.dataset.shipments.filter((s) => inRange(s.when) || (s.ok && !s.finished));
    const ids = new Set<number>([...quotes.map((q) => q.orderId), ...shipments.map((s) => s.orderId ?? 0)]);
    const orders = w.dataset.orders.filter((o) => ids.has(o.id));
    return { ...w.dataset, quotes, shipments, orders, loadedAt: new Date() };
  },

  async loadOrderDetail(orderId) {
    await delay(200);
    const w = getWorld();
    const order = w.dataset.orders.find((o) => o.id === orderId);
    if (!order) {
      throw new Error(`Registro ${orderId} não encontrado.`);
    }
    const customer = CUSTOMERS.find((c) => c[0] === order.customer);
    return {
      order,
      destination: {
        street: "Rua das Palmeiras",
        number: String(100 + (orderId % 900)),
        complement: null,
        district: "Centro",
        city: order.city,
        state: order.state,
        zip: customer?.[3] ?? null,
      },
      origin: {
        company: "BRASFOOT",
        street: "Av. Prefeito Alberto Moura",
        number: "2560",
        complement: null,
        district: "Distrito Industrial",
        city: "Sete Lagoas",
        state: "MG",
        zip: "35702051",
      },
      items: w.items.get(orderId) || [],
      quotes: w.dataset.quotes.filter((q) => q.orderId === orderId),
      shipments: w.dataset.shipments
        .filter((s) => s.orderId === orderId)
        .map((s) => ({ ...s, labels: s.waybills.map((wb) => `https://example.com/etiquetas/${wb}.pdf`) })),
    };
  },

  async loadJson(kind, id) {
    await delay(150);
    const request =
      kind === "quote"
        ? { originZipCode: "35702051", destZipCode: "72405610", weight: 133.29, volume: 0.6184, cargoType: 0, id }
        : { customerNumber: `BF${id}`, orderWaybillList: [{ weight: 8.33, length: 33, width: 40, height: 23 }] };
    const response = { code: 200, msg: "success", data: kind === "quote" ? { price: 87.4, duration: 5 } : { orderNumber: `ANJ${id}` } };
    return { request: JSON.stringify(request, null, 2), response: JSON.stringify(response, null, 2) };
  },

  async buttonId() {
    return 62;
  },

  async track(orderId) {
    await delay(700);
    const boxes = getWorld().tracking.get(orderId) || [];
    return boxes.length
      ? { ok: true, message: "Rastreio atualizado.", boxes }
      : { ok: false, message: "Este pedido ainda não tem envio para rastrear.", boxes: [] };
  },

  /* Como a Anjun: cancela só antes da coleta. */
  async cancel(orderId) {
    await delay(800);
    const w = getWorld();
    const s = w.dataset.shipments.find((x) => x.ok && (x.orderId === orderId || x.invoiceId === orderId));
    if (!s) {
      return { ok: false, message: "Este pedido não tem envio ativo para cancelar." };
    }
    if (s.status !== "S") {
      return {
        ok: false,
        message: `A transportadora não cancelou o envio ${s.carrierOrder}: A Anjun não cancelou a caixa ${s.waybills[0]} (já coletado pela Anjun: não pode mais ser cancelado)`,
      };
    }
    markCancelled(s, w.dataset.orders.find((o) => o.id === s.orderId), new Date(), "MATEUS");
    w.tracking.delete(orderId);
    return {
      ok: true,
      message: `Envio ${s.carrierOrder} cancelado na transportadora: as ${s.waybills.length} etiqueta(s) deixam de valer. O pedido pode ser cotado e enviado de novo.`,
    };
  },

  async requote(orderId) {
    await delay(900);
    const last = getWorld().dataset.quotes.find((q) => q.orderId === orderId && q.ok);
    return {
      ok: true,
      message: "Cotação concluída.",
      fee: last?.fee ? Math.round(last.fee * 1.03 * 100) / 100 : 92.1,
      days: last?.days ?? 5,
      chargedWeightKg: last?.chargedWeightKg ?? null,
    };
  },
};
