import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildView, type View } from "@/services/freight/analytics";
import { addDays, isoDay } from "@/services/freight/format";
import { sampleSource } from "@/services/freight/sample-source";
import { insideSankhya, safeStorage, sankhyaSource, type FreightSource } from "@/services/freight/source";
import type { Dataset, Filters, FreightStatus } from "@/services/freight/types";

/** Telas da central (menu lateral). */
export type Page = "overview" | "orders" | "shipments" | "tracking" | "quotes" | "carriers" | "boxes" | "attention" | "settings";

export const PAGES: Page[] = ["overview", "attention", "orders", "shipments", "tracking", "quotes", "carriers", "boxes", "settings"];

export type DrawerTab = "summary" | "route" | "quotes" | "shipment" | "items";

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

interface CentralState {
  source: FreightSource;
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  data: Dataset | null;
  view: View | null;
  loading: boolean;
  progress: string;
  error: string | null;
  reload: () => void;
  page: Page;
  go: (page: Page) => void;
  drawer: { orderId: number; tab: DrawerTab } | null;
  openOrder: (orderId: number, tab?: DrawerTab) => void;
  closeOrder: () => void;
  toasts: Toast[];
  notify: (kind: Toast["kind"], text: string) => void;
  dismiss: (id: number) => void;
  /** Situação escolhida na tela Pedidos (a Visão geral também a define ao clicar numa situação). */
  orderStatus: OrderStatusFilter;
  setOrderStatus: (s: OrderStatusFilter) => void;
}

export type OrderStatusFilter = "all" | "none" | FreightStatus;

const Ctx = createContext<CentralState | undefined>(undefined);

const FILTERS_KEY = "central-frete.filtros";

/** Período padrão: últimos 30 dias. */
export function presetRange(days: number): Pick<Filters, "from" | "to"> {
  const to = new Date();
  return { from: isoDay(addDays(to, -(days - 1))), to: isoDay(to) };
}

function initialFilters(): Filters {
  const base: Filters = { ...presetRange(30), carrier: "all", environment: "all" };
  try {
    const saved = JSON.parse(safeStorage()?.getItem(FILTERS_KEY) || "null");
    if (saved && typeof saved === "object") {
      /* Guarda transportadora, ambiente e o tamanho do período; as datas andam com o calendário. */
      const days = Number(saved.days);
      return {
        ...base,
        ...(days > 0 ? presetRange(days) : {}),
        carrier: typeof saved.carrier === "string" ? saved.carrier : "all",
        environment: saved.environment === "S" || saved.environment === "P" ? saved.environment : "all",
      };
    }
  } catch {
    /* sem preferências salvas */
  }
  return base;
}

const TABS: DrawerTab[] = ["summary", "route", "quotes", "shipment", "items"];

/** Atalho: index.jsp?nunota=776934&aba=route abre a central já no pedido. */
function drawerFromUrl(): CentralState["drawer"] {
  try {
    const q = new URLSearchParams(window.location.search);
    const id = Number(q.get("nunota"));
    const tab = q.get("aba") as DrawerTab;
    return id > 0 ? { orderId: id, tab: TABS.includes(tab) ? tab : "summary" } : null;
  } catch {
    return null;
  }
}

function pageFromHash(): Page {
  const h = window.location.hash.replace(/^#\/?/, "") as Page;
  return PAGES.includes(h) ? h : "overview";
}

export function CentralProvider({ children }: { children: ReactNode }) {
  const source = useMemo<FreightSource>(() => (insideSankhya() ? sankhyaSource : sampleSource), []);
  const [filters, setFiltersState] = useState<Filters>(initialFilters);
  const [data, setData] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [page, setPage] = useState<Page>(pageFromHash);
  const [drawer, setDrawer] = useState<CentralState["drawer"]>(drawerFromUrl);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [orderStatus, setOrderStatus] = useState<OrderStatusFilter>("all");
  const toastId = useRef(0);

  const setFilters = useCallback((f: Partial<Filters>) => {
    setFiltersState((old) => {
      const next = { ...old, ...f };
      try {
        const days = Math.round((new Date(next.to).getTime() - new Date(next.from).getTime()) / 86400000) + 1;
        safeStorage()?.setItem(
          FILTERS_KEY,
          JSON.stringify({ days, carrier: next.carrier, environment: next.environment })
        );
      } catch {
        /* preferências são só conveniência */
      }
      return next;
    });
  }, []);

  /* O período define o que vem do banco; transportadora e ambiente filtram aqui mesmo. */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    source
      .loadDataset(
        { from: filters.from, to: filters.to, carrier: "all", environment: "all" },
        (step) => alive && setProgress(step)
      )
      .then((d) => {
        if (alive) {
          setData(d);
        }
      })
      .catch((e) => {
        console.error("[central-frete]", e);
        if (alive) {
          setError(e instanceof Error ? e.message : (e as any)?.statusMessage || String(e));
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [source, filters.from, filters.to, tick]);

  const view = useMemo(() => (data ? buildView(data, filters) : null), [data, filters]);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((p: Page) => {
    setPage(p);
    if (window.location.hash !== `#/${p}`) {
      window.history.replaceState(null, "", `#/${p}`);
    }
  }, []);

  const notify = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 8000 : 4500);
  }, []);

  const value: CentralState = {
    source,
    filters,
    setFilters,
    data,
    view,
    loading,
    progress,
    error,
    reload: () => setTick((t) => t + 1),
    page,
    go,
    drawer,
    openOrder: (orderId, tab = "summary") => setDrawer({ orderId, tab }),
    closeOrder: () => setDrawer(null),
    toasts,
    notify,
    dismiss: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    orderStatus,
    setOrderStatus,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCentral(): CentralState {
  const c = useContext(Ctx);
  if (!c) {
    throw new Error("useCentral fora do CentralProvider");
  }
  return c;
}
