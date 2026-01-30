import { useState, useCallback } from "react";
import { useQueryState, parseAsBoolean, parseAsString, parseAsArrayOf, parseAsIsoDate } from "nuqs";
import { catalogFilterSchema } from "./validators";
import type { z } from "zod";
import { buildCatalogQuery } from "@/services/catalog-query";
import { useSankhya } from "@/contexts/sankhya-context";

export type CatalogFilters = z.infer<typeof catalogFilterSchema>;

export function useCatalog() {
  const { executeQuery } = useSankhya();
  
  // State synchronized with URL
  const [description, setDescription] = useQueryState("desc", parseAsString.withDefault(""));
  const [viewMode, setViewMode] = useQueryState("view", parseAsString.withDefault("grid")); // grid | list
  const [date, setDate] = useQueryState("date", parseAsIsoDate);
  const [showPrice, setShowPrice] = useQueryState("price", parseAsBoolean.withDefault(true));
  const [showBarcode, setShowBarcode] = useQueryState("barcode", parseAsBoolean.withDefault(true));
  const [showStock, setShowStock] = useQueryState("stock", parseAsBoolean.withDefault(true));
  const [showCest, setShowCest] = useQueryState("cest", parseAsBoolean.withDefault(true));
  const [showCover, setShowCover] = useQueryState("cover", parseAsBoolean.withDefault(true));
  
  const [segments, setSegments] = useQueryState("segments", parseAsArrayOf(parseAsString).withDefault([]));
  const [departments, setDepartments] = useQueryState("depts", parseAsArrayOf(parseAsString).withDefault([]));
  const [categories, setCategories] = useQueryState("cats", parseAsArrayOf(parseAsString).withDefault([]));
  
  const [priceTable, setPriceTable] = useQueryState("tab", parseAsString.withDefault("0"));
  const [company, setCompany] = useQueryState("emp", parseAsArrayOf(parseAsString).withDefault(["1"]));

  // Data State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [products, setProducts] = useState<any[]>([]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setProgress(10); // Start progress

    try {
      // Build the query based on current filters
      const query = buildCatalogQuery({
         description,
         showPrice,
         showBarcode,
         showStock,
         showCest,
         showCover,
         segments,
         departments,
         categories,
         priceTable,
         company
      });

      console.log("--- SQL GERADO PARA O CATÁLOGO ---");
      console.log(query);
      console.log("----------------------------------");
      
      setProgress(30); // Query built

      // Execute Query
      const results = await executeQuery(query);
      
      setProgress(80); // Data received
      setProducts(results);
      
      setProgress(100);
    } catch (error) {
      console.error("Erro ao gerar catálogo:", error);
      // Optional: Add toast notification here
      setProducts([]); 
    } finally {
      setIsGenerating(false);
    }
  }, [description, viewMode, date, showPrice, showBarcode, showStock, showCest, showCover, segments, departments, categories, priceTable, company, executeQuery]);

  return {
    filters: {
      description, setDescription,
      viewMode, setViewMode,
      date, setDate,
      showPrice, setShowPrice,
      showBarcode, setShowBarcode,
      showStock, setShowStock,
      showCest, setShowCest,
      showCover, setShowCover,
      segments, setSegments,
      departments, setDepartments,
      categories, setCategories,
      priceTable, setPriceTable,
      company, setCompany,
    },
    generation: {
      isGenerating,
      progress,
      handleGenerate,
      products
    }
  };
}
