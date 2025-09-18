"use client";

import { type ReactNode } from "react";
import { Provider as JotaiProvider } from "jotai";
import { DevTools } from "jotai-devtools"; // shows an in-app panel

export default function Provider({ children }: { children: ReactNode }) {
  return (
    <JotaiProvider>
      {/* Remove in production if you prefer */}
      <DevTools />
      {children}
    </JotaiProvider>
  );
}
