import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PushTimeZoneSync from "../components/auth/PushTimeZoneSync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BARCA_PUBLIC_ORIGIN ?? "http://localhost:3000"),
  title: {
    default: "Barça Dashboard",
    template: "%s | Barça Dashboard",
  },
  description:
    "Matchday, history, media and your own FC Barcelona story in one dashboard.",
  applicationName: "Barça Dashboard",
  icons: {
    icon: [{ url: "/icon.png", sizes: "256x256", type: "image/png" }],
    apple: [{ url: "/icon.png", sizes: "256x256", type: "image/png" }],
  },
  openGraph: {
    title: "Barça Dashboard",
    description:
      "Matchday, history, media and your own FC Barcelona story in one dashboard.",
    siteName: "Barça Dashboard",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Barça Dashboard",
    description:
      "Matchday, history, media and your own FC Barcelona story in one dashboard.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><PushTimeZoneSync />{children}</body>
    </html>
  );
}
