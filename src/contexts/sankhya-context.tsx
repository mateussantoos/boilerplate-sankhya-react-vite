import { createContext, useContext, type ReactNode } from "react";
import { sankhyaService, type SankhyaServiceType } from "../services/sankhya";

// The default value is 'undefined' to enforce usage within the Provider.
const SankhyaContext = createContext<SankhyaServiceType | undefined>(undefined);

interface SankhyaProviderProps {
  children: ReactNode;
}

/**
 * Provider component that makes the sankhyaService available
 * to all child components.
 */
export function SankhyaProvider({ children }: SankhyaProviderProps) {
  // The value provided is our imported service object
  const value = sankhyaService;

  return (
    <SankhyaContext.Provider value={value}>{children}</SankhyaContext.Provider>
  );
}

/**
 * Custom hook to access the SankhyaService.
 * Ensures the service can only be used within a SankhyaProvider.
 *
 * @returns {SankhyaServiceType} The complete Sankhya service object.
 */

export function useSankhya() {
  const context = useContext(SankhyaContext);
  if (context === undefined) {
    throw new Error("useSankhya must be used within a SankhyaProvider");
  }
  return context;
}
