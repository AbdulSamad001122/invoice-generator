"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  FileText,
  Layers,
  Moon,
  Palette,
  Plus,
  Users,
} from "lucide-react";
import { useClients } from "@/contexts/ClientContext";
import { prefetchClientInvoices } from "@/contexts/InvoiceContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoader } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import CompanyProfileForm from "@/components/company-profile-form";
import { useCompanyProfile } from "@/hooks/use-company-profile";

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

function Landing() {
  const features = [
    { icon: Users, title: "Clients in one place", text: "Keep every client and their invoice history organised." },
    { icon: Layers, title: "Items & sub-items", text: "Break work into line items with their own prices." },
    { icon: Palette, title: "Polished PDFs", text: "Four professional templates, ready to send." },
    { icon: Moon, title: "Light & dark", text: "Comfortable to use any time of day." },
  ];
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center py-12 text-center md:py-20">
      <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <FileText className="size-6" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Professional invoices in minutes
      </h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Manage clients, reuse saved items and send clean, branded PDF invoices.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" asChild>
          <Link href="/signup">Create free account</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/signin">Sign in</Link>
        </Button>
      </div>
      <div className="mt-14 grid w-full gap-4 text-left sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-4">
            <f.icon className="mb-2 size-5 text-primary" />
            <p className="font-medium">{f.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecklistItem({ done, title, description, action }) {
  return (
    <li className="flex items-start gap-3 py-3">
      {done ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
      ) : (
        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/50" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
          {title}
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {!done && action}
    </li>
  );
}

export default function Home() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { clients, loading: clientsLoading, loadingMore, pagination, addClient, loadMoreClients } = useClients();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", email: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCompanyProfileModal, setShowCompanyProfileModal] = useState(false);

  // Shared, cached profile (null while it loads for the first time)
  const profileQuery = useCompanyProfile();
  const queryClient = useQueryClient();
  const hasCompanyProfile = profileQuery.data
    ? Boolean(profileQuery.data.hasCompanyProfile)
    : profileQuery.isError
      ? false
      : null;

  if (!isLoaded) return <PageLoader fullScreen />;
  if (!isSignedIn) return <Landing />;

  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (isSubmitting || !clientForm.name.trim()) return;

    setIsSubmitting(true);
    try {
      const newClient = await addClient({
        name: clientForm.name.trim(),
        email: clientForm.email.trim() || null,
      });
      setClientForm({ name: "", email: "" });
      setIsDialogOpen(false);
      toast.success("Client added");
      if (newClient?.id) router.push(`/dashboard/${newClient.id}`);
    } catch (error) {
      console.error("Error creating client:", error);
      toast.error(error?.response?.data?.error || "Couldn't add the client. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const firstName = user.firstName || user.emailAddresses?.[0]?.emailAddress?.split("@")[0];
  const clientCount = pagination.totalCount || clients.length;
  const hasClients = clientCount > 0;
  const setupDone = hasCompanyProfile === true && hasClients;
  const stepsDone = [hasCompanyProfile === true, hasClients].filter(Boolean).length;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick a client to create or manage their invoices.
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus /> Add client
        </Button>
      </div>

      {/* Setup checklist (hidden once the basics are done) */}
      {hasCompanyProfile !== null && !clientsLoading && !setupDone && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Get set up</CardTitle>
            <CardDescription>
              {stepsDone} of 2 done. Finish these to start sending invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              <ChecklistItem
                done={hasCompanyProfile === true}
                title="Add your company details"
                description="Your name, logo and bank details appear on every invoice."
                action={
                  <Button size="sm" variant="outline" onClick={() => setShowCompanyProfileModal(true)}>
                    Set up
                  </Button>
                }
              />
              <ChecklistItem
                done={hasClients}
                title="Add your first client"
                description="Then open the client to create their first invoice."
                action={
                  <Button size="sm" variant="outline" onClick={() => setIsDialogOpen(true)}>
                    Add client
                  </Button>
                }
              />
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Clients */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Clients{hasClients ? ` (${clientCount})` : ""}
          </h2>
          {hasCompanyProfile === true && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/company-setup">
                <Building2 /> Company profile
              </Link>
            </Button>
          )}
        </div>

        {clientsLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-xl" />
            ))}
          </div>
        ) : !hasClients ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
            <Users className="mb-3 size-8 text-muted-foreground" />
            <p className="font-medium">No clients yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add a client to start creating invoices for them.
            </p>
            <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
              <Plus /> Add client
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/dashboard/${client.id}`}
                onMouseEnter={() => prefetchClientInvoices(queryClient, client.id)}
                onFocus={() => prefetchClientInvoices(queryClient, client.id)}
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-ring/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {getInitials(client.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{client.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {client.email || "No email"}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}

        {!clientsLoading && pagination.hasMore && (
          <div className="flex justify-center pt-1">
            <Button variant="outline" size="sm" loading={loadingMore} onClick={loadMoreClients}>
              {loadingMore ? "Loading…" : "Show more clients"}
            </Button>
          </div>
        )}
      </section>

      {/* Add client dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !isSubmitting && setIsDialogOpen(open)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Add client</DialogTitle>
            <DialogDescription>
              Add someone you bill so you can create invoices for them.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateClient}>
            <fieldset disabled={isSubmitting} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={clientForm.name}
                  onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Acme Inc."
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={clientForm.email}
                  onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="billing@acme.com"
                />
              </div>
            </fieldset>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting} disabled={!clientForm.name.trim()}>
                {isSubmitting ? "Adding…" : "Add client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Company profile dialog */}
      <Dialog open={showCompanyProfileModal} onOpenChange={setShowCompanyProfileModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Company profile</DialogTitle>
            <DialogDescription>
              These details appear on your invoices.
            </DialogDescription>
          </DialogHeader>
          <CompanyProfileForm
            onSave={() => {
              // The form updates the cached profile itself
              setShowCompanyProfileModal(false);
            }}
            onClose={() => setShowCompanyProfileModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
