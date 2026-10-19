import { useEffect } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { CentralProvider, useCentral, type Page } from "./central-context";
import { Header, Sidebar } from "@/components/layout";
import { OrderDrawer } from "@/components/order-drawer";
import { Alert, Spinner, cx } from "@/components/ui";
import { useSankhya } from "@/contexts/sankhya-context";
import { AttentionPage } from "@/pages/attention";
import { BoxesPage } from "@/pages/boxes";
import { CarriersPage } from "@/pages/carriers";
import { OrdersPage } from "@/pages/orders";
import { OverviewPage } from "@/pages/overview";
import { QuotesPage } from "@/pages/quotes";
import { SettingsPage } from "@/pages/settings";
import { ShipmentsPage } from "@/pages/shipments";
import { TrackingPage } from "@/pages/tracking";

/** Título do componente no Construtor de Componentes de BI (TSIGDG.TITULO), para a tela cheia. */
const GADGET_TITLE = "Central de Fretes";

const SCREENS: Record<Page, () => React.ReactElement | null> = {
  overview: OverviewPage,
  attention: AttentionPage,
  orders: OrdersPage,
  shipments: ShipmentsPage,
  tracking: TrackingPage,
  quotes: QuotesPage,
  carriers: CarriersPage,
  boxes: BoxesPage,
  settings: SettingsPage,
};

function Shell() {
  const { page, data, loading, error, progress, reload } = useCentral();
  const Screen = SCREENS[page];
  const needsData = page !== "settings";

  return (
    <div className="flex h-full min-h-0">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <Header />
        <div className={cx("min-h-0 flex-1 overflow-y-auto px-6 py-5", page === "tracking" && "flex flex-col")}>
          {error && (
            <Alert kind="error" className="mb-4">
              <b>Não foi possível carregar os dados do frete.</b> {error}
              <div className="mt-2">
                <button type="button" className="btn btn-outline btn-sm" onClick={reload}>
                  Tentar de novo
                </button>
              </div>
            </Alert>
          )}
          {needsData && !data && loading && (
            <div className="flex items-center justify-center gap-3 py-24 text-muted">
              <Spinner size={22} />
              <span>{progress || "Carregando…"}</span>
            </div>
          )}
          {data && needsData && !(data.setup.quotes || data.setup.shipments) && (
            <Alert kind="warning" className="mb-4">
              <b>A estrutura do frete ainda não foi instalada nesta base.</b> As tabelas AD_FRETECOT e AD_FRETEENV não existem: rode o
              botão de ação <b>Instalar estrutura do frete</b> do módulo brasfoot-sankhya-transportadora e clique em Atualizar.
            </Alert>
          )}
          {(data || !needsData) && (
            <div className={cx(loading && data && "opacity-60 transition-opacity", page === "tracking" && "flex min-h-0 flex-1 flex-col")}>
              <Screen />
            </div>
          )}
        </div>
      </main>
      <OrderDrawer />
      <Toasts />
    </div>
  );
}

function Toasts() {
  const { toasts, dismiss } = useCentral();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[360px] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => {
        const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? CircleAlert : Info;
        return (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto flex items-start gap-2.5 rounded-[3px] border bg-white px-3 py-2.5 text-[13px] shadow-lg",
              t.kind === "success" ? "border-l-4 border-l-snk-green" : t.kind === "error" ? "border-l-4 border-l-status-critical" : "border-l-4 border-l-series-1"
            )}
          >
            <Icon
              size={16}
              className={cx("mt-px shrink-0", t.kind === "success" ? "text-snk-green" : t.kind === "error" ? "text-status-critical" : "text-series-1")}
              aria-hidden
            />
            <span className="flex-1">{t.text}</span>
            <button type="button" className="text-muted hover:text-ink" onClick={() => dismiss(t.id)} aria-label="Fechar aviso">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const sankhya = useSankhya();

  /* Dentro de um dashboard do Sankhya, o componente ocupa a tela toda (sem a moldura do gadget). */
  useEffect(() => {
    /* O atalho ?nunota=…&aba=… segue para o iframe de tela cheia. */
    const q = new URLSearchParams(window.location.search);
    const passthrough: Record<string, string> = {};
    for (const key of ["nunota", "aba"]) {
      const v = q.get(key);
      if (v) passthrough[key] = v;
    }
    sankhya.removeFrame({ instance: GADGET_TITLE, ...passthrough }).catch(() => undefined);
  }, [sankhya]);

  return (
    <CentralProvider>
      <Shell />
    </CentralProvider>
  );
}

export default App;
