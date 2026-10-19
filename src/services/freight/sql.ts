import type { Setup } from "./types";

/**
 * Consultas da central (SQL Server). Só SELECT, sem ";" nem CTE: o executeQuery do Sankhya roda
 * uma instrução por vez. Datas saem como texto "yyyy-mm-dd hh:mi:ss" (CONVERT 120) e o período
 * entra como texto "yyyy-mm-dd" convertido no próprio SQL.
 *
 * Cada consulta só cita as tabelas e colunas que existem (Setup), para a central abrir mesmo
 * antes de rodar o botão "Instalar estrutura do frete".
 */

const D = (col: string) => `CONVERT(VARCHAR(19), ${col}, 120)`;

/** Intervalo fechado em dias: [de 00:00, até 23:59:59]. Dois parâmetros "S": de, até. */
const period = (col: string) =>
  `${col} >= CONVERT(DATETIME, ?, 120) AND ${col} < DATEADD(DAY, 1, CONVERT(DATETIME, ?, 120))`;

/** Destinatário do pedido/nota (o de entrega, se houver), com cidade e UF. */
const destination = (cab: string) => `
  LEFT JOIN TGFPAR PAR ON PAR.CODPARC = CASE WHEN ISNULL(${cab}.CODPARCDEST, 0) > 0 THEN ${cab}.CODPARCDEST ELSE ${cab}.CODPARC END
  LEFT JOIN TSICID CID ON CID.CODCID = PAR.CODCID
  LEFT JOIN TSIUFS UFS ON UFS.CODUF = CID.UF`;

export const SETUP_TABLES = `
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
   WHERE TABLE_NAME IN ('AD_FRETECOT', 'AD_FRETEENV', 'AD_FRETECAIXA')`;

export const SETUP_COLUMNS = `
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_NAME = 'TGFCAB' AND COLUMN_NAME LIKE 'AD_FRETE%'`;

/** Reserva, se INFORMATION_SCHEMA não estiver liberado: o dicionário do Sankhya. */
export const SETUP_TABLES_DICTIONARY = `
  SELECT NOMETAB AS TABLE_NAME FROM TDDTAB
   WHERE NOMETAB IN ('AD_FRETECOT', 'AD_FRETEENV', 'AD_FRETECAIXA')`;

export const SETUP_COLUMNS_DICTIONARY = `
  SELECT NOMECAMPO AS COLUMN_NAME FROM TDDCAM
   WHERE NOMETAB = 'TGFCAB' AND NOMECAMPO LIKE 'AD_FRETE%'`;

export const ORDER_COLUMNS = [
  "AD_FRETESTATUS",
  "AD_FRETEVLR",
  "AD_FRETEPRAZO",
  "AD_FRETEDHCOT",
  "AD_FRETECODUSU",
  "AD_FRETETRANSP",
  "AD_FRETERASTREIO",
  "AD_FRETESITUACAO",
  "AD_FRETEDHSIT",
];

const QUOTE_COLUMNS = `
  COT.NUCOT, COT.NUNOTA, COT.CODPARCTRANSP, TRA.NOMEPARC AS TRANSPNOME, ${D("COT.DHCOTACAO")} AS DHCOTACAO,
  USU.NOMEUSU, COT.AMBIENTE, COT.CEPORIGEM, COT.CEPDESTINO, COT.PESO, COT.VOLUMECM3, COT.VLRDECLARADO,
  COT.STATUS, COT.VLRFRETE, COT.PESOCOBRADO, COT.PRAZODIAS, COT.HTTPSTATUS, COT.MENSAGEM, COT.QTDCAIXAS,
  COT.CAIXAS, CAB.NUMNOTA, CAB.TIPMOV, PAR.CODPARC, PAR.NOMEPARC, CID.NOMECID, UFS.UF`;

const QUOTE_FROM = `
  FROM AD_FRETECOT COT
  LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = COT.NUNOTA
  ${destination("CAB")}
  LEFT JOIN TGFPAR TRA ON TRA.CODPARC = COT.CODPARCTRANSP
  LEFT JOIN TSIUSU USU ON USU.CODUSU = COT.CODUSU`;

/** Cotações do período. Parâmetros: de, até. */
export const QUOTES = `
  SELECT TOP 5000 ${QUOTE_COLUMNS}
  ${QUOTE_FROM}
  WHERE ${period("COT.DHCOTACAO")}
  ORDER BY COT.DHCOTACAO DESC`;

/** Todas as cotações destes registros (detalhe do pedido). Lista de NUNOTA embutida. */
export function quotesOf(ids: number[]): string {
  return `
  SELECT TOP 500 ${QUOTE_COLUMNS}
  ${QUOTE_FROM}
  WHERE COT.NUNOTA IN (${intList(ids)})
  ORDER BY COT.DHCOTACAO DESC`;
}

function shipmentColumns(setup: Setup, labels: boolean): string {
  const lastQuote = (col: string) =>
    setup.quotes
      ? `(SELECT TOP 1 C.${col} FROM AD_FRETECOT C WHERE C.STATUS = 'OK'
            AND C.NUNOTA IN (ENV.NUNOTA, ISNULL(ENV.NUNOTAORIG, ENV.NUNOTA)) ORDER BY C.DHCOTACAO DESC)`
      : "NULL";
  return `
  ENV.NUENVIO, ENV.NUNOTA, ENV.NUNOTAORIG, ENV.CODPARCTRANSP, TRA.NOMEPARC AS TRANSPNOME,
  ${D("ENV.DHENVIO")} AS DHENVIO, USU.NOMEUSU, ENV.AMBIENTE, ENV.STATUS, ENV.CUSTOMERNUMBER, ENV.ORDERNUMBER,
  ENV.WAYBILLS, ENV.QTDCAIXAS, ENV.PESO, ENV.HTTPSTATUS, ENV.MENSAGEM, ENV.SITUACAO, ENV.SITUACAODESCR,
  ${D("ENV.DHSITUACAO")} AS DHSITUACAO, ENV.FINALIZADO, ENV.CAIXAS,
  NOTA.NUMNOTA, NOTA.SERIENOTA, NOTA.VLRNOTA, PAR.CODPARC, PAR.NOMEPARC, CID.NOMECID, UFS.UF,
  ${setup.orderColumns ? "NOTA.AD_FRETESTATUS" : "NULL"} AS AD_FRETESTATUS,
  ${lastQuote("VLRFRETE")} AS VLRFRETE, ${lastQuote("PRAZODIAS")} AS PRAZODIAS
  ${labels ? ", CAST(ENV.LABELURLS AS VARCHAR(MAX)) AS LABELURLS" : ""}`;
}

const SHIPMENT_FROM = `
  FROM AD_FRETEENV ENV
  LEFT JOIN TGFCAB NOTA ON NOTA.NUNOTA = ENV.NUNOTA
  ${destination("NOTA")}
  LEFT JOIN TGFPAR TRA ON TRA.CODPARC = ENV.CODPARCTRANSP
  LEFT JOIN TSIUSU USU ON USU.CODUSU = ENV.CODUSU`;

/** Envios do período e os ainda acompanhados (até 90 dias). Parâmetros: de, até. */
export function shipments(setup: Setup): string {
  return `
  SELECT TOP 5000 ${shipmentColumns(setup, false)}
  ${SHIPMENT_FROM}
  WHERE (${period("ENV.DHENVIO")})
     OR (ENV.STATUS = 'OK' AND ISNULL(ENV.FINALIZADO, 'N') = 'N' AND ENV.DHENVIO >= DATEADD(DAY, -90, GETDATE()))
  ORDER BY ENV.DHENVIO DESC`;
}

/** Envios destes registros, com as URLs das etiquetas (detalhe do pedido). */
export function shipmentsOf(setup: Setup, ids: number[]): string {
  const list = intList(ids);
  return `
  SELECT TOP 100 ${shipmentColumns(setup, true)}
  ${SHIPMENT_FROM}
  WHERE ENV.NUNOTA IN (${list}) OR ENV.NUNOTAORIG IN (${list})
  ORDER BY ENV.DHENVIO DESC`;
}

function orderColumns(setup: Setup): string {
  if (!setup.orderColumns) {
    return `NULL AS AD_FRETESTATUS, NULL AS AD_FRETEVLR, NULL AS AD_FRETEPRAZO, NULL AS AD_FRETEDHCOT,
      NULL AS USUCOT, NULL AS AD_FRETETRANSP, NULL AS TRANSPNOME, NULL AS AD_FRETERASTREIO,
      NULL AS AD_FRETESITUACAO, NULL AS AD_FRETEDHSIT`;
  }
  return `CAB.AD_FRETESTATUS, CAB.AD_FRETEVLR, CAB.AD_FRETEPRAZO, ${D("CAB.AD_FRETEDHCOT")} AS AD_FRETEDHCOT,
    USC.NOMEUSU AS USUCOT, CAB.AD_FRETETRANSP, TRA.NOMEPARC AS TRANSPNOME, CAB.AD_FRETERASTREIO,
    CAB.AD_FRETESITUACAO, ${D("CAB.AD_FRETEDHSIT")} AS AD_FRETEDHSIT`;
}

const ORDER_SELECT = (setup: Setup) => `
  CAB.NUNOTA, CAB.NUMNOTA, CAB.SERIENOTA, CAB.TIPMOV, ${D("CAB.DTNEG")} AS DTNEG, CAB.CODEMP, EMP.NOMEFANTASIA,
  PAR.CODPARC, PAR.NOMEPARC, CID.NOMECID, UFS.UF, CAB.VLRNOTA, CAB.PESOBRUTO, CAB.QTDVOL, VEN.APELIDO,
  ${orderColumns(setup)}`;

const ORDER_JOINS = (setup: Setup) => `
  LEFT JOIN TSIEMP EMP ON EMP.CODEMP = CAB.CODEMP
  ${destination("CAB")}
  LEFT JOIN TGFVEN VEN ON VEN.CODVEND = CAB.CODVEND
  ${setup.orderColumns ? "LEFT JOIN TSIUSU USC ON USC.CODUSU = CAB.AD_FRETECODUSU" : ""}
  ${setup.orderColumns ? "LEFT JOIN TGFPAR TRA ON TRA.CODPARC = CAB.AD_FRETETRANSP" : ""}`;

/**
 * Registros cotados ou enviados no período (e os de envios ainda acompanhados). Parâmetros: de,
 * até repetidos uma vez por tabela presente (cotações, envios). null quando não há tabela.
 */
export function orders(setup: Setup): { sql: string; periods: number } | null {
  const parts: string[] = [];
  if (setup.quotes) {
    parts.push(`SELECT NUNOTA FROM AD_FRETECOT WHERE ${period("DHCOTACAO")}`);
  }
  if (setup.shipments) {
    parts.push(`SELECT ISNULL(NUNOTAORIG, NUNOTA) AS NUNOTA FROM AD_FRETEENV
      WHERE (${period("DHENVIO")})
         OR (STATUS = 'OK' AND ISNULL(FINALIZADO, 'N') = 'N' AND DHENVIO >= DATEADD(DAY, -90, GETDATE()))`);
  }
  if (!parts.length) {
    return null;
  }
  return {
    periods: parts.length,
    sql: `
  SELECT TOP 5000 ${ORDER_SELECT(setup)}
  FROM TGFCAB CAB
  JOIN (${parts.join(" UNION ")}) REG ON REG.NUNOTA = CAB.NUNOTA
  ${ORDER_JOINS(setup)}
  ORDER BY CAB.NUNOTA DESC`,
  };
}

/** Um registro (detalhe). Parâmetro: NUNOTA. */
export const order = (setup: Setup) => `
  SELECT ${ORDER_SELECT(setup)}
  FROM TGFCAB CAB
  ${ORDER_JOINS(setup)}
  WHERE CAB.NUNOTA = ?`;

/** Endereços de destino e de origem (empresa). Parâmetro: NUNOTA. */
export const ADDRESSES = `
  SELECT ENDE.NOMEEND, PAR.NUMEND, PAR.COMPLEMENTO, BAI.NOMEBAI, CID.NOMECID, UFS.UF, PAR.CEP,
         EMP.NOMEFANTASIA AS EMPRESA, EEND.NOMEEND AS EMP_NOMEEND, EMP.NUMEND AS EMP_NUMEND,
         EBAI.NOMEBAI AS EMP_NOMEBAI, ECID.NOMECID AS EMP_NOMECID, EUFS.UF AS EMP_UF, EMP.CEP AS EMP_CEP
  FROM TGFCAB CAB
  ${destination("CAB")}
  LEFT JOIN TSIEND ENDE ON ENDE.CODEND = PAR.CODEND
  LEFT JOIN TSIBAI BAI ON BAI.CODBAI = PAR.CODBAI
  LEFT JOIN TSIEMP EMP ON EMP.CODEMP = CAB.CODEMP
  LEFT JOIN TSIEND EEND ON EEND.CODEND = EMP.CODEND
  LEFT JOIN TSIBAI EBAI ON EBAI.CODBAI = EMP.CODBAI
  LEFT JOIN TSICID ECID ON ECID.CODCID = EMP.CODCID
  LEFT JOIN TSIUFS EUFS ON EUFS.CODUF = ECID.UF
  WHERE CAB.NUNOTA = ?`;

/** Itens do registro. Parâmetro: NUNOTA. */
export const ITEMS = `
  SELECT ITE.SEQUENCIA, ITE.CODPROD, PRO.DESCRPROD, ITE.QTDNEG, ITE.CODVOL, ITE.VLRUNIT, ITE.VLRTOT, PRO.PESOBRUTO
  FROM TGFITE ITE
  JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
  WHERE ITE.NUNOTA = ?
  ORDER BY ITE.SEQUENCIA`;

export const BOXES = `
  SELECT CODCAIXA, NOME, COMPRIMENTO, LARGURA, ALTURA, PESO, ATIVO, ORDEM
  FROM AD_FRETECAIXA
  ORDER BY ISNULL(ORDEM, 9999), CODCAIXA`;

export function carriers(ids: number[]): string {
  return `
  SELECT PAR.CODPARC, PAR.NOMEPARC, PAR.RAZAOSOCIAL, PAR.CGC_CPF, CID.NOMECID, UFS.UF
  FROM TGFPAR PAR
  LEFT JOIN TSICID CID ON CID.CODCID = PAR.CODCID
  LEFT JOIN TSIUFS UFS ON UFS.CODUF = CID.UF
  WHERE PAR.CODPARC IN (${intList(ids)})`;
}

/** JSON trocado com a transportadora numa cotação (NUCOT) ou num envio (NUENVIO). */
export const QUOTE_JSON = `
  SELECT CAST(REQUESTJSON AS VARCHAR(MAX)) AS REQ, CAST(RESPONSEJSON AS VARCHAR(MAX)) AS RESP
  FROM AD_FRETECOT WHERE NUCOT = ?`;

export const SHIPMENT_JSON = `
  SELECT CAST(REQUESTJSON AS VARCHAR(MAX)) AS REQ, CAST(RESPONSEJSON AS VARCHAR(MAX)) AS RESP
  FROM AD_FRETEENV WHERE NUENVIO = ?`;

/** Botão "Cotar frete" (Rotina Java do módulo): a central chama o mesmo botão para rastrear e recotar. */
export const BUTTON = `
  SELECT TOP 1 IDBTNACAO, DESCRICAO FROM TSIBTA
  WHERE TIPO = 'RJ' AND CAST(CAST(CONFIG AS VARBINARY(MAX)) AS VARCHAR(MAX)) LIKE '%FreightQuoteAction%'
  ORDER BY IDBTNACAO`;

export const BUTTON_TEXT = `
  SELECT TOP 1 IDBTNACAO, DESCRICAO FROM TSIBTA
  WHERE TIPO = 'RJ' AND CONFIG LIKE '%FreightQuoteAction%'
  ORDER BY IDBTNACAO`;

/** Lista de inteiros validada para IN (...): nunca texto vindo de fora. */
export function intList(ids: number[]): string {
  const clean = ids.map((v) => Math.trunc(Number(v))).filter((v) => Number.isFinite(v) && v > 0);
  return clean.length ? Array.from(new Set(clean)).join(", ") : "0";
}
