import { useMemo, useState } from "react";
import { Braces, Calculator, CircleAlert } from "lucide-react";
import { useCentral } from "@/app/central-context";
import { BarList } from "@/components/charts";
import { DataTable, SearchBox, matches, type Column } from "@/components/data-table";
import { JsonViewer } from "@/components/json-viewer";
import { Badge, EnvBadge, Empty, Panel, Segmented, Stat } from "@/components/ui";
import { shortName } from "@/services/freight/analytics";
import { describeBoxes, isLarge, parseBoxes } from "@/services/freight/boxes";
import { fmtDateTime, fmtDays, fmtDecimal, fmtKg, fmtM3, fmtMoney, fmtNumber, fmtPercent, fmtZip } from "@/services/freight/format";
import type { Quote } from "@/services/freight/types";

export function QuotesPage() {
  const { view, openOrder } = useCentral();
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<"all" | "ok" | "error">("all");
  const [user, setUser] = useState("all");
  const [json, setJson] = useState<number | null>(null);

  const quotes = useMemo(() => view?.quotes ?? [], [view]);
  const users = useMemo(() => Array.from(new Set(quotes.map((q) => q.user).filter(Boolean))).sort() as string[], [quotes]);

  const stats = useMemo(() => {
    const ok = quotes.filter((q) => q.ok);
    const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
    const errors = new Map<string, number>();
    for (const q of quotes) {
      if (!q.ok) {
        const m = (q.message || "Sem mensagem").replace(/\s+/g, " ").slice(0, 90);
        errors.set(m, (errors.get(m) || 0) + 1);
      }
    }
    return {
      ok: ok.length,
      errors: quotes.length - ok.length,
      fee: avg(ok.map((q) => q.fee ?? 0)),
      weight: avg(quotes.filter((q) => q.weightKg != null).map((q) => q.weightKg!)),
      volume: avg(quotes.filter((q) => q.volumeCm3 != null).map((q) => q.volumeCm3!)),
      boxes: avg(quotes.filter((q) => q.boxCount != null).map((q) => q.boxCount!)),
      topErrors: [...errors.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [quotes]);

  if (!view) return null;

  const filtered = quotes.filter(
    (q) =>
      (result === "all" || (result === "ok" ? q.ok : !q.ok)) &&
      (user === "all" || q.user === user) &&
      matches(search, q.orderId, q.customer, q.city, q.state, q.destinationZip, q.message, q.invoiceNumber, q.id)
  );

  const columns: Column<Quote>[] = [
    { key: "when", header: "Data", render: (q) => fmtDateTime(q.when), sort: (q) => q.when, csv: (q) => fmtDateTime(q.when) },
    {
      key: "order",
      header: "Nº único",
      render: (q) => (
        <span className="font-bold">
          {q.orderId}
          <span className="ml-1.5 text-xs font-normal text-muted">{q.kind ?? ""}</span>
        </span>
      ),
      sort: (q) => q.orderId,
      csv: (q) => q.orderId,
    },
    {
      key: "customer",
      header: "Cliente / CEP destino",
      render: (q) => (
        <div className="max-w-[240px] leading-tight">
          <div className="truncate font-bold">{q.customer ?? "—"}</div>
          <div className="truncate text-xs text-muted">
            {q.city ?? "—"}
            {q.state ? `/${q.state}` : ""} · {fmtZip(q.destinationZip)}
          </div>
        </div>
      ),
      sort: (q) => q.customer,
      csv: (q) => `${q.customer ?? ""} - ${fmtZip(q.destinationZip)}`,
    },
    {
      key: "carrier",
      header: "Transportadora",
      render: (q) => (
        <div className="leading-tight">
          <div className="whitespace-nowrap">{shortName(q.carrierName)}</div>
          <div className="mt-0.5">
            <EnvBadge env={q.environment} />
          </div>
        </div>
      ),
      sort: (q) => q.carrierName,
      csv: (q) => `${q.carrierName ?? ""} (${q.environment === "S" ? "sandbox" : q.environment === "P" ? "produção" : ""})`,
    },
    {
      key: "boxes",
      header: "Caixas",
      render: (q) => {
        const g = parseBoxes(q.boxes);
        const d = describeBoxes(g, view.boxes);
        return (
          <div className="max-w-[190px] leading-tight" title={q.boxes ?? undefined}>
            <div className="font-bold">
              {q.boxCount ?? "—"}
              {isLarge(g) && (
                <span className="ml-1.5">
                  <Badge tone="amber">Grande</Badge>
                </span>
              )}
            </div>
            <div className="truncate text-xs text-muted">{d || "—"}</div>
          </div>
        );
      },
      sort: (q) => q.boxCount,
      csv: (q) => q.boxes,
    },
    {
      key: "weight",
      header: "Peso / volume",
      align: "right",
      render: (q) => (
        <div className="whitespace-nowrap leading-tight">
          <div>{fmtKg(q.weightKg)}</div>
          <div className="text-xs text-muted">{fmtM3(q.volumeCm3)}</div>
          {q.chargedWeightKg != null && <div className="text-xs text-muted">cobrado {fmtKg(q.chargedWeightKg)}</div>}
        </div>
      ),
      sort: (q) => q.weightKg,
      csv: (q) => `${q.weightKg ?? ""} kg; ${q.volumeCm3 ?? ""} cm3; cobrado ${q.chargedWeightKg ?? ""} kg`,
    },
    {
      key: "result",
      header: "Resultado",
      render: (q) =>
        q.ok ? (
          <Badge tone="green">OK</Badge>
        ) : (
          <div className="max-w-[200px] leading-tight">
            <Badge tone="red">Erro{q.httpStatus ? ` ${q.httpStatus}` : ""}</Badge>
            <div className="mt-1 truncate text-xs text-[#a94442]" title={q.message ?? undefined}>
              {q.message}
            </div>
          </div>
        ),
      sort: (q) => (q.ok ? 0 : 1),
      csv: (q) => (q.ok ? "OK" : `ERRO - ${q.message ?? ""}`),
    },
    {
      key: "fee",
      header: "Frete / prazo",
      align: "right",
      render: (q) => (
        <div className="leading-tight">
          <b>{fmtMoney(q.fee)}</b>
          <div className="text-xs text-muted">{fmtDays(q.days)}</div>
        </div>
      ),
      sort: (q) => q.fee,
      csv: (q) => `${q.fee?.toFixed(2).replace(".", ",") ?? ""}; ${q.days ?? ""} dias`,
    },
    { key: "user", header: "Usuário", render: (q) => q.user ?? "—", sort: (q) => q.user, csv: (q) => q.user },
    {
      key: "json",
      header: "",
      render: (q) => (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          title="Ver o JSON enviado e recebido"
          onClick={(e) => {
            e.stopPropagation();
            setJson(q.id);
          }}
        >
          <Braces size={13} /> JSON
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Stat label="Cotações" icon={Calculator} accent="blue" value={fmtNumber(quotes.length)} hint={`${stats.ok} OK · ${stats.errors} com erro`} />
        <Stat label="Taxa de erro" icon={CircleAlert} accent={stats.errors ? "red" : "green"} value={fmtPercent(quotes.length ? stats.errors / quotes.length : null, 1)} />
        <Stat label="Frete médio" value={fmtMoney(stats.fee)} hint="cotações OK" />
        <Stat label="Peso médio" value={fmtKg(stats.weight)} />
        <Stat label="Volume médio" value={fmtM3(stats.volume)} />
        <Stat label="Caixas por cotação" value={fmtDecimal(stats.boxes, 1)} />
      </div>
      {stats.topErrors.length > 0 && (
        <Panel title="Principais erros" icon={CircleAlert}>
          <BarList
            color="#d03b3b"
            labelWidth={380}
            items={stats.topErrors.map(([msg, n]) => ({ key: msg, label: msg, value: n, display: `${n}×`, hint: msg }))}
            limit={6}
          />
        </Panel>
      )}
      <Panel title={`${filtered.length} cotaç${filtered.length === 1 ? "ão" : "ões"}`} icon={Calculator} bodyClass="p-0">
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(q) => q.id}
          onRowClick={(q) => openOrder(q.orderId, "quotes")}
          defaultSort={{ key: "when", dir: "desc" }}
          exportName={`cotacoes-frete-${view.filters.from}-a-${view.filters.to}`}
          toolbar={
            <>
              <SearchBox value={search} onChange={setSearch} placeholder="Buscar nº, cliente, CEP, mensagem…" />
              <Segmented
                size="sm"
                value={result}
                options={[
                  { value: "all", label: "Todas", count: quotes.length },
                  { value: "ok", label: "OK", count: stats.ok },
                  { value: "error", label: "Com erro", count: stats.errors },
                ]}
                onChange={setResult}
              />
              <select className="field h-7 w-[160px] text-xs" value={user} onChange={(e) => setUser(e.target.value)} aria-label="Usuário">
                <option value="all">Todos os usuários</option>
                {users.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </>
          }
          empty={
            <Empty icon={Calculator} title="Nenhuma cotação com esses filtros">
              As cotações aparecem aqui quando alguém usa o botão Cotar frete no Portal.
            </Empty>
          }
        />
      </Panel>
      {json != null && <JsonViewer kind="quote" id={json} onClose={() => setJson(null)} />}
    </div>
  );
}
