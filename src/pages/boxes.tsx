import { useMemo } from "react";
import { BarChart3, Boxes } from "lucide-react";
import { useCentral } from "@/app/central-context";
import { BarList } from "@/components/charts";
import { DataTable, type Column } from "@/components/data-table";
import { Alert, Badge, Empty, Panel, Stat } from "@/components/ui";
import { boxUsage } from "@/services/freight/analytics";
import { fmtDecimal, fmtM3, fmtNumber } from "@/services/freight/format";
import type { BoxType } from "@/services/freight/types";

export function BoxesPage() {
  const { view, data } = useCentral();
  const usage = useMemo(() => (view ? boxUsage(view) : null), [view]);
  if (!view || !data || !usage) return null;

  const used = new Map(usage.usage.map((u) => [u.key, u]));
  const vol = (b: BoxType) => (b.lengthCm && b.widthCm && b.heightCm ? b.lengthCm * b.widthCm * b.heightCm : null);

  const columns: Column<BoxType>[] = [
    { key: "id", header: "Código", render: (b) => b.id, sort: (b) => b.id, csv: (b) => b.id },
    { key: "name", header: "Caixa", render: (b) => <b>{b.name}</b>, sort: (b) => b.name, csv: (b) => b.name },
    {
      key: "dims",
      header: "C × L × A (cm)",
      render: (b) =>
        b.lengthCm && b.widthCm && b.heightCm ? (
          `${fmtDecimal(b.lengthCm, 1)} × ${fmtDecimal(b.widthCm, 1)} × ${fmtDecimal(b.heightCm, 1)}`
        ) : (
          <Badge tone="amber">Medidas a cadastrar</Badge>
        ),
      csv: (b) => `${b.lengthCm ?? ""}x${b.widthCm ?? ""}x${b.heightCm ?? ""}`,
    },
    { key: "volume", header: "Volume", align: "right", render: (b) => fmtM3(vol(b)), sort: (b) => vol(b), csv: (b) => vol(b) },
    { key: "weight", header: "Peso vazia", align: "right", render: (b) => (b.weightKg != null ? `${fmtDecimal(b.weightKg, 3)} kg` : "—"), sort: (b) => b.weightKg, csv: (b) => b.weightKg },
    {
      key: "used",
      header: "Usadas no período",
      align: "right",
      render: (b) => fmtNumber(used.get(`c${b.id}`)?.quantity ?? 0),
      sort: (b) => used.get(`c${b.id}`)?.quantity ?? 0,
      csv: (b) => used.get(`c${b.id}`)?.quantity ?? 0,
    },
    { key: "active", header: "No pop-up", render: (b) => (b.active ? <Badge tone="green">Ativa</Badge> : <Badge tone="neutral">Inativa</Badge>), sort: (b) => (b.active ? 0 : 1), csv: (b) => (b.active ? "S" : "N") },
    { key: "order", header: "Ordem", align: "right", render: (b) => b.order ?? "—", sort: (b) => b.order, csv: (b) => b.order },
  ];

  const total = usage.usage.reduce((a, u) => a + u.quantity, 0);
  const custom = used.get("avulsa")?.quantity ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {!data.setup.boxes && (
        <Alert kind="warning">
          A tabela <b>AD_FRETECAIXA</b> ainda não existe: o pop-up usa as caixas do próprio módulo. Rode o botão <b>Instalar estrutura do frete</b>{" "}
          para cadastrá-las e poder editar nomes e medidas.
        </Alert>
      )}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <Stat label="Caixas cadastradas" icon={Boxes} accent="blue" value={fmtNumber(data.boxes.length)} hint={`${data.boxes.filter((b) => b.active).length} ativas no pop-up`} />
        <Stat label={usage.source === "shipments" ? "Caixas enviadas" : "Caixas cotadas"} value={fmtNumber(total)} hint="no período" />
        <Stat label="Caixas por pedido" value={fmtDecimal(usage.perOrder, 1)} hint="média" />
        <Stat label="Avulsas" value={fmtNumber(custom)} hint={total ? `${fmtDecimal((custom / total) * 100, 0)}% do total` : undefined} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Caixas padrão (AD_FRETECAIXA)" icon={Boxes} bodyClass="p-0">
          <DataTable
            rows={data.boxes}
            columns={columns}
            rowKey={(b) => b.id}
            exportName="caixas-frete"
            empty={<Empty icon={Boxes} title="Nenhuma caixa cadastrada" />}
          />
        </Panel>
        <Panel title={usage.source === "shipments" ? "Mais usadas nos envios" : "Mais usadas nas cotações"} icon={BarChart3}>
          {usage.usage.length ? (
            <BarList
              labelWidth={90}
              items={usage.usage.map((u) => ({
                key: u.key,
                label: u.label,
                value: u.quantity,
                display: (
                  <span>
                    {fmtNumber(u.quantity)} <span className="font-normal text-muted">· {u.orders} ped.</span>
                  </span>
                ),
                hint: `${u.quantity} caixa(s) em ${u.orders} pedido(s)`,
              }))}
              limit={14}
            />
          ) : (
            <Empty title="Sem caixas informadas no período" />
          )}
        </Panel>
      </div>
      <p className="m-0 text-xs text-muted">
        Nomes, medidas e a ordem no pop-up são editados no Sankhya, pela tela do Construtor de Telas sobre a AD_FRETECAIXA. Medidas em
        cm; peso da caixa vazia em kg (somado ao peso do pedido no pop-up).
      </p>
    </div>
  );
}
