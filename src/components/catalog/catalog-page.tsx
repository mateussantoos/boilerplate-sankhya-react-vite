import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CatalogPageProps {
  children: ReactNode;
  pageNumber: number;
  isCover?: boolean;
}

export function CatalogPage({ children, pageNumber, isCover }: CatalogPageProps) {
  return (
    <div className="relative mb-8 shadow-2xl transition-transform duration-300 origin-top">
      {/* A4 Dimensions: 210mm x 297mm. Aspect Ratio ~0.707 */}
      {/* Using standard tailwind aspect-ratio or explicit size with scale transform for preview */}
      <div 
        className={cn(
          "w-[210mm] h-[297mm] bg-white text-black p-[10mm] overflow-hidden flex flex-col mx-auto transition-all duration-300",
          isCover && "items-center justify-center bg-zinc-950 text-white border-none p-0"
        )}
        style={{
             // Ensure it renders correctly in both screen (scaled) and print
             maxWidth: '100%',
        }}
      >
         {children}

         {/* Footer / Page Number */}
         {!isCover && (
           <div className="absolute bottom-4 left-0 w-full text-center text-xs text-gray-400">
             Página {pageNumber}
           </div>
         )}
      </div>

       {/* Screen-only page indicator outside the A4 page */}
       <div className="absolute -right-8 top-0 text-xs text-gray-400 rotate-90 origin-top-left translate-y-8 select-none">
          A4 - Pág {pageNumber}
       </div>
    </div>
  );
}
