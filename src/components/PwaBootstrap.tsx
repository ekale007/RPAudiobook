"use client";

import { useEffect } from "react";

/** Registers a minimal service worker so the app can be installed as PWA. */
export function PwaBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline install optional */
    });
  }, []);
  return null;
}
