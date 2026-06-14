import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { deDE } from "@clerk/localizations";

import { TRPCReactProvider } from "~/trpc/react";
import JotaiProvider from "~/state/jotai_provider";
import { PostHogProvider } from "~/components/PostHogProvider";
import { ConvexClientProvider } from "./convex_client_provider";
// import { DevTools } from "jotai-devtools";

export const metadata: Metadata = {
  title: "JRZinsrechner",
  description: "Simple Frontend to calculate your monthly rate for a loan",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de-DE" className={`${geist.variable}`}>
      <body>
        <ClerkProvider localization={deDE}>
          <ConvexClientProvider>
            <PostHogProvider>
              <TRPCReactProvider>
                <JotaiProvider>
                  {children}
                  {/* <DevTools /> */}
                </JotaiProvider>
              </TRPCReactProvider>
            </PostHogProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
