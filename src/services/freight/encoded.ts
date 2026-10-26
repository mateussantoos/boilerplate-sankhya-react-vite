/**
 * Texto livre que sai do SQL em Base64.
 *
 * O executeQuery nativo do Sankhya monta o JSON da resposta sem escapar aspas, barras nem
 * quebras de linha. Em produção (26/10/2026) o JSON da cotação nº 34 ({"senderZipCode":…})
 * quebrou o visualizador com "Expected ',' or '}' after property value in JSON". Pelo mesmo
 * motivo, um nome de cliente com aspas derrubaria a lista inteira.
 *
 * Por isso nomes, endereços, mensagens, JSON e URLs saem do SQL como Base64 do UTF-16LE, com o
 * alias prefixado por B64_ (encoded()). source.ts devolve cada um com o nome sem o prefixo
 * (decodeRow). O Base64 só tem letras, dígitos, "+", "/" e "=", nada que quebre o JSON.
 */

export const ENCODED_PREFIX = "B64_";

/** Coluna de texto em Base64: `(SELECT … FOR XML PATH(''), BINARY BASE64) AS B64_<alias>`. */
export function encoded(expr: string, alias: string): string {
  return `(SELECT CAST(CAST(${expr} AS NVARCHAR(MAX)) AS VARBINARY(MAX)) FOR XML PATH(''), BINARY BASE64) AS ${ENCODED_PREFIX}${alias}`;
}

/** Base64 de UTF-16LE → texto. NULL do banco chega como "" (o FOR XML não devolve NULL). */
export function decodeText(v: unknown): string | null {
  if (v == null) {
    return null;
  }
  const bin = atob(String(v));
  let out = "";
  for (let i = 0; i + 1 < bin.length; i += 2) {
    out += String.fromCharCode(bin.charCodeAt(i) | (bin.charCodeAt(i + 1) << 8));
  }
  return out;
}

/** Troca cada coluna B64_X pela coluna X já decodificada. */
export function decodeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.toUpperCase().startsWith(ENCODED_PREFIX)) {
      out[key.slice(ENCODED_PREFIX.length)] = decodeText(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}
