"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import CompanyProfileForm from "@/components/company-profile-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PageLoader } from "@/components/ui/spinner";


export default function CompanySetupPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [hasCompanyProfile, setHasCompanyProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingProfile, setExistingProfile] = useState(null);

  useEffect(() => {
    const checkCompanyProfile = async () => {
      if (!isSignedIn) {
        router.push("/signin");
        return;
      }

      try {
        const response = await fetch("/api/company-profile");
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setHasCompanyProfile(result.data.hasCompanyProfile);
            if (result.data.hasCompanyProfile) {
              setExistingProfile({
                companyName: result.data.companyName || "",
                companyEmail: result.data.companyEmail || "",
                companyLogo: result.data.companyLogo || "",
                bankName: result.data.bankName || "",
                bankAccount: result.data.bankAccount || "",
                defaultDueDays: result.data.defaultDueDays || null
              });
            }
          }
        }
      } catch (error) {
        console.error("Error checking company profile:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isLoaded) {
      checkCompanyProfile();
    }
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
