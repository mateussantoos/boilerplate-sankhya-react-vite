/** Bind-parameter types accepted by the Sankhya native `executeQuery`. */
export type SankhyaParamType = "I" | "S" | "D" | "F" | "IN" | "L";

/** A single typed bind parameter for a parameterized query. */
export interface SankhyaQueryParam {
  value: string | number;
  type: SankhyaParamType;
}

declare global {
  interface Window {
    sankhyaUserInfo: {
      name: string;
      id: string;
    };

    /**
     * Native helpers injected by `<snk:load/>` in the JSP entry point.
     * They only exist when the component runs inside Sankhya-W; the service
     * layer falls back to `service.sbr` calls when they are absent.
     */
    executeQuery?: (
      query: string,
      params: SankhyaQueryParam[],
      onSuccess: (value: string) => void,
      onError: (error: unknown) => void
    ) => void;
    openApp?: (resourceID: string, params?: Record<string, unknown>) => void;
    openLevel?: (nivel: string, params?: Record<string, unknown>) => void;
    refreshDetails?: (
      componentID: string,
      params?: Record<string, unknown>
    ) => void;
    openPage?: (page: string, params?: Record<string, unknown>) => void;
  }
}
