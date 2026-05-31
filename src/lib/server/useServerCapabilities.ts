"use client";

import { useEffect, useState } from "react";
import {
  getServerCapabilitiesSync,
  refreshServerCapabilities,
  subscribeServerCapabilities,
  type ServerCapabilities,
} from "@/lib/server/serverCapabilities";

export type ServerCapabilitiesState = ServerCapabilities & { ready: boolean };

export function useServerCapabilities(): ServerCapabilitiesState {
  const [state, setState] = useState<ServerCapabilitiesState>(() => ({
    ...getServerCapabilitiesSync(),
    ready: false,
  }));

  useEffect(() => {
    void refreshServerCapabilities().finally(() => {
      setState({ ...getServerCapabilitiesSync(), ready: true });
    });
    return subscribeServerCapabilities(() =>
      setState({ ...getServerCapabilitiesSync(), ready: true }),
    );
  }, []);

  return state;
}
