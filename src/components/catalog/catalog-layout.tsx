import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Menu } from "lucide-react";

interface CatalogLayoutProps {
  sidebar: ReactNode;
  preview: ReactNode;
  className?: string;
}

export function CatalogLayout({ sidebar, preview, className }: CatalogLayoutProps) {
  return (
    <div className={cn("h-screen w-full overflow-hidden bg-background", className)}>
      {/* Mobile Header / Sidebar Trigger */}
      <div className="md:hidden flex items-center p-4 border-b">
         <Sheet>
           <SheetTrigger asChild>
             <Button variant="ghost" size="icon">
               <Menu className="w-6 h-6" />
             </Button>
           </SheetTrigger>
           <SheetContent side="left" className="w-80 p-0">
               <div className="h-full p-4 overflow-y-auto">
                 {sidebar}
               </div>
           </SheetContent>
         </Sheet>
         <span className="ml-4 font-semibold">Gerador de Catálogo</span>
      </div>

      <ResizablePanelGroup direction="horizontal" className="h-full max-h-screen">
        {/* Desktop Sidebar Panel */}
        <ResizablePanel 
          defaultSize={20} 
          minSize={15} 
          maxSize={30} 
          className="hidden md:block bg-card border-r"
        >
          <div className="h-full p-4 overflow-y-auto">
             {sidebar}
          </div>
        </ResizablePanel>
        
        <ResizableHandle className="hidden md:flex" />

        {/* Preview Panel */}
        <ResizablePanel defaultSize={80}>
          <main className="h-full w-full overflow-hidden bg-[#f8f8f8] relative">
            {preview}
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
