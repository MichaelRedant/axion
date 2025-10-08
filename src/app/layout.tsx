import type { Metadata } from "next";
import { Orbitron, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  display: "swap",
});

const plex = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://axion.local"),
  title: {
    default: "Axion · Compute Beyond Logic",
    template: "%s · Axion",
  },
  description:
    "Axion is a retro-futuristic algebra system for exact symbolic and numeric computation.",
  applicationName: "Axion",
  keywords: [
    "algebra",
    "calculator",
    "nextjs",
    "math",
    "symbolic computation",
    "retro futurism",
  ],
  authors: [{ name: "Axion Labs" }],
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className="bg-canvas" suppressHydrationWarning>
      <body
        className={`${orbitron.variable} ${plex.variable} axion-grid antialiased`}
      >
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] rounded bg-neon px-4 py-2 text-black transition"
          href="#axion-main"
        >
          Sla naar hoofdinhoud
        </a>
        {children}
      </body>
    </html>
  );
}
