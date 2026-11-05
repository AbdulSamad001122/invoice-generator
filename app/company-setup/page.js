"use client";

import { useEffect, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import CompanyProfileForm from "@/components/company-profile-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PageLoader } from "@/components/ui/spinner";
import { useCompanyProfile } from "@/hooks/use-company-profile";


export default function CompanySetupPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  // Shared, cached profile (instant if another page already loaded it)
  const profileQuery = useCompanyProfile();
  const profile = profileQuery.data;
  const loading = profileQuery.isPending && !profileQuery.isError;
  const hasCompanyProfile = Boolean(profile?.hasCompanyProfile);
  const existingProfile = useMemo(
    () =>
      profile?.hasCompanyProfile
        ? {
            companyName: profile.companyName || "",
            companyEmail: profile.companyEmail || "",
            companyLogo: profile.companyLogo || "",
            bankName: profile.bankName || "",
            bankAccount: profile.bankAccount || "",
            defaultDueDays: profile.defaultDueDays || null,
          }
        : null,
    [profile]
  );

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/signin");
  }, [isLoaded, isSignedIn, router]);

  const handleProfileSaved = (profileData) => {
    // Redirect to dashboard after successful setup
    router.push("/");
  };

  const handleSkip = () => {
    // Allow users to skip setup and go to dashboard
    router.push("/");
  };

  if (!isLoaded || loading || !isSignedIn) {
    return <PageLoader fullScreen label="Loading your profile…" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {hasCompanyProfile ? "Company profile" : "Set up your company"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {hasCompanyProfile
            ? "These details appear on every invoice you create."
            : "Add your business details once and they'll be filled in on every invoice."}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <CompanyProfileForm
          onSave={handleProfileSaved}
          isModal={false}
          initialData={existingProfile}
        />
      </div>

      {!hasCompanyProfile && (
        <div className="text-center">
          <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
            Skip for now
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">
            You can do this later from Company profile in the sidebar.
          </p>
        </div>
      )}
    </div>
  );
}
