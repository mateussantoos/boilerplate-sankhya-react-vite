// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { CentralContext, presetRange, type CentralState } from "@/app/central-context";
import { OrderDrawer } from "@/components/order-drawer";
import { buildView } from "@/services/freight/analytics";
import { sampleSource } from "@/services/freight/sample-source";
import type { FreightSource } from "@/services/freight/source";
import type { Dataset, Filters, TrackingReply } from "@/services/freight/types";

/**
 * Detalhe do pedido, aba Trajeto: em produção (09/11/2026) o "Consultar agora" mostrava a nota 785098
 * entregue, mas o quadro Rastreamento e o selo do detalhe continuavam em "Aguardando coleta" até
 * alguém recarregar a central.
 */
const filters: Filters = { ...presetRange(90), carrier: "all", environment: "all" };
let data: Dataset;
let orderId: number;

beforeAll(async () => {
  data = await sampleSource.loadDataset(filters);
  const open = buildView(data, filters).open.find((s) => !s.cancelled);
  orderId = open!.orderId ?? open!.invoiceId ?? 0;
});

afterEach(cleanup);

const delivered: TrackingReply = {
  ok: true,
  message: null,
  boxes: [{ waybill: "AJ1", label: "Entregue", status: "E", events: [{ when: "03-11-2026 14:42:45", label: "Entregue", place: "Domingos Martins / ES", problem: null, code: "signed" }] }],
};

function setup(reply: TrackingReply) {
  const track = vi.fn(async () => reply);
  const loadOrderDetail = vi.fn(sampleSource.loadOrderDetail);
  const source: FreightSource = { ...sampleSource, track, loadOrderDetail };
  const reload = vi.fn();
  const state = (d: Dataset): CentralState => ({
    source,
    filters,
    setFilters: () => {},
    data: d,
    view: buildView(d, filters),
    loading: false,
    progress: "",
    error: null,
    reload,
    page: "tracking",
    go: () => {},
    drawer: { orderId, tab: "route" },
    openOrder: () => {},
    closeOrder: () => {},
    toasts: [],
    notify: () => {},
    dismiss: () => {},
    orderStatus: "all",
    setOrderStatus: () => {},
  });
  const ui = (d: Dataset) => (
    <CentralContext.Provider value={state(d)}>
      <OrderDrawer />
    </CentralContext.Provider>
  );
  return { track, loadOrderDetail, reload, ui };
}

describe("detalhe do pedido: consulta de rastreio", () => {
  it("consulta bem-sucedida recarrega a central (quadro e selo com a situação nova)", async () => {
    const t = setup(delivered);
    render(t.ui(data));
    await waitFor(() => expect(t.track).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await waitFor(() => expect(t.reload).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Consultado na transportadora em/)).toBeTruthy();
  });

  it("depois da recarga, o detalhe troca no lugar: sem apagar o trajeto e sem consultar a Anjun de novo", async () => {
    const t = setup(delivered);
    const view = render(t.ui(data));
    await waitFor(() => expect(t.reload).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await screen.findByText(/Consultado na transportadora em/);

    view.rerender(t.ui({ ...data, loadedAt: new Date() }));
    expect(screen.getByText(/Consultado na transportadora em/)).toBeTruthy();
    await waitFor(() => expect(t.loadOrderDetail).toHaveBeenCalledTimes(2), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 300));
    expect(t.track).toHaveBeenCalledTimes(1);
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Consultado na transportadora em/)).toBeTruthy();
  });

  it("consulta que falhou não recarrega", async () => {
    const t = setup({ ok: false, message: "API de rastreio não liberada", boxes: [] });
    render(t.ui(data));
    await waitFor(() => expect(t.track).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 100));
    expect(t.reload).not.toHaveBeenCalled();
  });
});
