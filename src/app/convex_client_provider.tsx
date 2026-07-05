"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { type ReactNode } from "react";
import { authClient } from "~/lib/auth-client";
import { env } from "~/env";

function browserReachableConvexUrl(convexUrl: string) {
  if (typeof window === "undefined") return convexUrl;

  const pageHostname = window.location.hostname;
  if (pageHostname === "localhost" || pageHostname === "127.0.0.1") {
    return convexUrl;
  }

  const parsed = new URL(convexUrl);
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
    parsed.hostname = pageHostname;
  }
  return parsed.toString().replace(/\/$/, "");
}

const convex = new ConvexReactClient(
  browserReachableConvexUrl(env.NEXT_PUBLIC_CONVEX_URL),
);

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
