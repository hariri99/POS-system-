"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function RealtimeRefresh({
  channelName,
  tables,
}: {
  channelName: string;
  tables: string[];
}) {
  const router = useRouter();

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
          router.refresh();
        },
      );
    });

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [channelName, router, tables]);

  return null;
}

