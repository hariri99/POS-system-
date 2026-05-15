"use client";

import { Toaster } from "sonner";
import { useTheme } from "./theme-provider";

export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      richColors
      closeButton
      position="top-right"
      theme={theme}
      toastOptions={{
        style: {
          background: "var(--surface-strong)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        },
      }}
    />
  );
}
