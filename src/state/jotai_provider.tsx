"use client";

import { type ReactNode } from "react";
import { Provider as JotaiProvider } from "jotai";
import { ConvexStateSync } from "./convex_state_sync";
// import { DevTools } from "jotai-devtools";

export default function Provider({ children }: { children: ReactNode }) {
  return (
    <JotaiProvider>
      <ConvexStateSync />
      {/* <DevTools /> */}
      {children}
    </JotaiProvider>
  );
}
