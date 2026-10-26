import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import { A4, a4Slots, labelsA4, labelsFileName } from "@/services/freight/labels";

/** Etiqueta da Anjun: PDF de uma página, 283 × 427 pt (100 × 150 mm). */
const ANJUN = { width: 283, height: 427 };
const PT_TO_MM = 25.4 / 72;

async function fakeLabel(text: string, pages = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([ANJUN.width, ANJUN.height]);
    page.drawRectangle({ x: 4, y: 4, width: ANJUN.width - 8, height: ANJUN.height - 8, borderWidth: 1 });
    page.drawText(`${text}${pages > 1 ? ` p${i + 1}` : ""}`, { x: 20, y: 380, size: 18, font });
  }
  return doc.save();
}

/** fetch falso: cada URL devolve o PDF do mapa (ou o status pedido). */
function fakeFetch(files: Record<string, Uint8Array | number>): typeof fetch {
  return (async (url: string) => {
    const f = files[url];
    if (typeof f === "number") {
      return new Response("forbidden", { status: f });
    }
    return new Response(f as BlobPart, { status: 200, headers: { "Content-Type": "application/pdf" } });
  }) as unknown as typeof fetch;
}

const xobjects = (doc: PDFDocument, page: number) => {
  const resources = doc.getPage(page).node.Resources();
  const dict = resources?.lookupMaybe(PDFName.of("XObject"), PDFDict);
  return dict ? dict.keys().length : 0;
};

describe("etiquetas em A4: posição (a4Slots)", () => {
  const slots = a4Slots(Array.from({ length: 6 }, () => ANJUN));

  it("4 por folha: 6 etiquetas em 2 folhas", () => {
    expect(slots.map((s) => s.page)).toEqual([0, 0, 0, 0, 1, 1]);
  });

  it("100 × 150 mm sai a ~95% (≈ 95 × 143 mm), inteira", () => {
    expect(slots[0].scale).toBeCloseTo(0.9526, 4);
    expect(slots[0].width * PT_TO_MM).toBeCloseTo(95.1, 1);
    expect(slots[0].height * PT_TO_MM).toBeCloseTo(143.5, 1);
  });

  it("ordem das caixas: esquerda → direita, de cima para baixo", () => {
    const [a, b, c, d] = slots;
    expect(a.x).toBeLessThan(b.x);
    expect(a.y).toBeCloseTo(b.y, 6);
    expect(c.y).toBeLessThan(a.y);
    expect(c.x).toBeCloseTo(a.x, 6);
    expect(d.x).toBeCloseTo(b.x, 6);
    expect(slots[4]).toMatchObject({ page: 1, x: a.x, y: a.y });
  });

  it("tudo dentro da margem de 4 mm, sem sobrepor, com 2 mm entre as etiquetas", () => {
    for (const s of slots) {
      expect(s.x).toBeGreaterThanOrEqual(A4.margin - 1e-6);
      expect(s.y).toBeGreaterThanOrEqual(A4.margin - 1e-6);
      expect(s.x + s.width).toBeLessThanOrEqual(A4.width - A4.margin + 1e-6);
      expect(s.y + s.height).toBeLessThanOrEqual(A4.height - A4.margin + 1e-6);
    }
    const [a, b, c] = slots;
    expect(b.x - (a.x + a.width)).toBeGreaterThanOrEqual(A4.gap - 1e-6);
    expect(a.y - (c.y + c.height)).toBeGreaterThanOrEqual(A4.gap - 1e-6);
  });

  it("etiqueta pequena não é ampliada", () => {
    expect(a4Slots([{ width: 200, height: 200 }])[0].scale).toBe(1);
  });
});

describe("etiquetas em A4: PDF (labelsA4, pdf-lib de verdade)", () => {
  it("6 etiquetas da nota 784211 → 2 folhas A4 com 4 e 2 etiquetas", async () => {
    const urls = Array.from({ length: 6 }, (_, i) => `https://label/${i + 1}.pdf`);
    const files = Object.fromEntries(await Promise.all(urls.map(async (u, i) => [u, await fakeLabel(`Caixa ${i + 1}`)])));
    const r = await labelsA4(urls, fakeFetch(files));
    expect(r).toMatchObject({ labels: 6, pages: 2 });

    const out = await PDFDocument.load(r.bytes);
    expect(out.getPageCount()).toBe(2);
    for (const page of out.getPages()) {
      expect(page.getWidth()).toBeCloseTo(A4.width, 2);
      expect(page.getHeight()).toBeCloseTo(A4.height, 2);
    }
    expect([xobjects(out, 0), xobjects(out, 1)]).toEqual([4, 2]);
  });

  it("etiqueta com 2 páginas ocupa 2 lugares", async () => {
    const files = { a: await fakeLabel("A", 2), b: await fakeLabel("B") };
    expect(await labelsA4(["a", "b"], fakeFetch(files))).toMatchObject({ labels: 3, pages: 1 });
  });

  it("falha numa etiqueta: erro com o número dela, sem arquivo pela metade", async () => {
    const files = { a: await fakeLabel("A"), b: await fakeLabel("B"), c: 403 };
    await expect(labelsA4(["a", "b", "c"], fakeFetch(files))).rejects.toThrow("Etiqueta 3: a Anjun respondeu HTTP 403.");
  });

  it("arquivo que não é PDF", async () => {
    const files = { a: new TextEncoder().encode("<html>expirado</html>") };
    await expect(labelsA4(["a"], fakeFetch(files))).rejects.toThrow("Etiqueta 1: o arquivo não é um PDF válido.");
  });

  it("sem etiquetas", async () => {
    await expect(labelsA4([])).rejects.toThrow("Este envio não tem etiquetas.");
  });

  it("nome do arquivo pelo pedido na transportadora", () => {
    expect(labelsFileName("AJGP2610261170031", 1)).toBe("etiquetas-AJGP2610261170031-A4.pdf");
    expect(labelsFileName(null, 7)).toBe("etiquetas-envio-7-A4.pdf");
  });
});
