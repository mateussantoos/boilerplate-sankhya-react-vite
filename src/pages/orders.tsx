import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { useCentral, type OrderStatusFilter } from "@/app/central-context";
import { DataTable, SearchBox, matches, type Column } from "@/components/data-table";
import { Alert, Empty, Panel, Segmented, StatusBadge } from "@/components/ui";
import { shortName, statusCounts } from "@/services/freight/analytics";
import { fmtDate, fmtDateTime, fmtDays, fmtKg, fmtMoney } from "@/services/freight/format";
import { STATUS_LABEL, STATUS_ORDER } from "@/services/freight/status";
import type { Order } from "@/services/freight/types";

interface Row {
  order: Order;
  status: Order["status"];
  quotes: number;
  lastQuote: Date | null;
  fee: number | null;
  days: number | null;
  carrier: string | null;
  invoice: string | null;
}

export function OrdersPage() {
  const { view, data, openOrder, drawer, orderStatus, setOrderStatus } = useCentral();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "Pedido" | "Nota">("all");

  const rows = useMemo<Row[]>(() => {
    if (!view) return [];
    return view.orders.map((o) => {
      const quotes = view.quotesByOrder.get(o.id) || [];
      const lastOk = quotes.find((q) => q.ok);
      const shipment = view.shipmentByOrder.get(o.id);
      return {
        order: o,
        status: view.statusByOrder.get(o.id) ?? null,
        quotes: quotes.length,
        lastQuote: quotes[0]?.when ?? o.quotedAt,
        fee: o.fee ?? lastOk?.fee ?? null,
        days: o.days ?? lastOk?.days ?? null,
        carrier: o.carrierName ?? lastOk?.carrierName ?? shipment?.carrierName ?? null,
        invoice: shipment?.invoiceNumber ?? (o.kind === "Nota" ? o.number : null),
      };
    });
  }, [view]);

  const counts = useMemo(() => (view ? statusCounts(view) : new Map()), [view]);

  const filtered = rows.filter(
    (r) =>
      (orderStatus === "all" || (orderStatus === "none" ? !r.status : r.status === orderStatus)) &&
      (kind === "all" || r.order.kind === kind) &&
      matches(search, r.order.id, r.order.number, r.invoice, r.order.customer, r.order.city, r.order.state, r.order.tracking, r.order.seller)
  );

  const columns: Column<Row>[] = [
    {
      key: "id",
      header: "Nº único",
      render: (r) => (
        <span className="font-bold">
          {r.order.id}
          <span className="ml-1.5 text-xs font-normal text-muted">{r.order.kind}</span>
        </span>
      ),
      sort: (r) => r.order.id,
      csv: (r) => r.order.id,
    },
    { key: "date", header: "Data", render: (r) => fmtDate(r.order.date), sort: (r) => r.order.date, csv: (r) => fmtDate(r.order.date) },
    {
      key: "customer",
      header: "Cliente / destino",
      render: (r) => (
        <div className="max-w-[280px] leading-tight">
          <div className="truncate font-bold">{r.order.customer ?? "—"}</div>
          <div className="truncate text-xs text-muted">
            {r.order.city ?? "—"}
            {r.order.state ? `/${r.order.state}` : ""}
          </div>
        </div>
      ),
      sort: (r) => r.order.customer,
      csv: (r) => `${r.order.customer ?? ""} - ${r.order.city ?? ""}/${r.order.state ?? ""}`,
    },
    { key: "invoice", header: "NF-e", render: (r) => r.invoice ?? "—", sort: (r) => Number(r.invoice) || null, csv: (r) => r.invoice },
    { key: "status", header: "Situação", render: (r) => <StatusBadge status={r.status} />, sort: (r) => (r.status ? STATUS_ORDER.indexOf(r.status) : 99), csv: (r) => (r.status ? STATUS_LABEL[r.status] : "") },
    { key: "carrier", header: "Transportadora", render: (r) => shortName(r.carrier), sort: (r) => r.carrier, csv: (r) => r.carrier },
    { key: "fee", header: "Frete", align: "right", render: (r) => fmtMoney(r.fee), sort: (r) => r.fee, csv: (r) => r.fee?.toFixed(2).replace(".", ",") },
    { key: "days", header: "Prazo", align: "right", render: (r) => fmtDays(r.days), sort: (r) => r.days, csv: (r) => r.days },
    { key: "value", header: "Valor da nota", align: "right", render: (r) => fmtMoney(r.order.value), sort: (r) => r.order.value, csv: (r) => r.order.value?.toFixed(2).replace(".", ",") },
    { key: "weight", header: "Peso", align: "right", render: (r) => fmtKg(r.order.grossWeightKg), sort: (r) => r.order.grossWeightKg, csv: (r) => r.order.grossWeightKg },
    {
      key: "situation",
      header: "Última situação",
      render: (r) => (
        <div className="max-w-[240px] leading-tight">
          <div className="truncate">{r.order.situation ?? (r.status === "C" ? "Cotado" : "—")}</div>
          <div className="text-xs text-muted">{fmtDateTime(r.order.situationWhen ?? r.lastQuote)}</div>
        </div>
      ),
      sort: (r) => r.order.situationWhen ?? r.lastQuote,
      csv: (r) => r.order.situation,
    },
  ];

  if (!view) return null;

  const statusOptions: { value: OrderStatusFilter; label: string; count?: number }[] = [
    { value: "all", label: "Todos", count: rows.length },
    ...STATUS_ORDER.filter((s) => (counts.get(s) ?? 0) > 0 || s === orderStatus).map((s) => ({
      value: s as OrderStatusFilter,
      label: STATUS_LABEL[s],
      count: counts.get(s) ?? 0,
    })),
    ...((counts.get("none") ?? 0) > 0 ? [{ value: "none" as OrderStatusFilter, label: "Sem cotação OK", count: counts.get("none") }] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      {data && !data.setup.orderColumns && (
        <Alert kind="info">
          As colunas de frete da TGFCAB (AD_FRETESTATUS e outras) ainda não existem: a situação é calculada pelas cotações e envios.
          Rode o botão <b>Instalar estrutura do frete</b> para gravá-las nos pedidos.
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={orderStatus} options={statusOptions} onChange={setOrderStatus} size="sm" />
      </div>
      <Panel title={`${filtered.length} registro${filtered.length === 1 ? "" : "s"}`} icon={ClipboardList} bodyClass="p-0">
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(r) => r.order.id}
          onRowClick={(r) => openOrder(r.order.id)}
          selectedKey={drawer?.orderId}
          defaultSort={{ key: "situation", dir: "desc" }}
          exportName={`pedidos-frete-${view.filters.from}-a-${view.filters.to}`}
          toolbar={
            <>
              <SearchBox value={search} onChange={setSearch} placeholder="Buscar nº, NF, cliente, cidade, rastreio…" />
              <Segmented
                size="sm"
                value={kind}
                options={[
                  { value: "all", label: "Pedidos e notas" },
                  { value: "Pedido", label: "Pedidos" },
                  { value: "Nota", label: "Notas" },
                ]}
                onChange={setKind}
              />
            </>
          }
          empty={
            <Empty icon={ClipboardList} title="Nenhum pedido com esses filtros">
              Ajuste o período, a transportadora, a situação ou a busca.
            </Empty>
          }
        />
      </Panel>
    </div>
  );
}
