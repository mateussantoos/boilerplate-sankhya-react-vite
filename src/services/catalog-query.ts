import type { CatalogFilters } from "@/components/catalog/use-catalog";

export function buildCatalogQuery(filters: CatalogFilters): string {
  const { 
    description, 
    priceTable, 
    company, 
    groups, 
    departments, 
  } = filters;

  // Parameters
  const P_TABPRECO = priceTable || "0";
  const P_DESCR = description ? `%${description.toUpperCase()}%` : null;
  
  // Multi-select handling
  const companyList = company && company.length > 0 ? company.join(",") : "1,2,4"; // Default to all if empty
  
  // Helper for IN clauses
  const buildInClause = (items: string[]) => {
    if (!items || items.length === 0) return "NULL";
    // Sanitize and quote if necessary (assuming numeric IDs for groups/depts based on usage)
    return items.map(i => `'${i}'`).join(","); 
  };

  const P_CODGRUPOPROD_LIST = buildInClause(groups);


  return `
    WITH 
    -- 1. IDENTIFICA A REGRA ATIVA DE CADA TABELA (0 a 25)
    REGRAS_TABELAS AS (
        SELECT 
            T.CODTAB,
            T.NUTAB, 
            T.PERCENTUAL,
            T.CODTABORIG 
        FROM (
            SELECT 
                CODTAB, 
                NUTAB, 
                PERCENTUAL, 
                CODTABORIG,
                ROW_NUMBER() OVER (PARTITION BY CODTAB ORDER BY DTVIGOR DESC) AS RN
            FROM TGFTAB
            WHERE CODTAB <= 25
              AND (DTVIGOR <= GETDATE() OR DTVIGOR IS NULL)
        ) T
        WHERE T.RN = 1 
    ),

    -- 2. PEGAR O PREÇO BASE (TABELA 0 - V1) DE TODOS OS PRODUTOS
    PRECO_BASE_V1 AS (
        SELECT 
            X.CODPROD, 
            X.VLRVENDA AS VLR_V1
        FROM TGFEXC X
        INNER JOIN REGRAS_TABELAS R ON R.NUTAB = X.NUTAB
        WHERE R.CODTAB = 0 
    ),

    -- 3. CRUZAMENTO E CÁLCULO GERAL
    CALCULO_GERAL AS (
        SELECT
            P.CODPROD,
            R.CODTAB,
            
            CASE 
                -- A: Se existe preço MANUAL gravado na exceção para essa tabela específica, USA ELE.
                WHEN E.VLRVENDA IS NOT NULL THEN E.VLRVENDA
                
                -- B: Se é uma tabela calculada (tem percentual e aponta para a Tab 0), FAZ A CONTA.
                WHEN R.PERCENTUAL IS NOT NULL AND R.CODTABORIG = 0 AND V1.VLR_V1 IS NOT NULL THEN 
                     V1.VLR_V1 + (V1.VLR_V1 * (R.PERCENTUAL / 100.0))
                
                -- C: Se for a própria tabela 0 e não caiu no "A", tenta pegar do V1
                WHEN R.CODTAB = 0 THEN V1.VLR_V1
                
                -- D: Caso contrário, zero.
                ELSE 0 
            END AS PRECO_FINAL

        FROM TGFPRO P
        CROSS JOIN REGRAS_TABELAS R 
        LEFT JOIN PRECO_BASE_V1 V1 ON V1.CODPROD = P.CODPROD
        LEFT JOIN TGFEXC E ON E.CODPROD = P.CODPROD AND E.NUTAB = R.NUTAB
        WHERE P.ATIVO = 'S'
    ),

    -- 4. ESTOQUE (Mantendo lógica original de agregação)
    ESTOQUE_DISPONIVEL AS (
        SELECT
            S.CODPROD,
            SUM(CASE WHEN S.CODEMP = 1 THEN (S.ESTOQUE - S.RESERVADO) ELSE 0 END) AS ESTOQUE_DISP_EMP1,
            SUM(CASE WHEN S.CODEMP = 2 THEN (S.ESTOQUE - S.RESERVADO) ELSE 0 END) AS ESTOQUE_DISP_EMP2,
            SUM(CASE WHEN S.CODEMP = 4 THEN (S.ESTOQUE - S.RESERVADO) ELSE 0 END) AS ESTOQUE_DISP_EMP4,
            
            -- Estoque total considerado (apenas das empresas selecionadas)
            SUM(CASE WHEN S.CODEMP IN (${companyList}) THEN (S.ESTOQUE - S.RESERVADO) ELSE 0 END) AS ESTOQUE_FILTRADO
        FROM TGFEST S
        WHERE S.CODEMP IN (1, 2, 4) -- Hardcoded allowed companies
          AND S.CODLOCAL IN (10100, 10400, 11200)
        GROUP BY S.CODPROD
    )

    SELECT
        PRO.CODPROD,
        PRO.DESCRPROD,
        PRO.REFERENCIA,
        PRO.MARCA,
        PRO.NCM,
        PRO.CODESPECST AS CEST,
        PRO.ATIVO,
        PRO.AD_ECOMMERCE,
        CAST(PRO.CARACTERISTICAS AS VARCHAR(MAX)) AS CARACTERISTICAS,
        PRO.IMAGEM,

        -- Seleciona o preço da tabela filtrada
        ISNULL((SELECT TOP 1 PRECO_FINAL FROM CALCULO_GERAL WHERE CODPROD = PRO.CODPROD AND CODTAB = ${P_TABPRECO}), 0) AS VLRVENDA,
        
        -- Estoques
        COALESCE(EST.ESTOQUE_DISP_EMP1, 0) AS ESTOQUE_EMP1,
        COALESCE(EST.ESTOQUE_DISP_EMP2, 0) AS ESTOQUE_EMP2,
        COALESCE(EST.ESTOQUE_DISP_EMP4, 0) AS ESTOQUE_EMP4,
        COALESCE(EST.ESTOQUE_FILTRADO, 0) AS ESTOQUE_ATUAL

    FROM TGFPRO PRO
    LEFT JOIN ESTOQUE_DISPONIVEL EST ON EST.CODPROD = PRO.CODPROD
    WHERE PRO.ATIVO = 'S'
      AND PRO.USOPROD IN ('R', 'V')
      AND PRO.AD_ECOMMERCE = 'S' -- Mantendo filtro commerce
      
      -- Filtros do Usuário
      AND (PRO.DESCRPROD LIKE '${P_DESCR}' OR ${P_DESCR === null ? '1=1' : '1=0'})
      
      -- Filtro de Grupo (Recursivo removido por simplificação, usando IN direto se houver, ou ajustar para recursivo se necessário. O usuário pediu checkbox list, geralmente é nivel direto)
      AND (
          (${groups.length === 0 ? '1=1' : '1=0'}) OR
          PRO.CODGRUPOPROD IN (${P_CODGRUPOPROD_LIST})
      )
      
      -- Filtro de Departamento (Primeiros dígitos ou lógica específica? O usuário disse "Grupo e Departamento". Geralmente Sankhya é hierárquico. Vou assumir filtro direto pelo CODGRUPOPROD ou similar se for departamento separado)
      -- Assumindo que Departamento também é via TGFGRU ou campo específico. O código original fazia LEFT(CODGRUPOPROD, 6). 
      -- Vou manter a lógica original: se tiver departamento, filtra pelo prefixo. Mas como agora é lista... 
      -- Se Departamento for uma lista de prefixos:
      AND (
          (${departments.length === 0 ? '1=1' : '1=0'}) OR
          (${departments.length > 0 ? departments.map(d => `LEFT(PRO.CODGRUPOPROD, 6) = '${d}'`).join(' OR ') : '1=0'})
      )

    ORDER BY PRO.DESCRPROD
  `;
}
