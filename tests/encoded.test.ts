import { describe, expect, it } from "vitest";
import { decodeRow, decodeText, encoded } from "@/services/freight/encoded";
import { nativeJson } from "./support/sqlserver";

/** O que o FOR XML … BINARY BASE64 devolve para um NVARCHAR (UTF-16LE). */
const sqlBase64 = (s: string) => Buffer.from(s, "utf16le").toString("base64");

describe("texto em Base64 (encoded.ts)", () => {
  it("decodifica o UTF-16LE do SQL Server", () => {
    for (const s of ['{"a":"SÃO JOSÉ"}\n\tx\\y', 'COMERCIAL "BOLA" LTDA', "çãõ ÀÉÍ ü ñ", "emoji ⚽ 🚚", "a", ""]) {
      expect(decodeText(sqlBase64(s))).toBe(s);
    }
  });

  it("NULL do banco continua null", () => {
    expect(decodeText(null)).toBeNull();
    expect(decodeText(undefined)).toBeNull();
  });

  it("decodifica o mesmo valor que o SQL Server 2019 gerou", () => {
    // SELECT … FOR XML PATH(''), BINARY BASE64 sobre '{"a":"SÃO JOSÉ"}' + CHAR(10) + CHAR(9) + 'x\y'
    expect(decodeText("ewAiAGEAIgA6ACIAUwDDAE8AIABKAE8AUwDJACIAfQAKAAkAeABcAHkA")).toBe('{"a":"SÃO JOSÉ"}\n\tx\\y');
  });

  it("decodeRow troca B64_X por X e mantém o resto", () => {
    const row = { NUCOT: 34, B64_MENSAGEM: sqlBase64('erro "x"'), b64_nomeparc: sqlBase64("JOÃO"), STATUS: "OK" };
    expect(decodeRow(row)).toEqual({ NUCOT: 34, MENSAGEM: 'erro "x"', nomeparc: "JOÃO", STATUS: "OK" });
  });

  it("Base64 sobrevive ao JSON sem escape do executeQuery nativo", () => {
    const text = '{"senderZipCode":"35702051"}\n\t"fim" \\ ok';
    expect(() => JSON.parse(nativeJson([{ REQ: text }]))).toThrow(/Expected ',' or '}' after property value/);
    const parsed = JSON.parse(nativeJson([{ B64_REQ: sqlBase64(text) }]));
    expect(parsed.map(decodeRow)).toEqual([{ REQ: text }]);
  });

  it("monta a coluna com o alias prefixado", () => {
    expect(encoded("COT.MENSAGEM", "MENSAGEM")).toBe(
      "(SELECT CAST(CAST(COT.MENSAGEM AS NVARCHAR(MAX)) AS VARBINARY(MAX)) FOR XML PATH(''), BINARY BASE64) AS B64_MENSAGEM"
    );
  });
});
