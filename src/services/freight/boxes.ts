import type { BoxType } from "./types";

/**
 * Caixas no formato gravado pelo módulo (BoxSpec.java): grupos "Qtd x C x L x A[:CODCAIXA]"
 * separados por ";". Com código, é caixa padrão da AD_FRETECAIXA; sem, é avulsa.
 * Ex.: "11x33x40x23:11;1x32x24x19" → 11 Germer + 1 avulsa.
 */
export interface BoxGroup {
  quantity: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  code: number | null;
}

export function parseBoxes(textValue: string | null | undefined): BoxGroup[] {
  const out: BoxGroup[] = [];
  for (const raw of String(textValue || "").split(";")) {
    let g = raw.trim();
    if (!g) {
      continue;
    }
    let code: number | null = null;
    const k = g.indexOf(":");
    if (k >= 0) {
      const c = Number(g.slice(k + 1).trim());
      code = Number.isNaN(c) ? null : c;
      g = g.slice(0, k);
    }
    const p = g
      .toLowerCase()
      .split(/\s*[x*]\s*/)
      .map((v) => Number(v.replace(",", ".")));
    if (p.length === 4 && p.every((v) => !Number.isNaN(v))) {
      out.push({ quantity: p[0], lengthCm: p[1], widthCm: p[2], heightCm: p[3], code });
    }
  }
  return out;
}

export function boxTotal(groups: BoxGroup[]): number {
  return groups.reduce((s, g) => s + g.quantity, 0);
}

export function boxVolumeCm3(groups: BoxGroup[]): number {
  return groups.reduce((s, g) => s + g.quantity * g.lengthCm * g.widthCm * g.heightCm, 0);
}

/** "11 Germer, 1 G, 2 R, 2 avulsas" (nomes do catálogo; código sem cadastro vira "caixa N"). */
export function describeBoxes(groups: BoxGroup[], catalog: BoxType[]): string {
  const names: string[] = [];
  const counts = new Map<string, number>();
  let custom = 0;
  for (const g of groups) {
    if (g.code == null) {
      custom += g.quantity;
      continue;
    }
    const name = catalog.find((b) => b.id === g.code)?.name ?? `caixa ${g.code}`;
    if (!counts.has(name)) {
      names.push(name);
    }
    counts.set(name, (counts.get(name) || 0) + g.quantity);
  }
  const parts = names.map((n) => `${counts.get(n)} ${n}`);
  if (custom) {
    parts.push(`${custom} ${custom === 1 ? "avulsa" : "avulsas"}`);
  }
  return parts.join(", ");
}

/** Lado acima de 170 cm ou C + L + A acima de 240 cm: carga de grande porte (regra da Anjun). */
export function isLarge(groups: BoxGroup[]): boolean {
  return groups.some(
    (g) =>
      g.lengthCm > 170 ||
      g.widthCm > 170 ||
      g.heightCm > 170 ||
      g.lengthCm + g.widthCm + g.heightCm > 240
  );
}
