# Central de Fretes — componente de BI HTML5 do Sankhya

Painel completo do frete da Brasfoot dentro do Sankhya. Mostra:

- o que foi **cotado**;
- o que foi **enviado**;
- o **trajeto** de cada caixa;
- o **desempenho de cada transportadora**;
- o que **pede atenção**.

Lê as tabelas do módulo de frete [brasfoot-sankhya-transportadora](../brasfoot-sankhya-transportadora) e conversa com o mesmo botão **Cotar frete** que o pop-up usa.

Feito sobre o [boilerplate-sankhya-react-vite](https://github.com/mateussantoos/boilerplate-sankhya-react-vite) (React 19, Vite 7, TypeScript e Tailwind 4), no visual das telas HTML5 do Sankhya:
- verde Sankhya na seleção e nos destaques;
- botão principal grafite;
- painéis com barra de título cinza;
- ícones Lucide.

## Telas

O menu lateral pode ser recolhido. Os filtros de período (7/30/90 dias ou datas), transportadora e ambiente (produção/sandbox) valem para todas as telas e ficam salvos no navegador.

### Visão geral

Indicadores:
- pedidos cotados e taxa de erro;
- frete cotado e prazo médio;
- envios, em andamento, entregues (com prazo real e % no prazo);
- pendências.

Também mostra:
- a situação dos pedidos (clicável);
- o gráfico de cotações e envios por dia;
- o frete por UF de destino;
- os clientes com mais envios;
- a atividade recente.

### Pendências

São cinco tipos de pendência:
- problema na entrega;
- envio recusado;
- rastreio parado há mais de 3 dias;
- cotação com erro sem cotação OK depois;
- cotado e sem envio há mais de 5 dias.

### Pedidos

Pedidos e notas cotados ou enviados, com:
- situação, transportadora, frete, prazo, valor e peso;
- última situação do rastreio;
- filtros por situação e tipo, busca e exportação CSV.

### Envios

Envios solicitados e recusados:
- NF-e, pedido na transportadora, caixas, peso e frete;
- situação e dias desde o envio.

### Rastreamento

Colunas por etapa: aguardando coleta, em trânsito, problema e entregues.

**Atualizar rastreio de todos** consulta a transportadora agora, pedido a pedido. É o mesmo que a ação agendada do módulo faz sozinha.

### Cotações

Todas as cotações:
- caixas, peso, volume e peso cobrado;
- resultado, frete, prazo e usuário;
- os principais erros;
- o **JSON** enviado e recebido.

### Transportadoras

Para cada transportadora:
- integração do módulo e ambiente;
- frete e prazo médios;
- quantas vezes foi a mais barata;
- envios, entregas, prazo real, % no prazo e problemas.

Também traz um comparativo entre elas.

### Caixas

O catálogo da `AD_FRETECAIXA` e as caixas mais usadas no período (padrão e avulsas).

### Configurações

- o que da estrutura do frete existe no banco;
- o botão do módulo em uso;
- informações da central.

### Detalhe do pedido

Clique em qualquer linha para abrir o painel lateral. Ele tem cinco abas:

- **Resumo:** origem → destino com endereço e CEP; dados do pedido, frete, rastreio e as caixas.
- **Trajeto:** consulta a transportadora na hora. Para cada caixa mostra os marcos (solicitado → coletado → em trânsito → agência → saiu para entrega → entregue) e os eventos com data, local e motivo de falha. Caixas com o mesmo trajeto aparecem juntas.
- **Cotações:** histórico do pedido, o JSON de cada cotação e **Recotar com as mesmas caixas** (enquanto não há envio).
- **Envio:** pedido na transportadora, referência, NF-e, os códigos de rastreio e a **etiqueta (PDF) de cada caixa**.
- **Itens:** produtos do pedido.

O botão **Abrir no Sankhya** abre a Central de Notas no registro.

Atalho: `index.jsp?nunota=776934&aba=route` abre a central já no pedido. As abas são `summary`, `route`, `quotes`, `shipment` e `items`.

## De onde vêm os dados

| Origem | O que traz |
|---|---|
| `AD_FRETECOT` | Toda cotação (OK/ERRO): caixas, peso, volume, CEPs, frete, prazo, peso cobrado, mensagem e JSON |
| `AD_FRETEENV` | Todo envio (OK/ERRO): pedido na transportadora, códigos de rastreio, etiquetas, caixas, peso e última situação do rastreio |
| `AD_FRETECAIXA` | Caixas padrão da expedição |
| `TGFCAB` (`AD_FRETE*`) | Situação do frete gravada no pedido e na nota |
| `TGFPAR`, `TSICID`, `TSIUFS`, `TSIEND`, `TSIBAI`, `TSIEMP`, `TGFITE`, `TGFPRO`, `TGFVEN`, `TSIUSU` | Cliente, cidade/UF, endereços, itens, vendedor e usuários |
| Botão **Cotar frete** (`ACAO=RASTREAR`, `ACAO=COTAR`) | Trajeto ao vivo de cada caixa e nova cotação |

Como cada parte funciona:

- **Consultas.** Todo SQL está em [src/services/freight/sql.ts](src/services/freight/sql.ts). São só `SELECT`, pelo `executeQuery` nativo do `<snk:load/>`, uma de cada vez.
- **Estrutura ausente.** A central confere quais tabelas e colunas existem (`INFORMATION_SCHEMA`, com reserva no dicionário `TDDTAB`/`TDDCAM`) e só cita o que existe. Assim ela abre mesmo antes de rodar o **Instalar estrutura do frete**, e avisa o que falta.
- **Trajeto.** O trajeto completo **não fica gravado**: o banco guarda só a situação mais recente. Por isso a aba Trajeto chama o botão do módulo, que consulta a transportadora e também atualiza a situação gravada.
- **Chamadas ao botão.** Vão uma por vez, com até 2 novas tentativas em "situação de concorrência", como no pop-up ([src/services/freight/java.ts](src/services/freight/java.ts)).
- **Id do botão.** É encontrado sozinho na `TSIBTA`, pela Rotina Java `FreightQuoteAction`. Se não for, informe-o em **Configurações**.

## Instalar no Sankhya

Pré-requisitos (módulo de frete, versão 2.2.0 ou mais nova):

- o jar no Módulo Java;
- o botão **Cotar frete** cadastrado;
- **Instalar estrutura do frete** rodado na base.

Passos:

1. Gere o pacote:
   ```bash
   pnpm install
   pnpm build
   ```
   Sai `dist/central-fretes.zip`, com `index.jsp`, `assets/app.js` e `assets/index.css`.
2. No Sankhya, abra **Construtor de Componentes de BI** e crie um componente do tipo **HTML5**.
   - Título: **Central de Fretes**. A tela cheia procura o componente por esse título (`TSIGDG.TITULO`).
   - Importe o `central-fretes.zip`. A página de entrada é `index.jsp`.
3. Publique o componente num **dashboard** ou no menu e libere o acesso aos usuários da expedição e do comercial.
4. Abra a central. Ela tira a moldura do dashboard e ocupa a tela toda.

Para atualizar, gere o zip de novo e reimporte no mesmo componente.

## Desenvolvimento

```bash
pnpm install
pnpm dev      # http://localhost:5173, com DADOS DE EXEMPLO (fora do Sankhya)
pnpm lint
pnpm build    # tsc + vite + dist/central-fretes.zip
```

Fora do Sankhya (sem o `executeQuery` nativo e fora de `/mge/`), a central usa [sample-source.ts](src/services/freight/sample-source.ts):
- ~170 pedidos fictícios coerentes, com cotações, envios, trajetos e erros;
- uma etiqueta **Dados de exemplo** no topo;
- nada vai ao banco.

```
src/
  app/                 app.tsx (esqueleto, tela cheia), central-context.tsx (filtros, carga, navegação, painel)
  components/          layout (menu e filtros), ui (padrão Sankhya), charts (SVG), data-table,
                       order-drawer (detalhe do pedido), route-view (trajeto), feeds, json-viewer
  pages/               uma tela por arquivo
  services/freight/    types, sql, rows (linha → objeto), source (Sankhya), sample-source (exemplo),
                       java (botão do módulo), analytics (indicadores e pendências), status, boxes, format
  services/sankhya/    camada do boilerplate (executeQuery, removeFrame, openApp…)
public/index.jsp       página de entrada no Sankhya (<snk:load/>, usuário logado)
```

**Gráficos.** São SVG próprios, sem biblioteca. A paleta foi validada para daltonismo sobre fundo branco: azul `#2a78d6`, laranja `#eb6834` e verde-água `#1baf7a`, este último só com rótulo visível. Têm legenda quando há duas séries e dica ao passar o mouse.

## Conferir na homologação

Estes pontos só dão para validar dentro do Sankhya:

- [ ] **Consultas com parâmetros.** O `executeQuery` nativo aceita os parâmetros `?` (período como texto `yyyy-mm-dd` em `CONVERT(DATETIME, ?, 120)`).
- [ ] **Estrutura instalada.** A consulta ao `INFORMATION_SCHEMA` funciona com o usuário do banco do Sankhya. Se não funcionar, a central usa o dicionário.
- [ ] **Trajeto e recotar.** O botão é chamado de dentro do componente de BI (`ActionButtonsSP.executeJava`).
- [ ] **Abrir no Sankhya.** `br.com.sankhya.com.mov.CentralNotas` é o recurso da Central de Notas nesta versão (constante `ORDER_SCREEN` em [order-drawer.tsx](src/components/order-drawer.tsx)).
- [ ] **Etiquetas.** As URLs (`LABELURLS`) abrem fora da rede da Anjun.

## Versões

| Versão | Mudanças |
|---|---|
| 1.0.0 | Primeira versão: visão geral, pendências, pedidos, envios, rastreamento (com atualização em lote), cotações (com JSON), transportadoras, caixas e configurações; detalhe do pedido com trajeto ao vivo, recotar, etiquetas e itens; dados de exemplo para desenvolvimento |

---

Feito por M.S. | Design & Developer, sobre o boilerplate-sankhya-react-vite.
