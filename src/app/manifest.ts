import type { MetadataRoute } from "next";

/** Installable on phones: "Add to Home Screen" gives a full-screen app with the mark as its icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ExplainCanvas",
    short_name: "ExplainCanvas",
    description: "Type anything you are stuck on. Understand it visually.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/logo-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logo.png", sizes: "512x512", type: "image/png" },
      { src: "/logo-1024.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
    ],
  };
}
