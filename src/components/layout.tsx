import { useMemo, useState, type ReactNode } from "react";
import {
  BellRing,
  Boxes,
  Calculator,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  LayoutDashboard,
  RefreshCw,
  Route,
  Send,
  Settings,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { presetRange, useCentral, type Page } from "@/app/central-context";
import { attention, shortName } from "@/services/freight/analytics";
import { daysBetween, fmtDateTime } from "@/services/freight/format";
import { safeStorage } from "@/services/freight/source";
import { Badge, Segmented, Spinner, cx } from "./ui";
import { APP_VERSION } from "@/app/version";

export const PAGE_META: Record<Page, { label: string; icon: LucideIcon; description: string }> = {
  overview: {
    label: "Visão geral",
    icon: LayoutDashboard,
    description: "Indicadores do frete no período: cotações, envios, entregas e o que pede atenção.",
  },
  attention: {
    label: "Pendências",
    icon: BellRing,
    description: "Problemas na entrega, rastreios parados, envios recusados e cotações sem envio.",
  },
  orders: {
    label: "Pedidos",
    icon: ClipboardList,
    description: "Pedidos e notas cotados ou enviados, com a situação do frete de cada um.",
  },
  shipments: {
    label: "Envios",
    icon: Send,
    description: "Envios solicitados às transportadoras, com etiquetas, códigos de rastreio e situação.",
  },
  tracking: {
    label: "Rastreamento",
    icon: Route,
    description: "Envios em andamento por etapa do trajeto; atualize o rastreio na transportadora.",
  },
  quotes: {
    label: "Cotações",
    icon: Calculator,
    description: "Todas as cotações feitas, com caixas, peso, CEPs, resultado e o JSON trocado.",
  },
  carriers: {
    label: "Transportadoras",
    icon: Truck,
    description: "Desempenho de cada transportadora: preço, prazo, entregas no prazo e problemas.",
  },
  boxes: {
    label: "Caixas",
    icon: Boxes,
    description: "Caixas padrão da expedição (AD_FRETECAIXA) e as mais usadas nos envios.",
  },
  settings: {
    label: "Configurações",
    icon: Settings,
    description: "Estrutura do frete no banco, botão do módulo e informações da central.",
  },
};

const MAIN: Page[] = ["overview", "attention", "orders", "shipments", "tracking", "quotes", "carriers", "boxes"];
const COLLAPSE_KEY = "central-frete.menu-recolhido";

export function Sidebar() {
  const { page, go, view, data, source } = useCentral();
  const [collapsed, setCollapsed] = useState(() => safeStorage()?.getItem(COLLAPSE_KEY) === "1");
  const toggle = () => {
    setCollapsed((c) => {
      try {
        safeStorage()?.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* conveniência */
      }
      return !c;
    });
  };

  const counts = useMemo<Partial<Record<Page, number>>>(() => {
    if (!view) return {};
    return {
      attention: attention(view).length,
      orders: view.orders.length,
      shipments: view.shipments.filter((s) => s.ok).length,
      tracking: view.open.length,
      quotes: view.quotes.length,
    };
  }, [view]);

  const user = window.sankhyaUserInfo?.name;

  const item = (p: Page) => {
    const meta = PAGE_META[p];
    const Icon = meta.icon;
    const on = page === p;
    const count = counts[p];
    return (
      <li key={p}>
        <button
          type="button"
          onClick={() => go(p)}
          title={collapsed ? meta.label : undefined}
          aria-current={on ? "page" : undefined}
          className={cx(
            "relative flex h-10 w-full items-center gap-3 rounded-[3px] text-left text-[13px] font-bold transition-colors",
            collapsed ? "justify-center px-0" : "px-3",
            on ? "bg-white/10 text-white" : "text-[#c5cbd3] hover:bg-white/5 hover:text-white"
          )}
        >
          {on && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-snk-green" aria-hidden />}
          <Icon size={18} className={on ? "text-snk-green" : undefined} aria-hidden />
          {!collapsed && <span className="flex-1 truncate">{meta.label}</span>}
          {!collapsed && count != null && count > 0 && (
            <span
              className={cx(
                "rounded-full px-1.5 text-[11px] leading-[18px]",
                p === "attention" ? "bg-status-critical text-white" : "bg-white/10 text-[#c5cbd3]"
              )}
            >
              {count}
            </span>
          )}
          {collapsed && p === "attention" && count != null && count > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-status-critical" aria-label={`${count} pendências`} />
          )}
        </button>
      </li>
    );
  };

  return (
    <aside
      className={cx(
        "flex h-full shrink-0 flex-col bg-snk-darker text-white transition-[width] duration-200",
        collapsed ? "w-[60px]" : "w-[232px]"
      )}
    >
      <div className={cx("flex h-14 items-center gap-2.5 border-b border-white/10", collapsed ? "justify-center" : "px-4")}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-snk-green">
          <Truck size={18} aria-hidden />
        </span>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[15px] font-bold">Central de Fretes</div>
            <div className="truncate text-[11px] text-[#9aa3ad]">Brasfoot · Sankhya</div>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Menu da central">
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{MAIN.map(item)}</ul>
      </nav>
      <div className="border-t border-white/10 px-2 py-2">
        <ul className="m-0 list-none p-0">{item("settings")}</ul>
        {!collapsed && (
          <div className="px-3 pb-1 pt-2 text-[11px] leading-snug text-[#9aa3ad]">
            {user && <div className="truncate">Usuário: {user}</div>}
            <div>
              v{APP_VERSION}
              {(data?.sample || source.sample) && " · dados de exemplo"}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          className={cx(
            "mt-1 flex h-8 w-full items-center gap-2 rounded-[3px] text-xs text-[#9aa3ad] hover:bg-white/5 hover:text-white",
            collapsed ? "justify-center" : "px-3"
          )}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && "Recolher menu"}
        </button>
      </div>
    </aside>
  );
}

const PRESETS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
];

export function Header({ actions }: { actions?: ReactNode }) {
  const { page, filters, setFilters, data, view, loading, reload, progress } = useCentral();
  const meta = PAGE_META[page];
  const days = Math.round(daysBetween(new Date(`${filters.from}T00:00:00`), new Date(`${filters.to}T00:00:00`))) + 1;
  const today = presetRange(1).to;
  const preset = filters.to === today && PRESETS.some((p) => Number(p.value) === days) ? String(days) : "custom";
  const carriers = view?.carriers ?? data?.carriers ?? [];

  return (
    <header className="shrink-0 border-b border-edge bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="m-0 text-xl font-bold leading-tight">{meta.label}</h1>
            {data?.sample && (
              <Badge tone="amber" title="Fora do Sankhya: dados fictícios gerados para demonstração">
                Dados de exemplo
              </Badge>
            )}
          </div>
          <p className="m-0 mt-0.5 text-[13px] text-muted">{meta.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <span className="hidden text-xs text-muted md:inline">
            {loading ? progress || "Carregando…" : data ? `Atualizado em ${fmtDateTime(data.loadedAt)}` : ""}
          </span>
          <button type="button" className="btn btn-outline" onClick={reload} disabled={loading} title="Recarregar do banco">
            {loading ? <Spinner size={14} /> : <RefreshCw size={14} />}
            Atualizar
          </button>
        </div>
      </div>
      {page !== "settings" && (
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2.5 border-t border-line bg-[#fafafa] px-6 py-2.5">
          <div>
            <span className="label">Período</span>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                size="sm"
                value={preset}
                options={[...PRESETS, { value: "custom", label: "Personalizado" }]}
                onChange={(v) => {
                  if (v !== "custom") setFilters(presetRange(Number(v)));
                }}
              />
              <input
                type="date"
                className="field h-7 w-[136px] text-xs"
                value={filters.from}
                max={filters.to}
                onChange={(e) => e.target.value && setFilters({ from: e.target.value })}
                aria-label="De"
              />
              <span className="text-xs text-muted">até</span>
              <input
                type="date"
                className="field h-7 w-[136px] text-xs"
                value={filters.to}
                min={filters.from}
                onChange={(e) => e.target.value && setFilters({ to: e.target.value })}
                aria-label="Até"
              />
            </div>
          </div>
          <label className="block min-w-[200px]">
            <span className="label">Transportadora</span>
            <select className="field h-7 text-xs" value={filters.carrier} onChange={(e) => setFilters({ carrier: e.target.value })}>
              <option value="all">Todas</option>
              {carriers.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {shortName(c.name)} ({c.id})
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="label">Ambiente</span>
            <Segmented
              size="sm"
              value={filters.environment}
              options={[
                { value: "all", label: "Todos" },
                { value: "P", label: "Produção" },
                { value: "S", label: "Sandbox" },
              ]}
              onChange={(v) => setFilters({ environment: v })}
            />
          </div>
        </div>
      )}
    </header>
  );
}
