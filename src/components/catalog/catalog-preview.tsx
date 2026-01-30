import { useCatalog } from "./use-catalog";
import { CatalogPage } from "./catalog-page";
import { CatalogProductCard } from "./catalog-product-card";
import { CatalogImage } from "./catalog-image";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function CatalogPreview() {
  const { filters, generation } = useCatalog();
  const products = generation.products || [];

  // Pagination logic: 12 items per page
  const itemsPerPage = 12;
  const pages = Math.ceil(products.length / itemsPerPage);

  if (generation.isGenerating && generation.progress < 100) {
     return (
       <div className="flex h-full items-center justify-center flex-col gap-8 p-10 w-full max-w-2xl mx-auto">
          <div className="w-full space-y-2">
             <div className="flex justify-between text-sm text-muted-foreground">
                <span>Gerando páginas...</span>
                <span>{generation.progress}%</span>
             </div>
             <Progress value={generation.progress} className="h-2" />
          </div>
          
          {/* Skeleton Preview */}
          <div className="grid grid-cols-3 gap-4 w-full opacity-50">
             {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col space-y-3">
                  <Skeleton className="h-[125px] w-full rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
             ))}
          </div>
       </div>
     )
  }

  if (filters.viewMode === 'list') {
    return (
      <div className="h-full w-full p-8 overflow-auto bg-[#f8f8f8]">
        <div className="bg-white rounded-md border shadow p-4 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold mb-4">Lista de Produtos ({products.length})</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"><Checkbox /></TableHead>
                <TableHead>Cód.</TableHead>
                <TableHead>Imagem</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.CODPROD}>
                  <TableCell><Checkbox /></TableCell>
                  <TableCell className="font-medium">{product.CODPROD}</TableCell>
                  <TableCell>
                     <div className="w-8 h-8">
                       <CatalogImage codprod={product.CODPROD} alt={product.DESCRPROD} />
                     </div>
                  </TableCell>
                  <TableCell>{product.DESCRPROD}</TableCell>
                  <TableCell>{product.REFERENCIA || '-'}</TableCell>
                  <TableCell className="text-right">R$ {product.VLRVENDA?.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                     <Badge variant={product.ESTOQUE_ATUAL > 0 ? "outline" : "destructive"}>
                        {product.ESTOQUE_ATUAL} un
                     </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full w-full p-8 flex flex-col items-center bg-[#f8f8f8]">
      {/* Cover Page */}
      {filters.showCover && (
        <CatalogPage pageNumber={0} isCover>
          <CatalogImage 
            codprod={46} 
            className="w-full h-full object-cover" 
          />
        </CatalogPage>
      )}

      {/* Product Pages */}
      {Array.from({ length: pages }).map((_, pageIndex) => (
        <CatalogPage key={pageIndex} pageNumber={pageIndex + 1}>
           {/* Header */}
           <div className="flex justify-between items-center mb-4 border-b pb-2">
              <span className="font-bold text-lg">Catálogo de Produtos</span>
              <span className="text-xs text-gray-500">Brasfoot</span>
           </div>

           {/* Grid */}
           <div className="grid grid-cols-3 gap-4 flex-1 content-start">
              {products
                 .slice(pageIndex * itemsPerPage, (pageIndex + 1) * itemsPerPage)
                 .map((product) => (
                    <div key={product.CODPROD} className="h-[220px]"> 
                       <CatalogProductCard product={product} /> 
                    </div>
                 ))
              }
           </div>
        </CatalogPage>
      ))}
      
      {products.length === 0 && (
         <div className="mt-10 w-full max-w-md">
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sem resultados</AlertTitle>
              <AlertDescription>
                Nenhum produto encontrado com os filtros selecionados. Tente ajustar a busca.
              </AlertDescription>
            </Alert>
         </div>
      )}
    </div>
  );
}
