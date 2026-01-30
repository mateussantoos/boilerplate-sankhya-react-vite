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

import { toast } from "sonner";

export function CatalogSidebar() {
  const { filters, generation } = useCatalog();

  const handleSwitchChange = (label: string, value: boolean, setter: (val: boolean) => void) => {
    setter(value);
    toast.success(`${label} ${value ? "ativado" : "desativado"}`, {
      description: "O catalogo foi atualizado.",
    });
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
                  {/* Empresa Filter */}
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <div className="border rounded-md p-2">
                      <ScrollArea className="h-[90px]">
                        <div className="space-y-2">
                          {[
                            { value: "1", label: "VERON" },
                            { value: "2", label: "JTX" },
                            { value: "4", label: "LOV" },
                          ].map((company) => (
                            <div key={company.value} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`company-${company.value}`} 
                                checked={filters.company?.includes(company.value)}
                                onCheckedChange={(checked) => {
                                  const current = filters.company || [];
                                  if (checked) {
                                      filters.setCompany([...current, company.value]);
                                  } else {
                                      filters.setCompany(current.filter((v) => v !== company.value));
                                  }
                                }}
                              />
                              <Label htmlFor={`company-${company.value}`} className="font-normal cursor-pointer">
                                {company.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  {/* Price Table Filter */}
                  <div className="space-y-2">
                    <Label>Tabela de Preço</Label>
                    <div className="border rounded-md p-2">
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {[
                              { value: "0", label: "V1 (0)" },
                              { value: "1", label: "VX (1)" },
                              { value: "2", label: "A1 (2)" },
                              { value: "3", label: "AX (3)" },
                              { value: "4", label: "AXB (4)" },
                              { value: "5", label: "CASA GRANDE (5)" },
                              { value: "6", label: "A1 BAIÃO (6)" },
                              { value: "8", label: "V20 (8)" },
                              { value: "9", label: "CONFIANÇA (9)" },
                              { value: "10", label: "PAGUE MENOS (10)" },
                              { value: "11", label: "V16 (11)" },
                              { value: "12", label: "IMPORTEC (12)" },
                              { value: "13", label: "V5 (13)" },
                              { value: "14", label: "SP5 (14)" },
                              { value: "15", label: "V10 (15)" },
                              { value: "16", label: "PREÇO 12 (16)" },
                              { value: "17", label: "PREÇO 12,5 (17)" },
                              { value: "18", label: "VY (18)" },
                              { value: "19", label: "FUNCIONÁRIOS (19)" },
                              { value: "20", label: "AB1 (20)" },
                              { value: "21", label: "SP1 (21)" },
                              { value: "22", label: "ASP1 (22)" },
                              { value: "23", label: "SP16 (23)" },
                              { value: "24", label: "SP10 (24)" },
                              { value: "25", label: "SPX (25)" },
                          ].map((tab) => (
                            <div key={tab.value} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`tab-${tab.value}`} 
                                checked={filters.priceTable === tab.value}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    filters.setPriceTable(tab.value);
                                  } else if (filters.priceTable === tab.value) {
                                    filters.setPriceTable(""); // Toggle off if clicking same
                                  }
                                }}
                              />
                              <Label htmlFor={`tab-${tab.value}`} className="font-normal cursor-pointer">
                                {tab.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  {/* Groups Filter */}
                  <div className="space-y-2">
                    <Label>Grupos</Label>
                    <div className="border rounded-md p-2">
                      <ScrollArea className="h-[150px]">
                        <div className="space-y-2">
                          {[
                             { value: "10000", label: "Móveis" },
                             { value: "20000", label: "Decoração" },
                             { value: "30000", label: "Iluminação" },
                             { value: "40000", label: "Cama, Mesa e Banho" },
                             { value: "50000", label: "Utilidades Domésticas" },
                          ].map((group) => (
                            <div key={group.value} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`group-${group.value}`}
                                checked={filters.groups?.includes(group.value)}
                                onCheckedChange={(checked) => {
                                  const current = filters.groups || [];
                                  if (checked) {
                                     filters.setGroups([...current, group.value]);
                                  } else {
                                     filters.setGroups(current.filter(v => v !== group.value));
                                  }
                                }}
                              />
                              <Label htmlFor={`group-${group.value}`} className="font-normal cursor-pointer">
                                {group.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                   {/* Departments Filter */}
                  <div className="space-y-2">
                    <Label>Departamentos</Label>
                    <div className="border rounded-md p-2">
                      <ScrollArea className="h-[150px]">
                        <div className="space-y-2">
                          {[
                             { value: "101000", label: "Sala de Estar" },
                             { value: "102000", label: "Cozinha" },
                             { value: "201000", label: "Vasos" },
                             { value: "202000", label: "Quadros" },
                             { value: "301000", label: "Luminárias" },
                             { value: "401000", label: "Lençóis" },
                          ].map((dept) => (
                            <div key={dept.value} className="flex items-center space-x-2">
                               <Checkbox 
                                  id={`dept-${dept.value}`}
                                  checked={filters.departments?.includes(dept.value)}
                                  onCheckedChange={(checked) => {
                                    const current = filters.departments || [];
                                    if (checked) {
                                       filters.setDepartments([...current, dept.value]);
                                    } else {
                                       filters.setDepartments(current.filter(v => v !== dept.value));
                                    }
                                  }}
                               />
                               <Label htmlFor={`dept-${dept.value}`} className="font-normal cursor-pointer">
                                  {dept.label}
                               </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  <div className="space-y-2 flex flex-col pt-4 border-t">
                    <Label>Validade (Opcional)</Label>
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
