import { useMemo, useState } from "react";
import { BellRing, PackageCheck } from "lucide-react";
import { useCentral } from "@/app/central-context";
import { ATTENTION_ICON, AttentionList } from "@/components/feeds";
import { Empty, Panel, Segmented } from "@/components/ui";
import { ATTENTION_LABEL, QUOTED_IDLE_DAYS, STALE_DAYS, attention, type AttentionKind } from "@/services/freight/analytics";

const KINDS: AttentionKind[] = ["problem", "refused", "stale", "quoteError", "idle"];

export function AttentionPage() {
  const { view } = useCentral();
  const [kind, setKind] = useState<"all" | AttentionKind>("all");
  const items = useMemo(() => (view ? attention(view) : []), [view]);
  if (!view) return null;

  const counts = new Map<AttentionKind, number>();
  items.forEach((a) => counts.set(a.kind, (counts.get(a.kind) || 0) + 1));
  const shown = kind === "all" ? items : items.filter((a) => a.kind === kind);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {KINDS.map((k) => {
          const { icon: Icon, color } = ATTENTION_ICON[k];
          const n = counts.get(k) || 0;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(kind === k ? "all" : k)}
              className={`panel flex items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[#fafafa] ${kind === k ? "ring-2 ring-snk-green" : ""}`}
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${n ? color : "text-faint"}`} aria-hidden />
              <span>
                <span className="block text-xs text-muted">{ATTENTION_LABEL[k]}</span>
                <span className="block text-[22px] font-bold leading-tight">{n}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Panel
        title={`${shown.length} pendência${shown.length === 1 ? "" : "s"}`}
        icon={BellRing}
        bodyClass="p-0"
        actions={
          <Segmented
            size="sm"
            value={kind}
            options={[{ value: "all" as const, label: "Todas", count: items.length }, ...KINDS.filter((k) => counts.get(k)).map((k) => ({ value: k, label: ATTENTION_LABEL[k].split(" (")[0].replace(/ há mais.*$/, ""), count: counts.get(k) }))]}
            onChange={setKind}
          />
        }
      >
        {shown.length ? (
          <AttentionList items={shown} />
        ) : (
          <Empty icon={PackageCheck} title="Nada pendente">
            Nenhum problema na entrega, rastreio parado há mais de {STALE_DAYS} dias, envio recusado ou pedido cotado há mais de{" "}
            {QUOTED_IDLE_DAYS} dias sem envio.
          </Empty>
        )}
      </Panel>
    </div>
  );
}
