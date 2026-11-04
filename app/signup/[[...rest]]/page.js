import { SignUp } from "@clerk/nextjs";
import { FileText } from "lucide-react";

export const metadata = { title: "Create your account" };

export default function Page() {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-6 py-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <FileText className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Start sending professional invoices in minutes.</p>
      </div>
      <SignUp path="/signup" routing="path" signInUrl="/signin" fallbackRedirectUrl="/" />
    </div>
  );
}
