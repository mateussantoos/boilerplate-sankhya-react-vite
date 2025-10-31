import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SankhyaProvider } from "@/contexts/sankhya-context.tsx";
import App from "@/app/app.tsx";

import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SankhyaProvider>
      <App />
    </SankhyaProvider>
  </StrictMode>
);
