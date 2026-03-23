import type { Metadata } from "next";
import { Roboto, Roboto_Slab } from "next/font/google";
import { ClientRecovery } from "@/components/system/client-recovery";
import { getAppUrl } from "@/lib/urls";
import "./globals.css";

const headingFont = Roboto_Slab({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const bodyFont = Roboto({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const appUrl = getAppUrl();

export const metadata: Metadata = {
  title: "DonateCrate",
  description: "Neighborhood donation pickup built for consistent monthly giving.",
  metadataBase: new URL(appUrl),
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "DonateCrate",
    description: "Neighborhood donation pickup built for consistent monthly giving.",
    url: appUrl,
    siteName: "DonateCrate",
    images: [
      {
        url: "/images/hero-doorstep.jpg",
        alt: "DonateCrate orange pickup bag at a front door",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DonateCrate",
    description: "Neighborhood donation pickup built for consistent monthly giving.",
    images: ["/images/hero-doorstep.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable} antialiased`}>
        <ClientRecovery />
        {children}
      </body>
    </html>
  );
}
