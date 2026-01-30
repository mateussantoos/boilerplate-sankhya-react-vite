import { NuqsAdapter } from 'nuqs/adapters/react'
import { CatalogLayout } from './catalog-layout';
import { CatalogSidebar } from './catalog-sidebar';
import { CatalogPreview } from './catalog-preview';
import { Toaster } from "@/components/ui/sonner";

export function CatalogIntegration() {
  return (
    <NuqsAdapter>
      <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
        <CatalogLayout
          sidebar={<CatalogSidebar />}
          preview={<CatalogPreview />}
        />
        <Toaster />
      </div>
    </NuqsAdapter>
  );
}
