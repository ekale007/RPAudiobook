"use client";

import { useEffect } from "react";
import { refreshServerCapabilities } from "@/lib/server/serverCapabilities";

/** Prefetch /api/health once per session so sync checks work early. */
export function ServerCapabilitiesBootstrap() {
  useEffect(() => {
    void refreshServerCapabilities();
  }, []);
  return null;
}
