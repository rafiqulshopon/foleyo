import type { MetadataRoute } from "next";

// Manifest-only PWA: installable and branded, deliberately without a
// service worker (the app is fully client-side already; a hand-rolled SW
// risks serving stale shells).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Foleyo — Offline Course Player",
    short_name: "Foleyo",
    description:
      "Watch your downloaded video courses through a beautiful browser interface. Load a folder, track your progress, and learn offline.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
