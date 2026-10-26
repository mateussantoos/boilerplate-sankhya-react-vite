/**
 * Etiquetas em A4: todas as etiquetas de um envio num PDF só, 4 por folha (2 × 2), para imprimir
 * em impressora comum.
 *
 * A etiqueta da Anjun é um PDF de uma página com 100 × 150 mm (Zebra 4" × 6", 283 × 427 pt). Quatro
 * delas não cabem nos 297 mm de altura do A4, então saem a ~95% (≈ 95 × 143 mm), sem cortar nada.
 * A Anjun aceita a redução desde que a etiqueta saia inteira (Higor, 26/10/2026).
 *
 * O PDF é montado no navegador: as etiquetas vêm direto do armazenamento da Anjun (CORS liberado) e
 * o pdf-lib só é carregado no clique. O pop-up do módulo faz a mesma conta (frete-etiquetas.js).
 */

import type { PDFEmbeddedPage, PDFPage } from "pdf-lib";

const MM = 72 / 25.4;

export const A4 = {
  width: 595.28,
  height: 841.89,
  /** Margem externa: 4 mm, dentro da área que as impressoras imprimem. */
  margin: 4 * MM,
  /** Espaço entre as etiquetas, com a linha de corte no meio: 2 mm. */
  gap: 2 * MM,
};

export interface Slot {
  /** Folha (0, 1…). */
  page: number;
  /** Canto inferior esquerdo, em pt. */
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
}

/** Posição de cada etiqueta (tamanho em pt): da esquerda para a direita, de cima para baixo. */
export function a4Slots(sizes: { width: number; height: number }[]): Slot[] {
  const cellW = (A4.width - 2 * A4.margin - A4.gap) / 2;
  const cellH = (A4.height - 2 * A4.margin - A4.gap) / 2;
  return sizes.map((size, i) => {
    const scale = Math.min(1, cellW / size.width, cellH / size.height);
    const width = size.width * scale;
    const height = size.height * scale;
    const col = i % 2;
    const row = Math.floor(i / 2) % 2;
    const top = A4.height - A4.margin - row * (cellH + A4.gap);
    return {
      page: Math.floor(i / 4),
      x: A4.margin + col * (cellW + A4.gap) + (cellW - width) / 2,
      y: top - (cellH + height) / 2,
      scale,
      width,
      height,
    };
  });
}

export interface LabelsA4 {
  bytes: Uint8Array;
  labels: number;
  pages: number;
}

/**
 * Baixa as etiquetas (na ordem das caixas) e monta o A4. Etiqueta com mais de uma página ocupa um
 * lugar por página. Falha em qualquer etiqueta: erro com o número dela, sem arquivo pela metade.
 */
export async function labelsA4(urls: string[], fetcher: typeof fetch = fetch): Promise<LabelsA4> {
  if (!urls.length) {
    throw new Error("Este envio não tem etiquetas.");
  }
  const { PDFDocument, rgb } = await import("pdf-lib");
  const files = await Promise.all(
    urls.map(async (url, i) => {
      let r: Response;
      try {
        r = await fetcher(url);
      } catch (e) {
        throw new Error(`Etiqueta ${i + 1}: não foi possível baixar (${e instanceof Error ? e.message : String(e)}).`);
      }
      if (!r.ok) {
        throw new Error(`Etiqueta ${i + 1}: a Anjun respondeu HTTP ${r.status}.`);
      }
      return new Uint8Array(await r.arrayBuffer());
    })
  );
  const doc = await PDFDocument.create();
  const embedded: PDFEmbeddedPage[] = [];
  for (let i = 0; i < files.length; i++) {
    let source;
    try {
      source = await PDFDocument.load(files[i]);
    } catch {
      throw new Error(`Etiqueta ${i + 1}: o arquivo não é um PDF válido.`);
    }
    embedded.push(...(await doc.embedPdf(source, source.getPageIndices())));
  }
  const slots = a4Slots(embedded.map((p) => ({ width: p.width, height: p.height })));
  const pages: PDFPage[] = [];
  slots.forEach((slot, i) => {
    if (!pages[slot.page]) {
      const page = doc.addPage([A4.width, A4.height]);
      const guide = { thickness: 0.4, color: rgb(0.75, 0.75, 0.75), dashArray: [3, 3] };
      page.drawLine({ start: { x: A4.width / 2, y: A4.margin }, end: { x: A4.width / 2, y: A4.height - A4.margin }, ...guide });
      page.drawLine({ start: { x: A4.margin, y: A4.height / 2 }, end: { x: A4.width - A4.margin, y: A4.height / 2 }, ...guide });
      pages[slot.page] = page;
    }
    pages[slot.page].drawPage(embedded[i], { x: slot.x, y: slot.y, xScale: slot.scale, yScale: slot.scale });
  });
  doc.setTitle("Etiquetas em A4");
  doc.setCreator("Central de Fretes");
  return { bytes: await doc.save(), labels: embedded.length, pages: pages.length };
}

/** Baixa o PDF com o nome do pedido na transportadora. */
export function downloadPdf(bytes: Uint8Array, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function labelsFileName(carrierOrder: string | null, shipmentId: number): string {
  return `etiquetas-${(carrierOrder || `envio-${shipmentId}`).replace(/[^\w-]+/g, "_")}-A4.pdf`;
}
