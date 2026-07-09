"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/**
 * Client-side auth guard. Call at the top of any protected page.
 * If the user is not authenticated, redirects to /login?redirect=<current path>.
 */
export function useAuthGuard() {
  const router  = useRouter();
  const path    = usePathname();

  const { data: me, isLoading, isFetched } = useQuery({
    queryKey: ["me"],
    queryFn:  api.auth.me,
    retry:    false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isFetched && !me) {
      router.replace(`/login?redirect=${encodeURIComponent(path)}`);
    }
  }, [isFetched, me, path, router]);

  return { me, isLoading: isLoading || !isFetched };
}
