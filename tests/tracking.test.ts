import { describe, expect, it } from "vitest";
import { staleTracking } from "@/services/freight/analytics";
import { parseDate } from "@/services/freight/format";
import { newestFirst, toTracking } from "@/services/freight/java";
import type { Shipment } from "@/services/freight/types";

/**
 * Caixa AJGP2610271060028001 da nota 785098, como o módulo 2.5.1 mandou em 09/11/2026: datas da Anjun
 * em dia-mês-ano e eventos na ordem do texto da data (a entrega por último).
 */
const MODULE_ORDER = [
  { when: "31-10-2026 07:25:40", label: "Chegou à agência local", code: "delivery_site_in_storage" },
  { when: "30-10-2026 22:31:02", label: "Chegou ao centro de distribuição", code: "transfer_in_storage" },
  { when: "29-10-2026 08:57:08", label: "Saiu do centro de distribuição", code: "transfer_out_storage" },
  { when: "28-10-2026 11:05:38", label: "Chegou ao centro de distribuição", code: "transfer_in_storage" },
  { when: "28-10-2026 08:28:23", label: "Saiu do centro de distribuição", code: "transfer_out_storage" },
  { when: "28-10-2026 08:19:43", label: "Pacote coletado", code: "collected" },
  { when: "03-11-2026 14:42:45", label: "Entregue", code: "signed" },
  { when: "02-11-2026 12:19:03", label: "Em rota de entrega", code: "delivering" },
];

describe("datas do rastreio da Anjun (dd-mm-aaaa)", () => {
  it("03-11-2026 é 3 de novembro, não 11 de março", () => {
    expect(parseDate("03-11-2026 14:42:45")).toEqual(new Date(2026, 10, 3, 14, 42, 45));
  });

  it("31-10-2026 é uma data válida (antes virava “—”)", () => {
    expect(parseDate("31-10-2026 07:25:40")).toEqual(new Date(2026, 9, 31, 7, 25, 40));
  });

  it("os outros formatos continuam", () => {
    expect(parseDate("2026-11-03 14:42:45")).toEqual(new Date(2026, 10, 3, 14, 42, 45));
    expect(parseDate("03/11/2026 14:42")).toEqual(new Date(2026, 10, 3, 14, 42, 0));
    expect(parseDate("03/11/2026")).toEqual(new Date(2026, 10, 3));
    expect(parseDate(null)).toBeNull();
    expect(parseDate("ontem")).toBeNull();
  });
});

describe("ordem do trajeto", () => {
  it("nota 785098: entrega primeiro, coleta por último", () => {
    expect(newestFirst(MODULE_ORDER).map((e) => e.code)).toEqual([
      "signed",
      "delivering",
      "delivery_site_in_storage",
      "transfer_in_storage",
      "transfer_out_storage",
      "transfer_in_storage",
      "transfer_out_storage",
      "collected",
    ]);
  });

  it("evento sem data vai para o fim, na ordem em que veio", () => {
    const events = [{ when: null, n: 1 }, { when: "01-11-2026 10:00:00", n: 2 }, { when: "", n: 3 }, { when: "02-11-2026 10:00:00", n: 4 }];
    expect(newestFirst(events).map((e) => e.n)).toEqual([4, 2, 1, 3]);
  });

  it("toTracking ordena a resposta do RASTREAR", () => {
    const reply = {
      ok: true,
      orders: [{ id: 785098, tracking: [{ waybill: "AJGP2610271060028001", label: "Entregue", status: "E", events: MODULE_ORDER }] }],
    };
    const r = toTracking(reply, 785098);
    expect(r.ok).toBe(true);
    expect(r.boxes[0].events[0]).toMatchObject({ label: "Entregue", when: "03-11-2026 14:42:45" });
    expect(r.boxes[0].events.at(-1)).toMatchObject({ label: "Pacote coletado" });
  });
});

describe("rastreio parado (ação agendada)", () => {
  const now = new Date(2026, 10, 9, 11, 39);
  const shipment = (id: number, last: Date | null, finished = false): Shipment =>
    ({ id, ok: true, finished, when: new Date(2026, 9, 27), situationWhen: last }) as Shipment;

  it("nota 785098: última consulta em 27/10 → parado", () => {
    const list = [shipment(3, new Date(2026, 9, 27, 17, 32)), shipment(5, new Date(2026, 10, 9, 9, 0))];
    expect(staleTracking(list, now).map((s) => s.id)).toEqual([3]);
  });

  it("finalizado não conta; sem consulta usa a data do envio", () => {
    expect(staleTracking([shipment(1, new Date(2026, 9, 27), true), shipment(2, null)], now).map((s) => s.id)).toEqual([2]);
  });

  it("com a ação agendada rodando (consulta a cada 2 h), nada fica parado", () => {
    expect(staleTracking([shipment(4, new Date(2026, 10, 9, 10, 0))], now)).toEqual([]);
  });
});
