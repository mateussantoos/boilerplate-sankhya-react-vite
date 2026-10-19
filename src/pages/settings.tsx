import { useEffect, useState } from "react";
import { Database, Info, MousePointerClick } from "lucide-react";
import { useCentral } from "@/app/central-context";
import { APP_VERSION } from "@/app/version";
import { Alert, Badge, Field, Panel } from "@/components/ui";
import { BUTTON_KEY, safeStorage } from "@/services/freight/source";

export function SettingsPage() {
  const { data, source, notify } = useCentral();
  const [button, setButton] = useState<number | null | undefined>(undefined);
  const [manual, setManual] = useState(() => safeStorage()?.getItem(BUTTON_KEY) || "");

  useEffect(() => {
    source.buttonId().then(setButton, () => setButton(null));
  }, [source]);

  const setup = data?.setup;
  const row = (ok: boolean | undefined, label: string, detail: string) => (
    <tr>
      <td className="w-[110px]">{ok ? <Badge tone="green">Instalado</Badge> : <Badge tone="red">Ausente</Badge>}</td>
      <td>
        <b>{label}</b>
        <div className="text-xs text-muted">{detail}</div>
      </td>
    </tr>
  );

  const saveManual = () => {
    const v = manual.trim();
    try {
      if (v) safeStorage()?.setItem(BUTTON_KEY, String(Math.trunc(Number(v))));
      else safeStorage()?.removeItem(BUTTON_KEY);
      notify("success", v ? `Botão ${v} salvo neste navegador.` : "Busca automática do botão restaurada.");
      source.buttonId().then(setButton);
    } catch {
      notify("error", "O navegador não permitiu salvar a preferência.");
    }
  };

  return (
    <div className="grid max-w-5xl gap-4">
      <Panel title="Estrutura do frete no banco" icon={Database} bodyClass="p-0">
        {setup && !(setup.quotes && setup.shipments && setup.boxes && setup.orderColumns) && (
          <div className="p-3 pb-0">
            <Alert kind="warning">
              Falta parte da estrutura. No Sankhya, rode o botão de ação <b>Instalar estrutura do frete</b> (módulo
              brasfoot-sankhya-transportadora) e clique em Atualizar aqui.
            </Alert>
          </div>
        )}
        <table className="grid-table">
          <tbody>
            {row(setup?.quotes, "AD_FRETECOT", "Histórico de cotações: base das telas Cotações, Visão geral e Transportadoras.")}
            {row(setup?.shipments, "AD_FRETEENV", "Envios e rastreio: base das telas Envios, Rastreamento e Pendências.")}
            {row(setup?.boxes, "AD_FRETECAIXA", "Caixas padrão da expedição.")}
            {row(setup?.orderColumns, "Colunas AD_FRETE* da TGFCAB", "Situação do frete, último frete cotado e rastreio gravados no pedido e na nota.")}
          </tbody>
        </table>
      </Panel>

      <Panel title='Botão "Cotar frete"' icon={MousePointerClick}>
        <p className="m-0 text-[13px] text-[#555]">
          Para consultar o trajeto e recotar, a central chama o mesmo botão de ação do módulo (Rotina Java{" "}
          <code className="font-mono text-xs">br.com.brasfoot.freight.action.FreightQuoteAction</code>), como o pop-up faz. O id é encontrado
          sozinho na TSIBTA; se não for, informe-o abaixo.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <Field label="Botão em uso">
            {button === undefined ? "procurando…" : button ? `IDBTNACAO ${button}` : <span className="text-[#a94442]">não encontrado</span>}
          </Field>
          <label className="block w-[200px]">
            <span className="label">Id informado à mão (opcional)</span>
            <input className="field" inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ""))} placeholder="busca automática" />
          </label>
          <button type="button" className="btn btn-primary" onClick={saveManual}>
            Salvar
          </button>
        </div>
      </Panel>

      <Panel title="Sobre a central" icon={Info}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Versão">{APP_VERSION}</Field>
          <Field label="Dados">{source.sample ? "Exemplo (fora do Sankhya)" : "Banco do Sankhya"}</Field>
          <Field label="Usuário">{window.sankhyaUserInfo?.name ?? "—"}</Field>
          <Field label="Carregado em">{data ? data.loadedAt.toLocaleString("pt-BR") : "—"}</Field>
        </div>
        <ul className="mb-0 mt-4 pl-5 text-[13px] leading-relaxed text-[#555]">
          <li>Tudo é lido das tabelas do módulo de frete; a central só escreve pelo botão do módulo (rastrear e recotar).</li>
          <li>O trajeto de cada caixa vem ao vivo da transportadora: o banco guarda só a situação mais recente.</li>
          <li>Período, transportadora, ambiente e o menu recolhido ficam salvos neste navegador.</li>
        </ul>
      </Panel>
    </div>
  );
}
