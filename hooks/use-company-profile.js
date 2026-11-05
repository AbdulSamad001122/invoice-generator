"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { queryKeys } from "@/lib/queryKeys";

export async function fetchCompanyProfile() {
  const response = await fetch("/api/company-profile");
  if (!response.ok) throw new Error("Failed to load company profile");
  const result = await response.json();
  if (!result.success) throw new Error(result.error || "Failed to load company profile");
  return result.data; // { hasCompanyProfile, companyName, companyEmail, companyLogo, bankName, bankAccount, defaultDueDays, ... }
}

// The signed-in user's company profile, shared and cached across the app
// (dashboard, setup page, invoice form, profile form all reuse one request).
export function useCompanyProfile() {
  const { isLoaded, userId } = useAuth();
  return useQuery({
    queryKey: queryKeys.companyProfile,
    queryFn: fetchCompanyProfile,
    enabled: isLoaded && Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}

// Update the cached profile after a save (so every page shows the new values at once)
export function useSetCompanyProfile() {
  const queryClient = useQueryClient();
  return (profile) =>
    queryClient.setQueryData(queryKeys.companyProfile, (old) => ({
      ...(old || {}),
      ...profile,
      hasCompanyProfile: true,
    }));
}
