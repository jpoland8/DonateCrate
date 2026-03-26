import type { Metadata } from "next";
import Script from "next/script";
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
const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

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
        {metaPixelId ? (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${metaPixelId}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        ) : null}
        <ClientRecovery />
        {children}
      </body>
    </html>
  );
}
