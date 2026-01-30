import { CatalogImage } from "./catalog-image";
import { useCatalog } from "./use-catalog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface Product {
  CODPROD: number;
  DESCRPROD: string;
  VLRVENDA: number;
  ESTOQUE_ATUAL?: number; // Real data
  ESTOQUE?: number; // Legacy/Mock
  REFERENCIA?: string;
  IMAGEM?: string; // Base64 or URL
}

interface CatalogProductCardProps {
  product: Product;
}

export function CatalogProductCard({ product }: CatalogProductCardProps) {
  const { filters } = useCatalog();

  return (
    <Card className="flex flex-col overflow-hidden border shadow-sm h-full p-2 text-xs bg-white text-black break-inside-avoid">
       {/* Image Area - Aspect Square */}
       <div className="aspect-square bg-gray-100 mb-2 rounded-md flex items-center justify-center overflow-hidden relative">
          <CatalogImage 
            codprod={product.CODPROD} 
            alt={product.DESCRPROD} 
          />
          
          {/* Badge Overlay for Code */}
          <Badge variant="secondary" className="absolute top-1 left-1 bg-black/70 text-white px-1 py-0 h-auto text-[9px] hover:bg-black/80">
            {product.CODPROD}
          </Badge>
       </div>

       {/* Content */}
       <div className="flex-1 flex flex-col gap-1">
         <h3 className="font-bold leading-tight line-clamp-2 min-h-[2.5em]">
           {product.DESCRPROD}
         </h3>

         <div className="mt-auto space-y-0.5">
           {filters.showPrice && (
             <div className="flex justify-between items-baseline font-semibold">
               <span className="text-gray-500 text-[10px]">Preço:</span>
               <span className="text-sm">R$ {product.VLRVENDA?.toFixed(2)}</span>
             </div>
           )}

           {filters.showBarcode && product.REFERENCIA && (
              <div className="flex justify-between items-center text-[10px] text-gray-500">
                <span>Ref:</span>
                <span className="font-mono">{product.REFERENCIA}</span>
              </div>
           )}

           {filters.showStock && (
             <div className="flex justify-between items-center text-[10px] text-gray-500">
               <span>Est:</span>
               <span>{product.ESTOQUE_ATUAL ?? product.ESTOQUE} un</span>
             </div>
           )}
         </div>
       </div>
    </Card>
  );
}
