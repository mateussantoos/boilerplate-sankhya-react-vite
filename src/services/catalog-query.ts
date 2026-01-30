import type { CatalogFilters } from "@/components/catalog/use-catalog";

export function buildCatalogQuery(filters: CatalogFilters): string {
  const { 
    description, 
    priceTable, 
    company, 
    segments = [], 
    departments = [], 
    categories = [],
  } = filters;

  // Parameters
  const P_TABPRECO = priceTable || "0";
  const P_DESCR = description ? `%${description.toUpperCase()}%` : null;
  
  // Multi-select handling
  const companyList = company && company.length > 0 ? company.join(",") : "1,2,4";
  
  // Helper for IN clauses
  const buildInClause = (items: string[]) => {
    if (!items || items.length === 0) return "NULL";
    return items.map(i => `'${i}'`).join(","); 
  };

  const P_SEGMENTO_LIST = buildInClause(segments);
  const P_DEPARTAMENTO_LIST = buildInClause(departments);
  const P_CATEGORIA_LIST = buildInClause(categories);

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
    ),

    -- 5. HIERARQUIA DE CLASSIFICAÇÃO (User Logic)
    DADOS_CLASSIFICACAO AS (
        SELECT 
            C1.CODPROD,
            CLA.DESCRICAO,
            ROW_NUMBER() OVER (
                PARTITION BY C1.CODPROD 
                ORDER BY 
                    CASE 
                        WHEN C1.CODCLASSIF = 555 THEN 1 
                        WHEN C1.CODCLASSIF IN (530, 531, 532, 553, 554) THEN 2 
                        WHEN C1.CODCLASSIF BETWEEN 533 AND 552 THEN 3 
                        ELSE 4 
                    END,
                    C1.CODCLASSIF ASC
            ) AS RN
        FROM TGFCLP C1
        JOIN TGFCLA CLA ON CLA.CODCLASSIF = C1.CODCLASSIF
    ),

    HIERARQUIA_PIVOT AS (
        SELECT 
            CODPROD,
            MAX(CASE WHEN RN = 1 THEN DESCRICAO END) AS SEGMENTO,
            MAX(CASE WHEN RN = 2 THEN DESCRICAO END) AS DEPARTAMENTO,
            MAX(CASE WHEN RN = 3 THEN DESCRICAO END) AS CATEGORIA,
            MAX(CASE WHEN RN = 4 THEN DESCRICAO END) AS SUBCATEGORIA
        FROM DADOS_CLASSIFICACAO
        GROUP BY CODPROD
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
        
        -- Classificações
        HC.SEGMENTO,
        HC.DEPARTAMENTO,
        HC.CATEGORIA,
        HC.SUBCATEGORIA,

        -- Seleciona o preço da tabela filtrada
        ISNULL((SELECT TOP 1 PRECO_FINAL FROM CALCULO_GERAL WHERE CODPROD = PRO.CODPROD AND CODTAB = ${P_TABPRECO}), 0) AS VLRVENDA,
        
        -- Estoques
        COALESCE(EST.ESTOQUE_DISP_EMP1, 0) AS ESTOQUE_EMP1,
        COALESCE(EST.ESTOQUE_DISP_EMP2, 0) AS ESTOQUE_EMP2,
        COALESCE(EST.ESTOQUE_DISP_EMP4, 0) AS ESTOQUE_EMP4,
        COALESCE(EST.ESTOQUE_FILTRADO, 0) AS ESTOQUE_ATUAL

    FROM TGFPRO PRO
    LEFT JOIN ESTOQUE_DISPONIVEL EST ON EST.CODPROD = PRO.CODPROD
    LEFT JOIN HIERARQUIA_PIVOT HC ON HC.CODPROD = PRO.CODPROD
    WHERE PRO.ATIVO = 'S'
      AND PRO.USOPROD = 'R'
      AND PRO.AD_ECOMMERCE = 'S'
      
      -- Filtro de Descrição
      AND (PRO.DESCRPROD LIKE '${P_DESCR}' OR ${P_DESCR === null ? '1=1' : '1=0'})
      
      -- Filtros de Classificação
      AND ((${segments.length === 0 ? '1=1' : '1=0'}) OR HC.SEGMENTO IN (${P_SEGMENTO_LIST}))
      AND ((${departments.length === 0 ? '1=1' : '1=0'}) OR HC.DEPARTAMENTO IN (${P_DEPARTAMENTO_LIST}))
      AND ((${categories.length === 0 ? '1=1' : '1=0'}) OR HC.CATEGORIA IN (${P_CATEGORIA_LIST}) OR HC.SUBCATEGORIA IN (${P_CATEGORIA_LIST}))

    ORDER BY PRO.DESCRPROD
  `;
}
