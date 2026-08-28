import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { queryClient } from "@/lib/api";
import { I18nProvider } from "@/lib/i18n";
import { App } from "@/App";
import "./index.css";

const el = document.getElementById("app");
if (!el) throw new Error("#app not found");

createRoot(el).render(
  <StrictMode>
    {/* attribute="data-theme"：主题切换零 JS 重排，防闪脚本在 index.html 首帧兜底 */}
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem storageKey="as-theme">
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
