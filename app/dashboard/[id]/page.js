"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Mail, Plus, UserX } from "lucide-react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useClients } from "@/contexts/ClientContext";
import { useInvoices } from "@/contexts/InvoiceContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoader } from "@/components/ui/spinner";
import InvoiceForm from "@/components/invoice-form";
import InvoiceList from "@/components/invoice-list";

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

export default function ClientDashboard() {
  const { isLoaded, isSignedIn } = useUser();
  const params = useParams();
  const router = useRouter();
  const clientId = params.id;
  const { getClientById, loading: clientsLoading } = useClients();
  const { createInvoice, updateInvoice } = useInvoices();

  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);

  // The sidebar only holds the first page of clients, so fetch this client
  // directly when it isn't in that list (e.g. an older client or a shared link).
  const clientFromList = getClientById(clientId);
  const clientQuery = useQuery({
    queryKey: queryKeys.client(clientId),
    queryFn: async () => (await axios.get(`/api/clients/${clientId}`)).data,
    enabled: Boolean(isSignedIn && clientId && !clientsLoading && !clientFromList),
    retry: false,
  });
  const client = clientFromList || clientQuery.data || null;
  const notFound = !clientFromList && clientQuery.isError;

  // Leave the form when switching to another client
  useEffect(() => {
    setShowInvoiceForm(false);
    setEditingInvoice(null);
  }, [clientId]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/signin");
  }, [isLoaded, isSignedIn, router]);

  const handleInvoiceCreated = async (responseData) => {
    try {
      const invoiceObject = responseData.invoice || responseData;
      if (editingInvoice) {
        await updateInvoice(editingInvoice.id, invoiceObject);
      } else {
        await createInvoice(invoiceObject);
      }
    } catch (error) {
      console.error("Error updating context:", error);
    }
    setShowInvoiceForm(false);
    setEditingInvoice(null);
  };

  const handleEditInvoice = (invoice) => {
    setEditingInvoice(invoice);
    setShowInvoiceForm(true);
  };

  if (!isLoaded || !isSignedIn) return <PageLoader fullScreen />;

  if (notFound) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <UserX className="mb-3 size-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Client not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been deleted, or the link is wrong.
        </p>
        <Button className="mt-6" variant="outline" asChild>
          <Link href="/">
            <ArrowLeft /> Back to dashboard
          </Link>
        </Button>
      </div>
    );
  }

  if (showInvoiceForm && client) {
    return (
      <InvoiceForm
        invoice={editingInvoice}
        onInvoiceCreated={handleInvoiceCreated}
        onCancel={() => {
          setShowInvoiceForm(false);
          setEditingInvoice(null);
        }}
        preselectedClient={client}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {client ? (
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
              {getInitials(client.name)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{client.name}</h1>
              {client.email && (
                <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                  <Mail className="size-3.5" /> {client.email}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
        )}
        <Button onClick={() => setShowInvoiceForm(true)} disabled={!client}>
          <Plus /> New invoice
        </Button>
      </div>

      <InvoiceList clientId={clientId} onEditInvoice={handleEditInvoice} />
    </div>
  );
}
