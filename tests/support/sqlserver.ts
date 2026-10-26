import { execFile } from "node:child_process";
import type { SankhyaQueryParam } from "@/types/global";

/**
 * SQL Server de teste num container Docker. Para subir:
 *   docker run -d --name central-fretes-sql -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=Central#Fretes1
 *     -e MSSQL_COLLATION=Latin1_General_CI_AI mcr.microsoft.com/mssql/server:2019-latest
 * Sem o container, os testes de SQL são pulados (os de unidade rodam igual).
 */
const CONTAINER = process.env.CENTRAL_SQL_CONTAINER ?? "central-fretes-sql";
const PASSWORD = process.env.CENTRAL_SQL_PASSWORD ?? "Central#Fretes1";
const SQLCMD = "/opt/mssql-tools18/bin/sqlcmd";

export const DATABASE = "CENTRALFRETES_TESTE";

export type Row = Record<string, unknown>;

/** Roda um script no container (UTF-8, sem variáveis do sqlcmd, para no primeiro erro). */
export function sqlcmd(script: string, database = "master"): Promise<string> {
  const args = ["exec", "-i", CONTAINER, SQLCMD, "-S", "localhost", "-U", "sa", "-P", PASSWORD, "-C"];
  args.push("-b", "-x", "-f", "65001", "-y", "0", "-d", database, "-i", "/dev/stdin");
  return new Promise((resolve, reject) => {
    const child = execFile("docker", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) =>
      err ? reject(new Error(`${stdout}${stderr}`.trim() || err.message)) : resolve(stdout)
    );
    child.stdin?.end(script);
  });
}

export async function sqlServerReady(): Promise<boolean> {
  try {
    return (await sqlcmd("SET NOCOUNT ON; SELECT N'@@OK'")).includes("@@OK");
  } catch {
    return false;
  }
}

/** Linhas da consulta, lidas por FOR JSON (escapado pelo próprio SQL Server). Com -y 0 o valor vem inteiro. */
export async function select(sql: string): Promise<Row[]> {
  const out = await sqlcmd(
    `SET NOCOUNT ON;\nDECLARE @j NVARCHAR(MAX) = (${sql}\nFOR JSON PATH, INCLUDE_NULL_VALUES);\nSELECT N'@@' + ISNULL(@j, N'[]');`,
    DATABASE
  );
  const at = out.indexOf("@@");
  if (at < 0) {
    throw new Error(`Sem resultado do sqlcmd: ${out}`);
  }
  return JSON.parse(out.slice(at + 2).trim()) as Row[];
}

/** Liga os "?" na ordem, como o executeQuery nativo faz no servidor. */
export function bind(sql: string, params: SankhyaQueryParam[]): string {
  let i = 0;
  const out = sql.replace(/\?/g, () => {
    const p = params[i++];
    if (!p) {
      throw new Error(`Falta o parâmetro #${i} da consulta`);
    }
    return p.type === "I" || p.type === "F" ? String(Number(p.value)) : sqlText(String(p.value));
  });
  if (i !== params.length) {
    throw new Error(`A consulta tem ${i} "?" e recebeu ${params.length} parâmetros`);
  }
  return out;
}

/**
 * O pior caso do executeQuery nativo: monta o JSON concatenando os valores, sem escapar aspas,
 * barras nem quebras de linha. Foi o que quebrou o JSON da cotação nº 34 em produção.
 */
export function nativeJson(rows: Row[]): string {
  const value = (v: unknown) => (v == null ? "null" : typeof v === "number" ? String(v) : `"${String(v)}"`);
  return `[${rows.map((r) => `{${Object.entries(r).map(([k, v]) => `"${k}":${value(v)}`).join(",")}}`).join(",")}]`;
}

/** window.executeQuery falso: roda o SQL no container e devolve o texto como o nativo (sem escape). */
export function fakeNativeExecuteQuery(log: string[] = []) {
  return (sql: string, params: SankhyaQueryParam[], ok: (value: string) => void, fail: (e: unknown) => void) => {
    log.push(sql);
    let bound: string;
    try {
      bound = bind(sql, params);
    } catch (e) {
      fail(e);
      return;
    }
    select(bound).then((rows) => ok(nativeJson(rows)), fail);
  };
}

/** Literal NVARCHAR(MAX): aspas simples dobradas e quebras de linha/tabulação por NCHAR(). */
export function sqlText(s: string): string {
  const parts = s.split(/([\r\n\t])/).filter((p) => p !== "");
  return ["CAST(N'' AS NVARCHAR(MAX))", ...parts.map((p) => (/^[\r\n\t]$/.test(p) ? `NCHAR(${p.charCodeAt(0)})` : `N'${p.replace(/'/g, "''")}'`))].join(" + ");
}

/** INSERT a partir de objetos; { sql } entra cru (ex.: GETDATE()). */
export function insert(table: string, rows: Record<string, unknown>[]): string {
  return rows
    .map((r) => {
      const cols = Object.keys(r);
      const values = cols.map((c) => {
        const v = r[c];
        if (v == null) return "NULL";
        if (typeof v === "number") return String(v);
        if (typeof v === "object" && "sql" in v) return String((v as { sql: string }).sql);
        return sqlText(String(v));
      });
      return `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${values.join(", ")});`;
    })
    .join("\n");
}
