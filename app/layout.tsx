import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/og.png`;

  return {
    applicationName: "Mi casa",
    title: "Mi casa · Gastos del hogar",
    description: "Control compartido de gastos y balances del hogar.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Mi casa",
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Mi casa · Gastos del hogar",
      description: "Control compartido de gastos y balances del hogar.",
      type: "website",
      locale: "es_ES",
      images: [
        {
          url: socialImage,
          width: 1536,
          height: 1024,
          alt: "Mi casa, gastos del hogar",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Mi casa · Gastos del hogar",
      description: "Control compartido de gastos y balances del hogar.",
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#176b55",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
