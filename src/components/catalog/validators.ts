import { z } from "zod";

// Zod Schema for validation (optional usage here, but good for typed forms)
export const catalogFilterSchema = z.object({
  description: z.string().optional(),
  showPrice: z.boolean().default(true),
  showBarcode: z.boolean().default(true),
  showStock: z.boolean().default(true),
  showCest: z.boolean().default(true),
  showCover: z.boolean().default(true),
  segments: z.array(z.string()).default([]),
  departments: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  priceTable: z.string().optional(),
  company: z.array(z.string()).default(["1"]),
});