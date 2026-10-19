import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { useCentral } from "@/app/central-context";
import { Alert, Modal, Spinner, Tabs } from "./ui";

function pretty(text: string | null): string {
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/** Requisição e resposta gravadas numa cotação (AD_FRETECOT) ou num envio (AD_FRETEENV). */
export function JsonViewer({ kind, id, onClose }: { kind: "quote" | "shipment"; id: number; onClose: () => void }) {
  const { source, notify } = useCentral();
  const [tab, setTab] = useState<"request" | "response">("response");
  const [data, setData] = useState<{ request: string | null; response: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    source
      .loadJson(kind, id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [source, kind, id]);

  const text = pretty(data ? data[tab] : null);
  return (
    <Modal title={`${kind === "quote" ? "Cotação" : "Envio"} nº ${id} · JSON trocado com a transportadora`} onClose={onClose} width={900}>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "response", label: "Resposta" },
          { value: "request", label: "Requisição" },
        ]}
      />
      <div className="mt-3">
        {error && <Alert kind="error">{error}</Alert>}
        {!data && !error && (
          <div className="flex items-center gap-2 py-6 text-muted">
            <Spinner /> Carregando…
          </div>
        )}
        {data && (
          <>
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={!text}
                onClick={() => {
                  navigator.clipboard?.writeText(text).then(
                    () => notify("success", "JSON copiado."),
                    () => notify("error", "Não foi possível copiar.")
                  );
                }}
              >
                <Copy size={13} /> Copiar
              </button>
            </div>
            <pre className="m-0 max-h-[60vh] overflow-auto rounded-[3px] border border-line bg-[#fafafa] p-3 font-mono text-xs leading-relaxed">
              {text || "(vazio)"}
            </pre>
          </>
        )}
      </div>
    </Modal>
  );
}
