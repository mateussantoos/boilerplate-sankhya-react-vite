import { useMemo } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  BellRing,
  CircleDashed,
  ClipboardList,
  MapPinned,
  PackageCheck,
  Send,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { useCentral } from "@/app/central-context";
import { BarList, LineChart } from "@/components/charts";
import { ActivityFeed, AttentionList } from "@/components/feeds";
import { Empty, Panel, Stat, STATUS_ICON } from "@/components/ui";
import { activity, attention, daily, feeByState, kpis, statusCounts, topCustomers } from "@/services/freight/analytics";
import { fmtDays, fmtDecimal, fmtMoney, fmtNumber, fmtPercent } from "@/services/freight/format";
import { STATUS_LABEL, STATUS_ORDER } from "@/services/freight/status";

export function OverviewPage() {
  const { view, go, setOrderStatus } = useCentral();
  const m = useMemo(() => {
    if (!view) return null;
    return {
      k: kpis(view),
      days: daily(view),
      states: feeByState(view),
      customers: topCustomers(view),
      status: statusCounts(view),
      pending: attention(view),
      feed: activity(view, 14),
    };
  }, [view]);
  if (!view || !m) return null;
  const { k } = m;

  const openOrders = (s: Parameters<typeof setOrderStatus>[0]) => {
    setOrderStatus(s);
    go("orders");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <Stat
          label="Pedidos cotados"
          icon={ClipboardList}
          accent="blue"
          value={fmtNumber(k.quotedOrders)}
          hint={`${fmtNumber(k.quotes)} cotações · ${fmtPercent(k.errorRate)} com erro`}
          onClick={() => go("quotes")}
        />
        <Stat
          label="Frete cotado"
          icon={Wallet}
          accent="blue"
          value={fmtMoney(k.feeTotal, true)}
          hint={`média ${fmtMoney(k.feeAverage)} · prazo ${fmtDays(k.daysAverage)}`}
        />
        <Stat
          label="Envios solicitados"
          icon={Send}
          accent="green"
          value={fmtNumber(k.shipments)}
          hint={`${fmtNumber(k.boxesShipped)} caixas · ${fmtDecimal(k.weightShipped, 0)} kg${k.refused ? ` · ${k.refused} recusado(s)` : ""}`}
          onClick={() => go("shipments")}
        />
        <Stat
          label="Em andamento"
          icon={Truck}
          accent="amber"
          value={fmtNumber(k.requested + k.inTransit)}
          hint={`${k.requested} aguardando coleta · ${k.inTransit} em trânsito`}
          onClick={() => go("tracking")}
        />
        <Stat
          label="Entregues"
          icon={PackageCheck}
          accent="green"
          value={fmtNumber(k.delivered)}
          hint={`em ${fmtDays(k.deliveryDaysAverage)} · ${fmtPercent(k.onTimeRate)} no prazo cotado`}
        />
        <Stat
          label="Pendências"
          icon={BellRing}
          accent={m.pending.length ? "red" : undefined}
          value={fmtNumber(m.pending.length)}
          hint={`${k.problems} problema(s) na entrega`}
          onClick={() => go("attention")}
        />
      </div>

      <Panel title="Situação dos pedidos" icon={ClipboardList} bodyClass="p-3">
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {STATUS_ORDER.map((s) => {
            const Icon = STATUS_ICON[s];
            const n = m.status.get(s) ?? 0;
            return (
              <button
                key={s}
                type="button"
                onClick={() => openOrders(s)}
                className="flex items-center gap-3 rounded-[3px] border border-line bg-white px-3 py-2.5 text-left transition-colors hover:border-snk-green hover:bg-snk-green-soft"
              >
                <Icon size={18} className={s === "P" ? "text-status-critical" : s === "E" ? "text-snk-green-dark" : "text-muted"} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-xs text-muted">{STATUS_LABEL[s]}</span>
                  <span className="block text-lg font-bold leading-tight">{fmtNumber(n)}</span>
                </span>
              </button>
            );
          })}
          {(m.status.get("none") ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => openOrders("none")}
              className="flex items-center gap-3 rounded-[3px] border border-line bg-white px-3 py-2.5 text-left hover:border-snk-green"
            >
              <CircleDashed size={18} className="text-faint" aria-hidden />
              <span>
                <span className="block text-xs text-muted">Sem cotação OK</span>
                <span className="block text-lg font-bold leading-tight">{fmtNumber(m.status.get("none"))}</span>
              </span>
            </button>
          )}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Cotações e envios por dia" icon={ActivityIcon}>
          <LineChart
            labels={m.days.map((d) => d.date)}
            series={[
              { key: "quotes", label: "Cotações", values: m.days.map((d) => d.quotes) },
              { key: "shipments", label: "Envios solicitados", values: m.days.map((d) => d.shipments) },
            ]}
            height={300}
          />
        </Panel>
        <Panel
          title="Pendências"
          icon={AlertTriangle}
          bodyClass="p-0"
          actions={
            m.pending.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => go("attention")}>
                Ver todas ({m.pending.length})
              </button>
            )
          }
        >
          {m.pending.length ? (
            <AttentionList items={m.pending} limit={5} compact />
          ) : (
            <Empty icon={PackageCheck} title="Nada pendente">
              Nenhum problema, rastreio parado ou cotação esquecida no período.
            </Empty>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Panel title="Frete cotado por UF de destino" icon={MapPinned}>
          {m.states.length ? (
            <BarList
              labelWidth={60}
              items={m.states.map((s) => ({
                key: s.key,
                label: s.label,
                value: s.value,
                display: (
                  <span>
                    {fmtMoney(s.value)} <span className="font-normal text-muted">· {s.count}</span>
                  </span>
                ),
                hint: `${s.count} pedido(s) · média ${fmtMoney(s.value / s.count)}`,
              }))}
              limit={9}
            />
          ) : (
            <Empty title="Sem cotações no período" />
          )}
        </Panel>
        <Panel title="Clientes com mais envios" icon={Users}>
          {m.customers.length ? (
            <BarList
              color="#eb6834"
              labelWidth={190}
              items={m.customers.map((c) => ({
                key: c.key,
                label: c.label,
                value: c.count,
                display: `${c.count} envio${c.count === 1 ? "" : "s"}`,
                hint: `Frete cotado somado: ${fmtMoney(c.value)}`,
              }))}
              limit={9}
            />
          ) : (
            <Empty title="Sem envios no período" />
          )}
        </Panel>
        <Panel title="Atividade recente" icon={ActivityIcon} bodyClass="py-2" className="lg:col-span-2 2xl:col-span-1">
          {m.feed.length ? <ActivityFeed items={m.feed} /> : <Empty title="Sem movimento no período" />}
        </Panel>
      </div>
    </div>
  );
}
