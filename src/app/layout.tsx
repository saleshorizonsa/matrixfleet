import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: {
    default: "MatrixFleet — Transport management for UK, EU & GCC hauliers",
    template: "%s · MatrixFleet",
  },
  description:
    "Jobs, dispatch, live tracking, driver app, proof of delivery, VAT-ready invoicing and compliance for small and medium haulage and delivery companies. Powered by Matrix Infotech Ltd.",
  applicationName: "MatrixFleet",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MatrixFleet", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a1430",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${jakarta.variable}`}>
      <body>
        <NextIntlClientProvider>
          {children}
          <Toaster richColors position="top-right" closeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
