import { getCookie } from "@/services/sankhya/utils";
import { num, text } from "./format";
import { asStatus } from "./status";
import type { BoxTracking, QuoteReply, TrackingReply } from "./types";

/**
 * Chamadas ao botão "Cotar frete" do módulo (Rotina Java FreightQuoteAction), do mesmo jeito que o
 * pop-up faz: ActionButtonsSP.executeJava com o comando no parâmetro CODTRANSP
 * ("0|ACAO=RASTREAR|NUNOTA=776934"). O Java responde "FRETEJSON:" + JSON na mensagem de retorno
 * (às vezes em Base64).
 *
 * Uma chamada por vez: o Sankhya cancela requisições simultâneas da mesma sessão ("situação de
 * concorrência"); se mesmo assim vier esse aviso, a chamada é repetida até 2 vezes.
 */

const MARK = "FRETEJSON:";
const RETRIES = 2;

let queue: Promise<unknown> = Promise.resolve();

function decode64(s: string): string | null {
  if (!/^[A-Za-z0-9+/=\s]{16,}$/.test(s)) {
    return null;
  }
  try {
    const bin = atob(s.replace(/\s/g, ""));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

function findReply(node: unknown): string | null {
  if (typeof node === "string") {
    const t = node.includes(MARK) ? node : decode64(node);
    const i = t ? t.indexOf(MARK) : -1;
    return i < 0 || !t ? null : t.slice(i + MARK.length);
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) {
      const r = findReply(v);
      if (r != null) {
        return r;
      }
    }
  }
  return null;
}

function statusMessage(resp: any): string | null {
  const m = resp && (resp.statusMessage || resp.responseBody?.statusMessage);
  return m ? decode64(m) || m : null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send(buttonId: number, command: string, orderId: number, attempt = 0): Promise<any> {
  const session = getCookie("JSESSIONID").replace(/\..*/, "");
  const url =
    `${window.location.origin}/mge/service.sbr?serviceName=ActionButtonsSP.executeJava&outputType=json` +
    (session ? `&mgeSession=${session}` : "");
  const body = {
    serviceName: "ActionButtonsSP.executeJava",
    requestBody: {
      javaCall: {
        actionID: String(buttonId),
        refreshType: "NONE",
        masterEntityName: "CabecalhoNota",
        params: { param: [{ type: "S", paramName: "CODTRANSP", $: command }] },
        rows: { row: [{ field: [{ fieldName: "NUNOTA", $: String(orderId) }] }] },
      },
    },
    clientEventList: { clientEvent: [{ $: "br.com.sankhya.actionbutton.clientconfirm" }] },
  };
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  const reply = findReply(json);
  if (reply != null) {
    return JSON.parse(reply);
  }
  const message = statusMessage(json);
  if (attempt < RETRIES && /concorr/i.test(message || "")) {
    await wait(600 * (attempt + 1));
    return send(buttonId, command, orderId, attempt + 1);
  }
  console.warn("[central-frete] resposta sem FRETEJSON", json);
  throw new Error(message || "O Sankhya não devolveu o resultado do botão Cotar frete.");
}

/** Executa um comando no botão, na fila. */
export function callButton(buttonId: number, command: string, orderId: number): Promise<any> {
  const p = queue.then(() => send(buttonId, command, orderId));
  queue = p.catch(() => null);
  return p;
}

/** Resposta do RASTREAR → caixas com o trajeto (eventos mais recentes primeiro). */
export function toTracking(reply: any, orderId: number): TrackingReply {
  const order =
    (reply?.orders || []).find((o: any) => String(o.id) === String(orderId)) || (reply?.orders || [])[0];
  const boxes: BoxTracking[] = (order?.tracking || []).map((t: any) => ({
    waybill: String(t.waybill ?? ""),
    label: text(t.label) || "Sem movimentação",
    status: asStatus(t.status) || "S",
    events: (t.events || []).map((e: any) => ({
      when: text(e.when),
      label: text(e.label) || "—",
      place: text(e.place),
      problem: text(e.problem),
      code: text(e.code),
    })),
  }));
  return {
    ok: !!reply?.ok,
    message: text(reply?.message) || text(reply?.error),
    boxes,
  };
}

/** Resposta do COTAR → resultado da nova cotação. */
export function toQuoteReply(reply: any, orderId: number): QuoteReply {
  const order =
    (reply?.orders || []).find((o: any) => String(o.id) === String(orderId)) || (reply?.orders || [])[0];
  const run = order?.run || {};
  return {
    ok: !!reply?.ok && !!run.ok,
    message: text(reply?.message) || text(reply?.error) || text(run.message),
    fee: num(run.fee),
    days: num(run.days),
    chargedWeightKg: num(run.weight),
  };
}
