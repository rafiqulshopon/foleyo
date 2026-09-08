import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://foleyo.vercel.app";

const description =
  "Watch your downloaded video courses through a beautiful browser interface. Load a folder, track your progress, and learn offline.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Foleyo — Offline Course Player",
    template: "%s · Foleyo",
  },
  description,
  applicationName: "Foleyo",
  openGraph: {
    type: "website",
    siteName: "Foleyo",
    title: "Foleyo — Offline Course Player",
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Foleyo — Offline Course Player",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full bg-background text-foreground">
        {/* Blocking theme script — runs before any app markup paints so light-mode
            users never see a dark flash. Must stay the first child of <body>. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('foleyo_theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){}})()",
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
