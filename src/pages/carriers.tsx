import { useMemo } from "react";
import { Calculator, Filter, Route, Tag, Trophy, Truck } from "lucide-react";
import { useCentral } from "@/app/central-context";
import { DataTable, type Column } from "@/components/data-table";
import { Badge, EnvBadge, Empty, Field, Panel } from "@/components/ui";
import { carrierStats, shortName, type CarrierStats } from "@/services/freight/analytics";
import { fmtAgo, fmtCnpj, fmtDays, fmtMoney, fmtNumber, fmtPercent } from "@/services/freight/format";

/** O que o módulo integra de cada transportadora (CarrierRegistry.java). */
const INTEGRATIONS: Record<number, { quote: boolean; ship: boolean; track: boolean; note?: string }> = {
  31656: { quote: true, ship: true, track: true, note: "Coleta no local" },
};

export function CarriersPage() {
  const { data, filters, setFilters, go } = useCentral();
  const stats = useMemo(() => (data ? carrierStats(data, filters) : []), [data, filters]);
  if (!data) return null;

  const focus = (id: number) => {
    setFilters({ carrier: String(id) });
    go("overview");
  };

  const columns: Column<CarrierStats>[] = [
    { key: "name", header: "Transportadora", render: (c) => <b>{shortName(c.carrier.name)}</b>, sort: (c) => c.carrier.name, csv: (c) => c.carrier.name },
    { key: "quotes", header: "Cotações", align: "right", render: (c) => fmtNumber(c.quotes), sort: (c) => c.quotes, csv: (c) => c.quotes },
    { key: "errors", header: "Erro", align: "right", render: (c) => fmtPercent(c.quotes ? c.quoteErrors / c.quotes : null), sort: (c) => (c.quotes ? c.quoteErrors / c.quotes : null), csv: (c) => c.quoteErrors },
    { key: "fee", header: "Frete médio", align: "right", render: (c) => fmtMoney(c.feeAverage), sort: (c) => c.feeAverage, csv: (c) => c.feeAverage?.toFixed(2).replace(".", ",") },
    { key: "days", header: "Prazo cotado", align: "right", render: (c) => fmtDays(c.daysAverage), sort: (c) => c.daysAverage, csv: (c) => c.daysAverage?.toFixed(1) },
    { key: "cheapest", header: "Mais barata", align: "right", render: (c) => (c.compared ? `${c.cheapest} de ${c.compared}` : "—"), sort: (c) => (c.compared ? c.cheapest / c.compared : null), csv: (c) => `${c.cheapest}/${c.compared}` },
    { key: "shipments", header: "Envios", align: "right", render: (c) => fmtNumber(c.shipments), sort: (c) => c.shipments, csv: (c) => c.shipments },
    { key: "delivered", header: "Entregues", align: "right", render: (c) => fmtNumber(c.delivered), sort: (c) => c.delivered, csv: (c) => c.delivered },
    { key: "real", header: "Prazo real", align: "right", render: (c) => fmtDays(c.deliveryDaysAverage), sort: (c) => c.deliveryDaysAverage, csv: (c) => c.deliveryDaysAverage?.toFixed(1) },
    { key: "ontime", header: "No prazo", align: "right", render: (c) => fmtPercent(c.onTimeRate), sort: (c) => c.onTimeRate, csv: (c) => c.onTimeRate },
    { key: "problems", header: "Problemas", align: "right", render: (c) => fmtNumber(c.problems), sort: (c) => c.problems, csv: (c) => c.problems },
  ];

  return (
    <div className="flex flex-col gap-4">
      {stats.length === 0 && <Empty icon={Truck} title="Nenhuma transportadora com movimento" />}
      <div className="grid gap-4 xl:grid-cols-2">
        {stats.map((c) => {
          const integ = INTEGRATIONS[c.carrier.id];
          return (
            <Panel
              key={c.carrier.id}
              title={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{c.carrier.name}</span>
                </span>
              }
              icon={Truck}
              actions={
                <button type="button" className="btn btn-outline btn-sm" onClick={() => focus(c.carrier.id)} title="Filtrar a central por esta transportadora">
                  <Filter size={13} /> Ver só esta
                </button>
              }
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                <span>CODPARC {c.carrier.id}</span>
                {c.carrier.document && <span>CNPJ {fmtCnpj(c.carrier.document)}</span>}
                {c.carrier.city && (
                  <span>
                    {c.carrier.city}/{c.carrier.state}
                  </span>
                )}
                {c.lastActivity && <span>Último movimento {fmtAgo(c.lastActivity)}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {integ ? (
                  <>
                    {integ.quote && <Badge tone="outline" icon={Calculator}>Cotação</Badge>}
                    {integ.ship && <Badge tone="outline" icon={Tag}>Envio com etiqueta</Badge>}
                    {integ.track && <Badge tone="outline" icon={Route}>Rastreio</Badge>}
                    {integ.note && <Badge tone="outline">{integ.note}</Badge>}
                  </>
                ) : (
                  <Badge tone="outline">Sem integração no módulo</Badge>
                )}
                {[...c.environments].map((e) => (
                  <EnvBadge key={e} env={e} />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <Field label="Cotações">
                  {fmtNumber(c.quotes)} <span className="text-xs font-normal text-muted">({fmtPercent(c.quotes ? c.quoteErrors / c.quotes : null)} erro)</span>
                </Field>
                <Field label="Frete médio">{fmtMoney(c.feeAverage)}</Field>
                <Field label="Prazo cotado">{fmtDays(c.daysAverage)}</Field>
                <Field label="Mais barata">
                  {c.compared ? (
                    <span className="inline-flex items-center gap-1">
                      <Trophy size={13} className="text-[#c99400]" aria-hidden />
                      {c.cheapest} de {c.compared}
                    </span>
                  ) : (
                    "—"
                  )}
                </Field>
                <Field label="Envios">
                  {fmtNumber(c.shipments)}
                  {c.refused > 0 && <span className="text-xs font-normal text-[#a94442]"> ({c.refused} recusado)</span>}
                </Field>
                <Field label="Em andamento">{fmtNumber(c.open)}</Field>
                <Field label="Entregues">
                  {fmtNumber(c.delivered)} <span className="text-xs font-normal text-muted">em {fmtDays(c.deliveryDaysAverage)}</span>
                </Field>
                <Field label="No prazo cotado">
                  {fmtPercent(c.onTimeRate)}
                  {c.problems > 0 && <span className="text-xs font-normal text-[#a94442]"> · {c.problems} problema(s)</span>}
                </Field>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-muted">
                  <span>Frete cotado no período</span>
                  <b className="text-ink">{fmtMoney(c.feeTotal)}</b>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
      {stats.length > 1 && (
        <Panel title="Comparativo" icon={Trophy} bodyClass="p-0">
          <DataTable rows={stats} columns={columns} rowKey={(c) => c.carrier.id} onRowClick={(c) => focus(c.carrier.id)} exportName="transportadoras-frete" />
        </Panel>
      )}
      <p className="m-0 text-xs text-muted">
        "Mais barata" conta os pedidos cotados em duas ou mais transportadoras no período. "No prazo" compara o tempo entre o envio e a
        confirmação de entrega com o prazo da última cotação.
      </p>
    </div>
  );
}
