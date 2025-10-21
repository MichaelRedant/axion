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
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-[rgba(0,255,242,0.12)] bg-[rgba(4,8,16,0.85)] backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
              <div className="space-y-2">
                <a
                  href="/axion"
                  className="text-xs uppercase tracking-[0.4em] text-[var(--ax-neon)]"
                >
                  Axion
                </a>
                <p className="max-w-2xl text-sm text-[var(--ax-muted)]">
                  Ontdek Axion, een retro-futuristisch rekencentrum waar exacte algebra en intuïtieve workflows samenkomen.
                  Gebruik het menu om snel naar de rekenmachine, hulp of het onboarding traject te navigeren.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                <nav aria-label="Informatief menu" className="sm:self-end">
                  <ul className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.35em] text-[var(--ax-muted)]">
                                        <li>
                      <a className="axion-button axion-button--ghost px-4 py-2" href="#axion-help">
                        Hulp
                      </a>
                    </li>
                    
                  </ul>
                </nav>
                
              </div>
            </div>
          </header>
          <div className="flex-1">
            {children}
            <section
              id="axion-help"
              className="mx-auto mt-12 max-w-6xl px-4 pb-12 sm:px-6 lg:px-8"
              aria-labelledby="axion-help-heading"
            >
              <div className="axion-panel space-y-4 p-6">
                <p
                  id="axion-help-heading"
                  className="text-xs uppercase tracking-[0.35em] text-[var(--ax-muted)]"
                >
                  Hulp en ondersteuning
                </p>
                <h2 className="text-2xl font-semibold text-[var(--ax-text)]">
                  Vind snel antwoorden en praktische tips
                </h2>
                <p className="text-sm text-[rgba(255,255,255,0.72)]">
                  Open de ingebouwde hulp vanuit de rekenmachine voor voorbeelden, sneltoetsen en uitleg over de Axion-engine.
                  In het hulpcentrum vind je ook links naar meer documentatie en kun je feedback achterlaten.
                </p>
                <p className="text-sm text-[rgba(255,255,255,0.72)]">
                  Liever direct contact? Gebruik de feedbackknoppen in de notebook om problemen te melden of ideeën te delen.
                </p>
              </div>
            </section>
            <section
              id="axion-onboarding"
              className="mx-auto mb-16 max-w-6xl px-4 sm:px-6 lg:px-8"
              aria-labelledby="axion-onboarding-heading"
            >
              <div className="axion-panel space-y-5 p-6">
                <p
                  id="axion-onboarding-heading"
                  className="text-xs uppercase tracking-[0.35em] text-[var(--ax-muted)]"
                >
                  Onboarding traject
                </p>
                <h2 className="text-2xl font-semibold text-[var(--ax-text)]">
                  Volg het stappenplan om het meeste uit Axion te halen
                </h2>
                <ol className="list-decimal space-y-3 pl-5 text-sm text-[rgba(255,255,255,0.8)]">
                  <li>
                    Start met de voorbeeldberekeningen om vertrouwd te raken met de syntaxis en de verschillende engines.
                  </li>
                  <li>
                    Personaliseer de omgeving via thema-, taal- en engine-opties voor jouw favoriete workflow.
                  </li>
                  <li>
                    Documenteer je ontdekkingen in de notebook en deel resultaten met collega&apos;s rechtstreeks vanuit Axion.
                  </li>
                </ol>
                <p className="text-sm text-[rgba(255,255,255,0.72)]">
                  Heb je het traject afgerond? Blijf terugkomen voor nieuwe voorbeelden en geavanceerde strategieën die regelmatig
                  worden toegevoegd.
                </p>
              </div>
            </section>
          </div>
          <footer className="border-t border-[rgba(0,255,242,0.12)] bg-[rgba(4,8,16,0.85)]">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
              <p className="text-xs uppercase tracking-[0.35em] text-[var(--ax-muted)]">
                Axion community
              </p>
              <p className="text-sm text-[rgba(255,255,255,0.72)]">
                Projectcoördinatie en begeleiding door Michaël Redant – gedreven om iedereen wegwijs te maken in symbolische
                algebra.
              </p>
              <p className="text-xs text-[rgba(255,255,255,0.6)]">
                © {new Date().getFullYear()} Axion. Samen bouwen we aan toegankelijke wiskundige innovatie.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
