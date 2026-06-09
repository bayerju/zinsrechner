"use client";

import { type ReactNode } from "react";
import { Provider as JotaiProvider } from "jotai";
// import { DevTools } from "jotai-devtools";

export default function Provider({ children }: { children: ReactNode }) {
  return (
    <JotaiProvider>
      {/* <DevTools /> */}
      {children}
    </JotaiProvider>
  );
}
