import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import JotaiProvider from "~/state/jotai_provider";
import { PostHogProvider } from "~/components/PostHogProvider";
import { ConvexClientProvider } from "./convex_client_provider";
import { getToken } from "~/lib/auth-server";
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const token = await getToken();

  return (
    <html lang="de-DE" className={`${geist.variable}`}>
      <body>
        <ConvexClientProvider initialToken={token}>
          <PostHogProvider>
            <TRPCReactProvider>
              <JotaiProvider>
                {children}
                {/* <DevTools /> */}
              </JotaiProvider>
            </TRPCReactProvider>
          </PostHogProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
