import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import JotaiProvider from "~/state/jotai_provider";
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
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>
          <JotaiProvider>
            {children}
            {/* <DevTools /> */}
          </JotaiProvider>
          </TRPCReactProvider>
      </body>
    </html>
  );
}
