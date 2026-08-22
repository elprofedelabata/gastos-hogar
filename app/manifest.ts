import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mi casa · Gastos del hogar",
    short_name: "Mi casa",
    description: "Control compartido de gastos y balances del hogar.",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fbfa",
    theme_color: "#176b55",
    lang: "es",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
