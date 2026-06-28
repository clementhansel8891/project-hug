import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input as UIInput } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRightLeft,
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  ChevronRight,
  Truck,
  Box,
  History,
  Activity,
  Box as BoxIcon,
  Globe,
  Settings,
  Tags,
  ShoppingCart,
  Layout,
  Layers,
  FileText,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import DepartmentWorkspaceLayout from "@/components/layouts/DepartmentWorkspaceLayout";
import { CreateTransferDialog } from "./components/CreateTransferDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { inventoryService } from "@/core/services/inventory/inventoryService";
import { TransferManifestDialog } from "./components/TransferManifestDialog";
import { CourierDispatchDialog } from "./components/CourierDispatchDialog";
import { Zap } from "lucide-react";

interface TransferRecord {
  id: string;
  transferNo: string;
  fromLocation: string;
  toLocation: string;
  status: "REQUESTED" | "PICKED" | "SHIPPED" | "RECEIVED" | "CANCELLED";
  createdAt: string;
  itemCount: number;
}

export default function InventoryTransferDesk() {
  const session = useSession();
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [manifestOpen, setManifestOpen] = useState(false);
  const [futureIntegrationOpen, setFutureIntegrationOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<any[]>("/inventory/stock-transfers", "GET", session);
      
      // Map backend response to frontend interface
      const mappedTransfers: TransferRecord[] = (Array.isArray(response) ? response : []).map(t => ({
        id: t.id,
        transferNo: t.id.split('-')[0].toUpperCase(), // Fallback if transfer_no is missing
        fromLocation: t.from_location?.name || t.from_location_id || "Unknown Source",
        toLocation: t.to_location?.name || t.to_location_id || "Unknown Dest",
        status: t.status,
        createdAt: t.created_at || t.requested_at,
        itemCount: Number(t.quantity) || 1
      }));

      setTransfers(mappedTransfers);
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Could not retrieve transfer data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [session]);

  const handlePick = async (id: string) => {
    setActionLoading(id);
    try {
      await inventoryService.pickStockTransfer(session.tenant_id, session, id);
      toast({ title: "Authorization Success", description: "Transfer has been authorized and items picked." });
      fetchData();
    } catch (err: any) {
      toast({ title: "Authorization Failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleShip = async (id: string) => {
    setActionLoading(id);
    try {
      await inventoryService.shipStockTransfer(session.tenant_id, session, id, `TRK-${id.split('-')[0].toUpperCase()}`);
      toast({ title: "Logistics Engaged", description: "Items are now in transit." });
      fetchData();
    } catch (err: any) {
      toast({ title: "Logistics Failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReceive = async (id: string) => {
    setActionLoading(id);
    try {
      await inventoryService.receiveStockTransfer(session.tenant_id, session, id);
      toast({ title: "Asset Reconciled", description: "Inventory has been updated at destination node." });
      fetchData();
    } catch (err: any) {
      toast({ title: "Reconciliation Failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTransfers = (Array.isArray(transfers) ? transfers : []).filter((t) => {
    const matchesSearch = t.transferNo.toLowerCase().includes(search.toLowerCase()) ||
      t.fromLocation.toLowerCase().includes(search.toLowerCase()) ||
      t.toLocation.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const headerActions = (
    <div className="flex gap-2">
      <Button
        onClick={() => setIsCreateModalOpen(true)}
        className="rounded-xl bg-foreground text-background hover:bg-foreground/90 shadow-lg font-black text-[10px] uppercase tracking-widest h-9 px-6"
      >
        <Plus className="h-3 w-3 mr-2" /> New Transfer
      </Button>
    </div>
  );

  const mainContent = (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl shadow-muted/50 dark:shadow-none bg-card dark:bg-muted rounded-[2.5rem] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-primary opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">
              {transfers.filter(t => t.status === 'SHIPPED').length}
            </div>
            <p className="text-[10px] font-bold text-primary mt-1 uppercase tracking-widest">Active Logistics</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-xl shadow-muted/50 dark:shadow-none bg-card dark:bg-muted rounded-[2.5rem] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Pending Approval</CardTitle>
            <AlertCircle className="h-4 w-4 text-warning opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-warning">
              {transfers.filter(t => t.status === 'REQUESTED' || t.status === 'PICKED').length}
            </div>
            <p className="text-[10px] font-bold text-warning mt-1 uppercase tracking-widest">Awaiting Authorization</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-muted/50 dark:shadow-none bg-card dark:bg-muted rounded-[2.5rem] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Completed (MTD)</CardTitle>
            <History className="h-4 w-4 text-success opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-success">
              {transfers.filter(t => t.status === 'RECEIVED').length}
            </div>
            <p className="text-[10px] font-bold text-success mt-1 uppercase tracking-widest">Asset Reconciliation</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl shadow-muted/50 dark:shadow-none bg-card dark:bg-muted rounded-[3rem] overflow-hidden">
        <div className="p-8 border-b flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <UIInput
              placeholder="Search by Transfer No or Location..."
              className="pl-12 h-14 bg-muted dark:bg-muted border-none rounded-2xl text-sm font-bold shadow-inner focus-visible:ring-1 focus-visible:ring-primary/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-14 px-6 rounded-2xl border-muted text-xs font-black uppercase tracking-widest hover:bg-muted">
                  <Filter className="h-4 w-4 mr-2" /> {statusFilter === 'ALL' ? 'Filter' : `Status: ${statusFilter}`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-40 px-4 py-3">Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {['ALL', 'REQUESTED', 'PICKED', 'SHIPPED', 'RECEIVED'].map((status) => (
                  <DropdownMenuItem 
                    key={status}
                    className={`rounded-xl px-4 py-3 text-xs font-bold cursor-pointer transition-colors ${statusFilter === status ? 'bg-primary/10 text-primary' : ''}`}
                    onClick={() => setStatusFilter(status)}
                  >
                    {status}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="bg-muted dark:bg-muted">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest pl-8 py-6">ID</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Route Protocol</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 text-center">Items</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 text-center">Status</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 text-right pr-8">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-muted dark:border-muted">
                      <TableCell colSpan={5} className="py-6 px-8">
                        <Skeleton className="h-12 w-full rounded-xl" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center opacity-20">
                        <Truck className="h-12 w-12 mb-4 stroke-[1]" />
                        <h3 className="text-xl font-black uppercase tracking-widest">No Active Logistics</h3>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((t) => (
                    <TableRow 
                      key={t.id} 
                      className="border-muted dark:border-muted group hover:bg-primary/[0.02] transition-all"
                    >
                      <TableCell className="pl-8 py-6">
                        <span className="text-xs font-mono font-black text-muted-foreground group-hover:text-primary transition-colors">{t.transferNo}</span>
                      </TableCell>
                      <TableCell className="py-6">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black tracking-tight">{t.fromLocation}</span>
                          <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-black tracking-tight">{t.toLocation}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-6 text-center">
                        <Badge variant="outline" className="text-[10px] font-black border-none bg-muted/30 rounded-lg">
                          {t.itemCount} Units
                        </Badge>
                      </TableCell>
                      <TableCell className="py-6 text-center">
                        <Badge variant="outline" className={`text-[9px] font-black tracking-[0.2em] rounded-lg border-none uppercase ${
                          t.status === 'SHIPPED' ? 'bg-primary text-primary' : 
                          t.status === 'RECEIVED' ? 'bg-success text-success' : 
                          t.status === 'REQUESTED' ? 'bg-warning text-warning' :
                          t.status === 'PICKED' ? 'bg-primary text-primary' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-6 text-right pr-8">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-muted dark:hover:bg-muted" disabled={actionLoading === t.id}>
                              {actionLoading === t.id ? (
                                <Activity className="h-4 w-4 animate-spin text-primary" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-2xl border-muted dark:border-muted bg-card dark:bg-muted p-2 shadow-2xl">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-40 px-4 py-3">Protocol Actions</DropdownMenuLabel>
                            
                            {t.status === 'REQUESTED' && (
                              <DropdownMenuItem 
                                className="rounded-xl px-4 py-3 text-xs font-bold cursor-pointer hover:bg-warning dark:hover:bg-warning text-warning transition-colors"
                                onClick={() => handlePick(t.id)}
                              >
                                <Box className="h-4 w-4 mr-3" /> Authorize & Pick Items
                              </DropdownMenuItem>
                            )}

                            {t.status === 'PICKED' && (
                              <>
                                <DropdownMenuItem 
                                  className="rounded-xl px-4 py-3 text-xs font-bold cursor-pointer hover:bg-primary dark:hover:bg-primary text-primary transition-colors"
                                  onClick={() => handleShip(t.id)}
                                >
                                  <Zap className="h-4 w-4 mr-3" /> Direct Shipment (Manual)
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="rounded-xl px-4 py-3 text-xs font-bold cursor-pointer hover:bg-muted dark:hover:bg-muted text-muted-foreground transition-colors"
                                  onClick={() => setFutureIntegrationOpen(true)}
                                >
                                  <Truck className="h-4 w-4 mr-3" /> Courier Integration
                                </DropdownMenuItem>
                              </>
                            )}

                            {t.status === 'SHIPPED' && (
                              <DropdownMenuItem 
                                className="rounded-xl px-4 py-3 text-xs font-bold cursor-pointer hover:bg-success dark:hover:bg-success text-success transition-colors"
                                onClick={() => handleReceive(t.id)}
                              >
                                <ChevronRight className="h-4 w-4 mr-3" /> Confirm Reception
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator className="bg-muted dark:bg-muted my-2 mx-2" />
                            <DropdownMenuItem 
                              className="rounded-xl px-4 py-3 text-xs font-bold cursor-pointer"
                              onClick={() => {
                                setSelectedTransferId(t.id);
                                setManifestOpen(true);
                              }}
                            >
                              <FileText className="h-4 w-4 mr-3" /> View Manifest
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-full p-8 space-y-10 bg-muted dark:bg-muted">
      {/* Tactical Header */}
      <div className="flex items-end justify-between border-b border-muted dark:border-muted pb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.3em]">
            <Layers className="h-3 w-3" /> LOGISTICS_ENGINE
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-muted-foreground dark:text-white">
            Transfer Desk
          </h1>
          <p className="text-sm text-muted-foreground font-medium italic">Orchestrate secure asset movement and inter-nodal logistics.</p>
        </div>
        {headerActions}
      </div>

      {mainContent}

      <CreateTransferDialog 
        open={isCreateModalOpen} 
        onOpenChange={setIsCreateModalOpen}
        onSuccess={fetchData}
      />

      <TransferManifestDialog 
        open={manifestOpen} 
        onOpenChange={setManifestOpen} 
        transferId={selectedTransferId} 
      />

      <CourierDispatchDialog 
        open={futureIntegrationOpen} 
        onOpenChange={setFutureIntegrationOpen}
        transferId={selectedTransferId || ""}
        onSuccess={fetchData}
      />
    </div>
  );
}
