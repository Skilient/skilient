import type { MetadataRoute } from "next";

/**
 * The installable app (PRD 5.34): opens on Home in its own window. The service worker (/sw.js) keeps
 * an offline page and tickets the student opened; there is no offline feed.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Skilient",
    short_name: "Skilient",
    description: "Prove it. Don't claim it.",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#E6E1D8",
    theme_color: "#E6E1D8",
    categories: ["education", "social"],
    icons: [
      { src: "/brand/skilient-app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/brand/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Openings", url: "/openings" },
      { name: "Chat", url: "/chat" },
      { name: "My tickets", url: "/me/tickets" },
    ],
  };
}
