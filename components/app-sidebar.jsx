"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { useClients } from "@/contexts/ClientContext";
import { useInvoices } from "@/contexts/InvoiceContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroupAction,
  SidebarInput,
  SidebarMenuAction,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Plus,
  Users,
  FileText,
  Building2,
  Search,
  Package,
  Edit,
  Trash2,
  LayoutDashboard,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/contexts/ToastContext";
import axios from "axios";
import { Spinner } from "@/components/ui/spinner";

export function AppSidebar({ selectedClientId, onClientSelect, onAddClient }) {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const pathname = usePathname() || "/";
  const {
    clients,
    loading,
    loadingMore,
    pagination,
    addClient,
    updateClient,
    deleteClient,
    refreshClients,
    loadMoreClients,
  } = useClients();
  const { refreshInvoices } = useInvoices();
  const clientsContainerRef = useRef(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", email: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [updateOption, setUpdateOption] = useState("fromNow"); // "fromNow" or "allInvoices"
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!clientForm.name.trim()) return;
    if (!clientForm.email.trim()) return;

    setIsSubmitting(true);
    try {
      const newClient = await addClient({
        name: clientForm.name.trim(),
        email: clientForm.email.trim(),
      });

      console.log("Created client:", newClient);

      // Call the parent callback if provided
      if (onAddClient) {
        onAddClient(newClient);
      }

      // Reset form and close dialog
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

  const handleInputChange = (field, value) => {
    setClientForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setEditForm({ name: client.name, email: client.email || "" });
    setUpdateOption("fromNow"); // Reset to default
    setIsEditDialogOpen(true);
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editingClient) return;

    setIsEditSubmitting(true);
    try {
      await updateClient(
        editingClient.id,
        {
          name: editForm.name,
          email: editForm.email || null,
        },
        updateOption
      );

      // If updating all invoices, refresh invoice data to show updated client info
      if (updateOption === "allInvoices") {
        refreshInvoices(editingClient.id);
      }

      // Reset form and close dialog
      setEditForm({ name: "", email: "" });
      setUpdateOption("fromNow");
      setEditingClient(null);
      setIsEditDialogOpen(false);
      toast.success("Client updated");
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error(error?.response?.data?.error || "Couldn't save the client. Please try again.");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDeleteClick = (client) => {
    setClientToDelete(client);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!clientToDelete) return;

    setIsDeleting(true);
    try {
      await deleteClient(clientToDelete.id);
      // Leave the page of the client that was just deleted
      if (pathname === `/dashboard/${clientToDelete.id}`) router.push("/");
      toast.success(`Deleted ${clientToDelete.name}`);
      setClientToDelete(null);
      setDeleteConfirmOpen(false);
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error("Couldn't delete the client. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditInputChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  // Filter clients based on search query
  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email &&
        client.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeClientId =
    selectedClientId ||
    (pathname.startsWith("/dashboard/") ? pathname.split("/")[2] : null);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, active: pathname === "/" },
    { href: "/items", label: "Items", icon: Package, active: pathname.startsWith("/items") },
    {
      href: "/company-setup",
      label: "Company profile",
      icon: Building2,
      active: pathname.startsWith("/company-setup"),
    },
  ];

  const getInitials = (name = "") =>
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  // No sidebar on the landing / sign-in pages
  if (!isSignedIn) return null;

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Invoice Generator</p>
            <p className="text-xs text-muted-foreground">Billing workspace</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={item.active}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Clients */}
        <SidebarGroup className="min-h-0 flex-1">
          <SidebarGroupLabel>
            Clients
            {pagination.totalCount > 0 && (
              <span className="ml-1.5 rounded-full bg-sidebar-accent px-1.5 text-[10px] font-medium tabular-nums">
                {pagination.totalCount}
              </span>
            )}
          </SidebarGroupLabel>
          <Dialog open={isDialogOpen} onOpenChange={(open) => !isSubmitting && setIsDialogOpen(open)}>
            <DialogTrigger asChild>
              <SidebarGroupAction title="Add client" aria-label="Add client">
                <Plus />
              </SidebarGroupAction>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add client</DialogTitle>
                <DialogDescription>
                  Add someone you bill so you can create invoices for them.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateClient}>
                <fieldset disabled={isSubmitting} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="sidebar-client-name">Name</Label>
                    <Input
                      id="sidebar-client-name"
                      value={clientForm.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Acme Inc."
                      autoFocus
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sidebar-client-email">Email</Label>
                    <Input
                      id="sidebar-client-email"
                      type="email"
                      value={clientForm.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="billing@acme.com"
                      required
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
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    disabled={!clientForm.name.trim() || !clientForm.email.trim()}
                  >
                    {isSubmitting ? "Adding…" : "Add client"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <SidebarGroupContent className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="relative px-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <SidebarInput
                type="search"
                placeholder="Search clients"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                aria-label="Search clients"
              />
            </div>

            <div
              ref={clientsContainerRef}
              className="min-h-0 flex-1 overflow-y-auto"
              onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                if (scrollHeight - scrollTop <= clientHeight + 50 && !loadingMore && pagination.hasMore) {
                  loadMoreClients();
                }
              }}
            >
              <SidebarMenu>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <SidebarMenuItem key={i}>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  ))
                ) : clients.length === 0 ? (
                  <div className="px-3 py-8 text-center">
                    <Users className="mx-auto mb-2 size-6 text-muted-foreground" />
                    <p className="text-sm font-medium">No clients yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use the + button to add your first client.
                    </p>
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="px-3 py-8 text-center">
                    <Search className="mx-auto mb-2 size-6 text-muted-foreground" />
                    <p className="text-sm font-medium">No matches</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try a different name or email.
                    </p>
                  </div>
                ) : (
                  filteredClients.map((client) => {
                    const isActive = activeClientId === client.id;
                    return (
                      <SidebarMenuItem key={client.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className="h-auto py-2"
                        >
                          <Link
                            href={`/dashboard/${client.id}`}
                            onClick={() => onClientSelect && onClientSelect(client)}
                          >
                            <span
                              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                                isActive
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-sidebar-accent text-sidebar-accent-foreground"
                              }`}
                            >
                              {getInitials(client.name)}
                            </span>
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-sm font-medium">{client.name}</span>
                              {client.email && (
                                <span className="truncate text-xs text-muted-foreground">
                                  {client.email}
                                </span>
                              )}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction showOnHover aria-label={`Actions for ${client.name}`}>
                              <MoreHorizontal />
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start" className="w-40">
                            <DropdownMenuItem onClick={() => handleEditClient(client)}>
                              <Edit className="mr-2 size-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(client)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 size-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </SidebarMenuItem>
                    );
                  })
                )}

                {loadingMore && (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                    <Spinner className="size-4" /> Loading more…
                  </div>
                )}
              </SidebarMenu>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Edit Client Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => !isEditSubmitting && setIsEditDialogOpen(open)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
            <DialogDescription>Update this client&apos;s details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateClient}>
            <fieldset disabled={isEditSubmitting} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => handleEditInputChange("name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => handleEditInputChange("email", e.target.value)}
                />
              </div>
              <div className="space-y-3 rounded-lg border p-3">
                <Label className="text-sm font-medium">Apply changes to</Label>
                <RadioGroup value={updateOption} onValueChange={setUpdateOption} className="gap-2">
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="fromNow" id="fromNow" className="mt-0.5" />
                    <Label htmlFor="fromNow" className="cursor-pointer text-sm font-normal leading-snug">
                      New invoices only
                      <span className="block text-xs text-muted-foreground">
                        Existing invoices keep the old details.
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="allInvoices" id="allInvoices" className="mt-0.5" />
                    <Label htmlFor="allInvoices" className="cursor-pointer text-sm font-normal leading-snug">
                      All invoices
                      <span className="block text-xs text-muted-foreground">
                        Also update this client on every existing invoice.
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </fieldset>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isEditSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isEditSubmitting} disabled={!editForm.name.trim()}>
                {isEditSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => !isDeleting && setDeleteConfirmOpen(open)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete {clientToDelete?.name}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the client and all of their invoices. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              loading={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
