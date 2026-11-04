"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa/client";

/** Registers /sw.js once the app has loaded (PRD 5.34: the shell and the open ticket offline, and push). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const run = () => void registerServiceWorker();
    if (document.readyState === "complete") run();
    else window.addEventListener("load", run, { once: true });
  }, []);
  return null;
}
