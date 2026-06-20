import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { AppStateProvider } from "~/state/app_state";
import { PostHogProvider } from "~/components/PostHogProvider";
import { ConvexClientProvider } from "./convex_client_provider";
import { getToken } from "~/lib/auth-server";

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
              <AppStateProvider>{children}</AppStateProvider>
            </TRPCReactProvider>
          </PostHogProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
