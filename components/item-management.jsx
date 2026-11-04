"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Users, Globe, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useClients } from "@/contexts/ClientContext";
import ItemList from "./item-list";

export default function ItemManagement() {
  const { clients, loading: clientsLoading } = useClients();
  const router = useRouter();
  const [selectedClients, setSelectedClients] = useState([]);
  const [showAllClients, setShowAllClients] = useState(false);

  const handleEditItem = (item) => {
    // Edit functionality removed
  };

  const handleClientSelect = (clientId) => {
    if (clientId === "all") {
      setShowAllClients(true);
      setSelectedClients([]);
    } else if (clientId && !selectedClients.find((c) => c.id === clientId)) {
      const client = clients.find((c) => c.id === clientId);
      if (client) {
        setSelectedClients((prev) => [...prev, client]);
        setShowAllClients(false);
      }
    }
  };

  const removeClient = (clientId) => {
    setSelectedClients((prev) => prev.filter((c) => c.id !== clientId));
  };

  const clearAllFilters = () => {
    setSelectedClients([]);
    setShowAllClients(false);
  };

  const handleBackToDashboard = () => {
    router.push("/");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Items</h1>
        <p className="text-sm text-muted-foreground">
          Save the products and services you bill often, then add them to any invoice in one click.
        </p>
      </div>
      <Card>
        <CardHeader className="sr-only">
          <CardTitle>Saved items</CardTitle>
          <CardDescription>Filter saved items by client.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Client Filter Section */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">
                  Filter by Client
                </label>
                <Select
                  onValueChange={handleClientSelect}
                  disabled={clientsLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a client to filter items..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Show All Items
                      </div>
                    </SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {client.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selected Filters Display */}
            {(selectedClients.length > 0 || showAllClients) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Filtering by:</span>
                {showAllClients && (
                  <Badge variant="default" className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    All Items
                    <button
                      onClick={clearAllFilters}
                      className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {selectedClients.map((client) => (
                  <Badge
                    key={client.id}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <Users className="h-3 w-3" />
                    {client.name}
                    <button
                      onClick={() => removeClient(client.id)}
                      className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {selectedClients.length > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          <ItemList
            onEditItem={handleEditItem}
            selectedClients={selectedClients}
            showAllClients={showAllClients}
          />
        </CardContent>
      </Card>
    </div>
  );
}
