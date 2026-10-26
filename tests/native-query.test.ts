import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sankhyaService } from "@/services/sankhya";
import * as SQL from "@/services/freight/sql";
import { sankhyaSource } from "@/services/freight/source";
import {
  BUTTON_ID,
  CARRIER_ID,
  createSankhyaBase,
  INVOICE_ID,
  ORDER_ID,
  QUOTE_34,
  SHIPMENT_ID,
  T,
} from "./support/sankhya-base";
import { bind, DATABASE, fakeNativeExecuteQuery, select, sqlcmd, sqlServerReady } from "./support/sqlserver";

/**
 * A central de ponta a ponta contra um SQL Server de verdade (Docker), com um executeQuery
 * nativo falso que monta o JSON sem escapar nada: database.ts → source.ts → mapeadores.
 */
const ready = await sqlServerReady();
if (!ready) {
  console.warn("[testes] SQL Server de teste indisponível: suba o container (tests/support/sqlserver.ts)");
}

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const filters = { from: day(-30), to: day(1), carrier: "all", environment: "all" as const };

/** Como estava até a 1.1.1: o JSON da coluna ia cru para o executeQuery nativo. */
const OLD_QUOTE_JSON = `
  SELECT CAST(REQUESTJSON AS VARCHAR(MAX)) AS REQ, CAST(RESPONSEJSON AS VARCHAR(MAX)) AS RESP
  FROM AD_FRETECOT WHERE NUCOT = ?`;

describe.skipIf(!ready)("consultas da central no SQL Server, pelo executeQuery nativo", () => {
  const log: string[] = [];
  const g = globalThis as unknown as { window?: unknown };

  beforeAll(async () => {
    await createSankhyaBase();
    g.window = { executeQuery: fakeNativeExecuteQuery(log) };
  });

  afterAll(() => {
    delete g.window;
  });

  it("reproduz o erro de produção com a consulta antiga do JSON", async () => {
    await expect(sankhyaService.executeQuery(OLD_QUOTE_JSON, [{ value: 34, type: "I" }])).rejects.toThrow(
      /Expected ',' or '}' after property value in JSON/
    );
    log.length = 0;
  });

  it("visualizador de JSON: cotação nº 34 volta idêntica ao gravado", async () => {
    expect(await sankhyaSource.loadJson("quote", 34)).toEqual({
      request: QUOTE_34.request,
      response: QUOTE_34.response,
    });
  });

  it("visualizador de JSON: envio com aspas escapadas, barra e quebra de linha", async () => {
    const json = await sankhyaSource.loadJson("shipment", SHIPMENT_ID);
    expect(json).toEqual({ request: T.shipmentRequest, response: T.shipmentResponse });
    expect(JSON.parse(json.request!).receiver.name).toBe(T.customer);
  });

  it("visualizador de JSON: registro inexistente volta vazio, sem erro", async () => {
    expect(await sankhyaSource.loadJson("quote", 999)).toEqual({ request: null, response: null });
  });

  it("listas: nomes, mensagens e situações com aspas chegam inteiros", async () => {
    const data = await sankhyaSource.loadDataset(filters);
    expect(data.setup).toEqual({ quotes: true, shipments: true, boxes: true, orderColumns: true });

    const q34 = data.quotes.find((q) => q.id === 34)!;
    expect(q34).toMatchObject({ ok: true, fee: 182.4, days: 10, message: QUOTE_34.message, customer: T.customer });
    expect(q34.carrierName).toBe(T.carrier);
    expect(data.quotes.find((q) => q.id === 35)).toMatchObject({ ok: false, message: T.quoteError });

    expect(data.shipments).toHaveLength(1);
    expect(data.shipments[0]).toMatchObject({
      id: SHIPMENT_ID,
      orderId: ORDER_ID,
      invoiceId: INVOICE_ID,
      customer: T.customer,
      carrierName: T.carrier,
      message: T.shipmentMessage,
      situation: T.situation,
      waybills: ["AJ123-1", "AJ123-2"],
    });

    const order = data.orders.find((o) => o.id === ORDER_ID)!;
    expect(order).toMatchObject({ customer: T.customer, seller: T.seller, company: T.company });
    expect(order).toMatchObject({ carrierName: T.carrier, situation: T.orderSituation });

    expect(data.boxes.map((b) => b.name)).toEqual(["Neo", T.box]);
    expect(data.carriers.find((c) => c.id === CARRIER_ID)).toMatchObject({
      name: T.carrier,
      legalName: T.carrierLegal,
    });
  });

  it("detalhe do pedido: endereço, itens, etiquetas e cotações", async () => {
    const data = await sankhyaSource.loadDataset(filters);
    const detail = await sankhyaSource.loadOrderDetail(ORDER_ID, data.setup);
    expect(detail.destination).toMatchObject({ street: T.street, complement: T.complement, district: T.district });
    expect(detail.origin).toMatchObject({ company: T.company, street: T.companyStreet, district: T.companyDistrict });
    expect(detail.items).toEqual([expect.objectContaining({ description: T.product, quantity: 12 })]);
    expect(detail.shipments[0].labels).toEqual(T.labels);
    expect(detail.quotes.map((q) => q.id).sort()).toEqual([34, 35]);
  });

  it("acha o botão Cotar frete", async () => {
    expect(await sankhyaSource.buttonId()).toBe(BUTTON_ID);
  });

  it("toda consulta da central roda no SQL Server", async () => {
    const setup = { quotes: true, shipments: true, boxes: true, orderColumns: true };
    const bare = { quotes: false, shipments: false, boxes: false, orderColumns: false };
    const I = (value: number) => ({ value, type: "I" as const });
    const S = (value: string) => ({ value, type: "S" as const });
    const range = [S(filters.from), S(filters.to)];
    const queries: [string, string, ReturnType<typeof I | typeof S>[]][] = [
      ["SETUP_TABLES", SQL.SETUP_TABLES, []],
      ["SETUP_COLUMNS", SQL.SETUP_COLUMNS, []],
      ["SETUP_TABLES_DICTIONARY", SQL.SETUP_TABLES_DICTIONARY, []],
      ["SETUP_COLUMNS_DICTIONARY", SQL.SETUP_COLUMNS_DICTIONARY, []],
      ["QUOTES", SQL.QUOTES, range],
      ["quotesOf", SQL.quotesOf([ORDER_ID, INVOICE_ID]), []],
      ["shipments", SQL.shipments(setup), range],
      ["shipments (sem cotações)", SQL.shipments({ ...setup, quotes: false, orderColumns: false }), range],
      ["shipmentsOf", SQL.shipmentsOf(setup, [ORDER_ID]), []],
      ["orders", SQL.orders(setup)!.sql, [...range, ...range]],
      ["order", SQL.order(setup), [I(ORDER_ID)]],
      ["order (sem colunas AD_FRETE)", SQL.order(bare), [I(ORDER_ID)]],
      ["ADDRESSES", SQL.ADDRESSES, [I(ORDER_ID)]],
      ["ITEMS", SQL.ITEMS, [I(ORDER_ID)]],
      ["BOXES", SQL.BOXES, []],
      ["carriers", SQL.carriers([CARRIER_ID, 5001]), []],
      ["QUOTE_JSON", SQL.QUOTE_JSON, [I(34)]],
      ["SHIPMENT_JSON", SQL.SHIPMENT_JSON, [I(SHIPMENT_ID)]],
      ["BUTTON_TEXT", SQL.BUTTON_TEXT, []],
    ];
    for (const [name, sql, params] of queries) {
      const rows = await select(bind(sql.replace(/(\r\n|\n|\r)/gm, " "), params)).catch((e: Error) => {
        throw new Error(`${name}: ${e.message}`);
      });
      expect(rows.length, name).toBeGreaterThan(0);
    }
    expect(SQL.orders(bare)).toBeNull();
  });

  it("nenhuma consulta manda texto livre cru ao executeQuery nativo", () => {
    const raw = /\b(NOMEPARC|RAZAOSOCIAL|MENSAGEM|SITUACAODESCR|AD_FRETESITUACAO|LABELURLS|REQUESTJSON|RESPONSEJSON|DESCRPROD|NOMEEND|COMPLEMENTO|NOMEBAI|APELIDO|NOMEFANTASIA)\b/g;
    for (const sql of log) {
      const outside = sql.replace(/\(SELECT CAST\(CAST\([^()]+ AS NVARCHAR\(MAX\)\) AS VARBINARY\(MAX\)\) FOR XML PATH\(''\), BINARY BASE64\)/g, "");
      expect(outside.match(raw), sql).toBeNull();
    }
    expect(log.length).toBeGreaterThan(10);
  });

  it("acha o botão também com o CONFIG binário (IMAGE)", async () => {
    await sqlcmd(
      `DROP TABLE TSIBTA;
       CREATE TABLE TSIBTA (IDBTNACAO INT PRIMARY KEY, DESCRICAO VARCHAR(100), TIPO VARCHAR(2), CONFIG IMAGE);
       GO
       INSERT INTO TSIBTA VALUES (${BUTTON_ID}, 'Cotar frete', 'RJ',
         CAST('<javaCall className="br.com.brasfoot.freight.action.FreightQuoteAction"/>' AS VARBINARY(MAX)));`,
      DATABASE
    );
    expect(await select(SQL.BUTTON)).toEqual([{ IDBTNACAO: BUTTON_ID }]);
  });
});
