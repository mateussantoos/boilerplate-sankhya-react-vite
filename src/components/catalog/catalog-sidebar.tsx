import { useCatalog } from "./use-catalog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Check, Calendar as CalendarIcon, Grid, List, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { useSankhya } from "@/contexts/sankhya-context";

import { toast } from "sonner";

interface FilterOption {
  value: string;
  label: string;
}

export function CatalogSidebar() {
  const { filters, generation } = useCatalog();
  const { executeQuery } = useSankhya();

  const [companies, setCompanies] = useState<FilterOption[]>([]);
  const [priceTables, setPriceTables] = useState<FilterOption[]>([]);
  const [segments, setSegments] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);

  useEffect(() => {
    async function fetchFilters() {
      setIsLoadingFilters(true);
      try {
        // Fetch static-ish lists
        const comps = await executeQuery("SELECT CODEMP, NOMEFANTASIA FROM TSIEMP WHERE ATIVO = 'S' ORDER BY CODEMP");
        setCompanies(comps.map((c: any) => ({ value: String(c.CODEMP), label: c.NOMEFANTASIA })));

        const tabs = await executeQuery("SELECT CODTAB, DESCRTAB FROM TGFTAB WHERE CODTAB <= 25 AND (DTVIGOR <= GETDATE() OR DTVIGOR IS NULL) ORDER BY CODTAB");
        setPriceTables(tabs.map((t: any) => ({ value: String(t.CODTAB), label: `${t.DESCRTAB} (${t.CODTAB})` })));

        // Fetch Classifications using the user logic
        const classQuery = `
          WITH DADOS_CLASSIFICACAO AS (
              SELECT C1.CODPROD, CLA.DESCRICAO,
                  ROW_NUMBER() OVER (PARTITION BY C1.CODPROD ORDER BY 
                      CASE WHEN C1.CODCLASSIF = 555 THEN 1 
                           WHEN C1.CODCLASSIF IN (530, 531, 532, 553, 554) THEN 2 
                           WHEN C1.CODCLASSIF BETWEEN 533 AND 552 THEN 3 ELSE 4 END, C1.CODCLASSIF ASC) AS RN
              FROM TGFCLP C1 JOIN TGFCLA CLA ON CLA.CODCLASSIF = C1.CODCLASSIF
          )
          SELECT DISTINCT
              MAX(CASE WHEN RN = 1 THEN DESCRICAO END) AS SEGMENTO,
              MAX(CASE WHEN RN = 2 THEN DESCRICAO END) AS DEPARTAMENTO,
              MAX(CASE WHEN RN = 3 THEN DESCRICAO END) AS CATEGORIA,
              MAX(CASE WHEN RN = 4 THEN DESCRICAO END) AS SUBCATEGORIA
          FROM DADOS_CLASSIFICACAO
          GROUP BY CODPROD
        `;
        const classResults = await executeQuery(classQuery);
        
        const segs = new Set<string>();
        const depts = new Set<string>();
        const cats = new Set<string>();
        const subcats = new Set<string>();

        classResults.forEach((row: any) => {
          if (row.SEGMENTO) segs.add(row.SEGMENTO);
          if (row.DEPARTAMENTO) depts.add(row.DEPARTAMENTO);
          if (row.CATEGORIA) cats.add(row.CATEGORIA);
          if (row.SUBCATEGORIA) subcats.add(row.SUBCATEGORIA);
        });

        setSegments(Array.from(segs).sort());
        setDepartments(Array.from(depts).sort());
        setCategories(Array.from(new Set([...cats, ...subcats])).sort());

      } catch (error) {
        console.error("Erro ao carregar filtros:", error);
        toast.error("Erro ao carregar filtros do Sankhya");
      } finally {
        setIsLoadingFilters(false);
      }
    }

    fetchFilters();
  }, [executeQuery]);

  const handleSwitchChange = (label: string, value: boolean, setter: (val: boolean) => void) => {
    setter(value);
    toast.success(`${label} ${value ? "ativado" : "desativado"}`, {
      description: "O catalogo foi atualizado.",
    });
  };

  const renderCheckboxList = (
    title: string, 
    options: (string | FilterOption)[], 
    selected: string[], 
    onChange: (val: string[]) => void,
    height: string = "h-[150px]"
  ) => {
    const [search, setSearch] = useState("");
    
    const filteredOptions = options.filter(opt => {
      const label = typeof opt === 'string' ? opt : opt.label;
      return label.toLowerCase().includes(search.toLowerCase());
    });

    const allValues = options.map(opt => typeof opt === 'string' ? opt : opt.value);
    const isAllSelected = allValues.length > 0 && allValues.every(val => selected.includes(val));
    const isSomeSelected = allValues.some(val => selected.includes(val)) && !isAllSelected;

    const handleSelectAll = (checked: boolean) => {
      if (checked) {
        // Add all values that aren't already selected
        const newSelection = Array.from(new Set([...selected, ...allValues]));
        onChange(newSelection);
      } else {
        // Remove all values of this list from the selection
        onChange(selected.filter(val => !allValues.includes(val)));
      }
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[12px] font-bold uppercase text-muted-foreground">{title}</Label>
          {options.length > 0 && (
            <div className="flex items-center space-x-2">
              <Checkbox 
                id={`all-${title}`}
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
                className={cn(isSomeSelected && "data-[state=unchecked]:bg-muted data-[state=unchecked]:text-muted-foreground")}
              />
              <Label htmlFor={`all-${title}`} className="text-[11px] cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                Todos
              </Label>
            </div>
          )}
        </div>
        
        <div className="border rounded-md bg-white/50 overflow-hidden flex flex-col">
          {options.length > 5 && (
            <div className="relative border-b">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder={`Filtrar ${title.toLowerCase()}...`}
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-transparent outline-none placeholder:text-muted-foreground/60"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          
          <ScrollArea className={height}>
            <div className="p-2 space-y-2 pt-1">
              {filteredOptions.map((opt) => {
                const value = typeof opt === 'string' ? opt : opt.value;
                const label = typeof opt === 'string' ? opt : opt.label;
                return (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`${title}-${value}`} 
                      checked={selected.includes(value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onChange([...selected, value]);
                        } else {
                          onChange(selected.filter((v) => v !== value));
                        }
                      }}
                    />
                    <Label htmlFor={`${title}-${value}`} className="font-normal cursor-pointer text-sm">
                      {label}
                    </Label>
                  </div>
                );
              })}
              {filteredOptions.length === 0 && options.length > 0 && (
                <div className="text-xs text-muted-foreground p-2 text-center">Nenhum resultado para "{search}"</div>
              )}
              {options.length === 0 && !isLoadingFilters && (
                <div className="text-xs text-muted-foreground p-2">Nenhuma opção encontrada</div>
              )}
              {isLoadingFilters && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between pb-2 border-b">
        <h2 className="text-lg font-semibold">Configuração</h2>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="flex flex-col gap-6 p-1">
          {/* Main Actions */}
          <div className="space-y-2">
            <Button 
              className="w-full relative overflow-hidden" 
              onClick={generation.handleGenerate} 
              disabled={generation.isGenerating}
            >
              {generation.isGenerating ? (
                <div className="flex items-center justify-center w-full relative z-10">
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   Gerando... {generation.progress}%
                </div>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Gerar Catálogo
                </>
              )}
              {generation.isGenerating && (
                <Progress 
                   value={generation.progress} 
                   className="absolute bottom-0 left-0 w-full h-1 bg-transparent rounded-none [&>div]:bg-white/30" 
                />
              )}
            </Button>
          </div>

          <Separator />

          {/* Search */}
          <div className="space-y-2">
            <Label>Descrição / Pesquisa</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar produtos..." 
                className="pl-8"
                value={filters.description || ""}
                onChange={(e) => filters.setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* View Mode */}
          <div className="flex gap-2 p-1 bg-muted/20 rounded-lg">
             <Button 
                variant={filters.viewMode === 'grid' ? 'default' : 'ghost'} 
                size="sm" 
                className="flex-1"
                onClick={() => filters.setViewMode('grid')}
             >
                <Grid className="w-4 h-4 mr-2" />
                Visualização A4
             </Button>
             <Button 
                variant={filters.viewMode === 'list' ? 'default' : 'ghost'} 
                size="sm" 
                className="flex-1"
                onClick={() => filters.setViewMode('list')}
             >
                <List className="w-4 h-4 mr-2" />
                Lista
             </Button>
          </div>

          <Separator />

          <Accordion type="multiple" defaultValue={["display", "filters"]} className="w-full">
            
            {/* Toggles Group */}
            <AccordionItem value="display">
              <AccordionTrigger>Exibição</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="price">Exibir Preço</Label>
                  <Switch id="price" checked={filters.showPrice} onCheckedChange={(v) => handleSwitchChange("Preço", v, filters.setShowPrice)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="barcode">Código de Barras</Label>
                  <Switch id="barcode" checked={filters.showBarcode} onCheckedChange={(v) => handleSwitchChange("Código de Barras", v, filters.setShowBarcode)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="stock">Exibir Estoque</Label>
                  <Switch id="stock" checked={filters.showStock} onCheckedChange={(v) => handleSwitchChange("Estoque", v, filters.setShowStock)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="cest">Exibir CEST</Label>
                  <Switch id="cest" checked={filters.showCest} onCheckedChange={(v) => handleSwitchChange("CEST", v, filters.setShowCest)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="cover">Capa do Catálogo</Label>
                  <Switch id="cover" checked={filters.showCover} onCheckedChange={(v) => handleSwitchChange("Capa", v, filters.setShowCover)} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Filters Group */}
            <AccordionItem value="filters">
               <AccordionTrigger>Filtros de Produtos</AccordionTrigger>
               <AccordionContent className="space-y-4 pt-2">
                  
                  {renderCheckboxList("Empresa", companies, filters.company || [], filters.setCompany, "h-[90px]")}
                  
                  <div className="space-y-2">
                    <Label className="text-[12px] font-bold uppercase text-muted-foreground">Tabela de Preço</Label>
                    <div className="border rounded-md p-2 bg-white/50">
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {priceTables.map((tab) => (
                            <div key={tab.value} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`tab-${tab.value}`} 
                                checked={filters.priceTable === tab.value}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    filters.setPriceTable(tab.value);
                                  } else if (filters.priceTable === tab.value) {
                                    filters.setPriceTable(""); 
                                  }
                                }}
                              />
                              <Label htmlFor={`tab-${tab.value}`} className="font-normal cursor-pointer text-sm">
                                {tab.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  {renderCheckboxList("Segmento", segments, filters.segments || [], filters.setSegments)}
                  {renderCheckboxList("Departamento", departments, filters.departments || [], filters.setDepartments)}
                  {renderCheckboxList("Categoria", categories, filters.categories || [], filters.setCategories)}

                  <div className="space-y-2 flex flex-col pt-4 border-t">
                    <Label className="text-[12px] font-bold uppercase text-muted-foreground">Validade (Opcional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !filters.date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.date ? format(filters.date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={filters.date || undefined}
                          onSelect={(d) => filters.setDate(d || null)}
                          initialFocus
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
               </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>
      </ScrollArea>
    </div>
  );
}
