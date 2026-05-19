"use client";

import { startTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function RealtimeRefresh({
  channelName,
  tables,
  refreshDebounceMs = 400,
}: {
  channelName: string;
  tables: string[];
  refreshDebounceMs?: number;
}) {
  const router = useRouter();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      return;
    }

    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
        },
        () => {
          if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
          }

          refreshTimerRef.current = setTimeout(() => {
            startTransition(() => {
              router.refresh();
            });
          }, refreshDebounceMs);
        },
      );
    });

    channel.subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      channel.unsubscribe();
    };
  }, [channelName, refreshDebounceMs, router, tables]);

  return null;
}
