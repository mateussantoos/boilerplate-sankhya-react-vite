import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { useCentral } from "@/app/central-context";
import { DataTable, SearchBox, matches, type Column } from "@/components/data-table";
import { Badge, EnvBadge, Empty, Panel, Segmented, StatusBadge } from "@/components/ui";
import { shipmentStatus, shortName } from "@/services/freight/analytics";
import { describeBoxes, parseBoxes } from "@/services/freight/boxes";
import { daysBetween, fmtAgo, fmtDateTime, fmtDecimal, fmtKg, fmtMoney } from "@/services/freight/format";
import { STATUS_LABEL, STATUS_ORDER } from "@/services/freight/status";
import type { Shipment } from "@/services/freight/types";

export function ShipmentsPage() {
  const { view, openOrder } = useCentral();
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<"ok" | "refused" | "all">("ok");

  const rows = useMemo(() => view?.shipments ?? [], [view]);
  const okCount = rows.filter((s) => s.ok).length;
  const filtered = rows.filter(
    (s) =>
      (result === "all" || (result === "ok" ? s.ok : !s.ok)) &&
      matches(search, s.invoiceNumber, s.carrierOrder, s.customer, s.city, s.state, s.customerNumber, s.orderId, s.invoiceId, ...s.waybills)
  );

  if (!view) return null;
  const now = new Date();

  const columns: Column<Shipment>[] = [
    { key: "when", header: "Envio", render: (s) => fmtDateTime(s.when), sort: (s) => s.when, csv: (s) => fmtDateTime(s.when) },
    {
      key: "invoice",
      header: "NF-e",
      render: (s) => (
        <div className="leading-tight">
          <div className="font-bold">
            {s.invoiceNumber ?? "—"}
            {s.invoiceSeries ? `/${s.invoiceSeries}` : ""}
          </div>
          <div className="whitespace-nowrap text-xs text-muted">nº {s.invoiceId ?? "—"}</div>
        </div>
      ),
      sort: (s) => Number(s.invoiceNumber) || null,
      csv: (s) => s.invoiceNumber,
    },
    {
      key: "customer",
      header: "Cliente / destino",
      render: (s) => (
        <div className="max-w-[260px] leading-tight">
          <div className="truncate font-bold">{s.customer ?? "—"}</div>
          <div className="truncate text-xs text-muted">
            {s.city ?? "—"}
            {s.state ? `/${s.state}` : ""}
          </div>
        </div>
      ),
      sort: (s) => s.customer,
      csv: (s) => `${s.customer ?? ""} - ${s.city ?? ""}/${s.state ?? ""}`,
    },
    {
      key: "carrier",
      header: "Transportadora",
      render: (s) => (
        <div className="leading-tight">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            {shortName(s.carrierName)}
            {s.environment === "S" && <EnvBadge env="S" />}
          </div>
          <div className="font-mono text-xs text-muted">{s.carrierOrder ?? "—"}</div>
        </div>
      ),
      sort: (s) => s.carrierName,
      csv: (s) => `${s.carrierName ?? ""} ${s.carrierOrder ?? ""} (${s.environment === "S" ? "sandbox" : "produção"})`,
    },
    {
      key: "boxes",
      header: "Caixas",
      render: (s) => {
        const groups = parseBoxes(s.boxes);
        return (
          <div className="max-w-[200px] leading-tight" title={describeBoxes(groups, view.boxes)}>
            <div className="font-bold">{s.boxCount ?? s.waybills.length}</div>
            <div className="truncate text-xs text-muted">{describeBoxes(groups, view.boxes) || "—"}</div>
          </div>
        );
      },
      sort: (s) => s.boxCount,
      csv: (s) => s.boxCount,
    },
    { key: "weight", header: "Peso", align: "right", render: (s) => fmtKg(s.weightKg), sort: (s) => s.weightKg, csv: (s) => s.weightKg },
    { key: "fee", header: "Frete", align: "right", render: (s) => fmtMoney(s.fee), sort: (s) => s.fee, csv: (s) => s.fee?.toFixed(2).replace(".", ",") },
    {
      key: "status",
      header: "Situação",
      render: (s) =>
        s.ok ? (
          <div className="max-w-[260px] leading-tight">
            <StatusBadge status={shipmentStatus(s)} />
            <div className="mt-1 truncate text-xs text-muted" title={s.situation ?? undefined}>
              {s.situation ?? "Envio solicitado"} · {fmtAgo(s.situationWhen ?? s.when)}
            </div>
          </div>
        ) : (
          <div className="max-w-[260px] leading-tight">
            <Badge tone="red">Recusado</Badge>
            <div className="mt-1 truncate text-xs text-[#a94442]" title={s.message ?? undefined}>
              {s.message}
            </div>
          </div>
        ),
      sort: (s) => {
        const st = shipmentStatus(s);
        return st ? STATUS_ORDER.indexOf(st) : 99;
      },
      csv: (s) => (s.ok ? `${STATUS_LABEL[shipmentStatus(s) ?? "S"]} - ${s.situation ?? ""}` : `Recusado - ${s.message ?? ""}`),
    },
    {
      key: "age",
      header: "Dias",
      align: "right",
      render: (s) => (s.when ? fmtDecimal(Math.max(0, daysBetween(s.when, s.finished && s.situationWhen ? s.situationWhen : now)), 0) : "—"),
      sort: (s) => (s.when ? daysBetween(s.when, s.finished && s.situationWhen ? s.situationWhen : now) : null),
      csv: (s) => (s.when ? Math.round(daysBetween(s.when, s.finished && s.situationWhen ? s.situationWhen : now)) : null),
    },
  ];

  return (
    <Panel title={`${filtered.length} envio${filtered.length === 1 ? "" : "s"}`} icon={Send} bodyClass="p-0">
      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(s) => s.id}
        onRowClick={(s) => openOrder(s.orderId ?? s.invoiceId ?? 0, s.ok ? "route" : "shipment")}
        defaultSort={{ key: "when", dir: "desc" }}
        exportName={`envios-frete-${view.filters.from}-a-${view.filters.to}`}
        toolbar={
          <>
            <SearchBox value={search} onChange={setSearch} placeholder="Buscar NF, cliente, pedido, código de rastreio…" />
            <Segmented
              size="sm"
              value={result}
              options={[
                { value: "ok", label: "Solicitados", count: okCount },
                { value: "refused", label: "Recusados", count: rows.length - okCount },
                { value: "all", label: "Todos", count: rows.length },
              ]}
              onChange={setResult}
            />
          </>
        }
        empty={
          <Empty icon={Send} title="Nenhum envio com esses filtros">
            Os envios aparecem aqui quando alguém usa "Solicitar envio" no pop-up Cotar frete.
          </Empty>
        }
      />
    </Panel>
  );
}
