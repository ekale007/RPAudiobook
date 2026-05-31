"use client";

import { useEffect } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { syncUserPreferences } from "@/lib/storage/userPreferencesSync";

/** Pull account settings into localStorage after login / on load. */
export function UserPreferencesBootstrap() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createClient();
    void syncUserPreferences();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void syncUserPreferences();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
