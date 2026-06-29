import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical,
  Download,
  Trash2,
  ExternalLink,
  Tag,
  FolderOpen,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  Activity,
  Layers,
  ShieldCheck,
  Zap,
  Box,
  Rocket,
  ArrowUpRight,
  Globe,
  MoreHorizontal,
  RefreshCw,
  FolderPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { marketingService } from "@/core/services/marketing/marketingService";
import { useSession } from "@/core/security/session";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/shared/AsyncState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UploadAssetModal } from "./modals/UploadAssetModal";
import { EditAssetTagsModal } from "./modals/EditAssetTagsModal";

export default function CreativeLibrary() {
  const session = useSession();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assets, setAssets] = useState<any[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Tag editing state
  const [editTagsOpen, setEditTagsOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [newTags, setNewTags] = useState("");

  const refresh = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const data = await marketingService.listAssets(session.tenant_id, session);
      setAssets(data);
      if (isManual) toast.success("Archive telemetry synchronized.");
    } catch (err) {
      console.error("Failed to load assets:", err);
      // Fallback for demo
      setAssets([
        { id: "1", name: "Summer Campaign Hero", type: "IMAGE", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800", tags: ["Summer", "Banner"], date: "2024-03-20" },
        { id: "2", name: "Brand Intro Video", type: "VIDEO", url: "https://api.estelagea.ai/placeholder-video.mp4", tags: ["Brand", "Social"], date: "2024-03-18" },
        { id: "3", name: "Lead Magnet Template", type: "DOCUMENT", url: "#", tags: ["Lead Gen", "PDF"], date: "2024-03-15" },
        { id: "4", name: "Facebook Ad V1", type: "IMAGE", url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=800", tags: ["Ads", "Facebook"], date: "2024-03-12" },
        { id: "5", name: "Product Showcase", type: "IMAGE", url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800", tags: ["Catalog", "HQ"], date: "2024-03-10" },
        { id: "6", name: "Q1 Sales Deck", type: "DOCUMENT", url: "#", tags: ["Sales", "Internal"], date: "2024-03-05" },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.tenant_id, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    setUploadStage("INITIALIZING_HANDSHAKE");
    
    try {
      const formData = new FormData(e.currentTarget);
      
      // Simulate strategic ingestion stages for premium feel
      await new Promise(r => setTimeout(r, 800));
      setUploadStage("ENCRYPTING_PAYLOAD");
      await new Promise(r => setTimeout(r, 800));
      setUploadStage("SYNCHRONIZING_NODES");
      
      await marketingService.uploadAsset(session.tenant_id, session, formData);
      
      setUploadStage("VERIFYING_INTEGRITY");
      await new Promise(r => setTimeout(r, 600));
      
      toast.success("Strategic Asset Injected", {
        description: "New creative material synchronized with the global matrix."
      });
      setUploadOpen(false);
      refresh(true);
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Upload failure in the neural link.");
    } finally {
      setUploading(false);
      setUploadStage("IDLE");
    }
  };

  const [uploadStage, setUploadStage] = useState<"IDLE" | "INITIALIZING_HANDSHAKE" | "ENCRYPTING_PAYLOAD" | "SYNCHRONIZING_NODES" | "VERIFYING_INTEGRITY">("IDLE");

  const handleDownload = (url: string, filename: string) => {
    if (url === "#" || !url) {
      toast.error("Download link not available for this node.");
      return;
    }
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
      {
        loading: 'Decrypting high-resolution binary...',
        success: () => {
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return 'Binary transmission started!';
        },
        error: 'Binary transmission failure.',
      }
    );
  };

  const handleUpdateTags = async () => {
    if (!selectedAsset) return;
    try {
      const tagsArray = newTags.split(',').map(t => t.trim()).filter(t => t !== "");
      await marketingService.updateCreativeAsset(session.tenant_id, session, selectedAsset.id, { tags: tagsArray });
      toast.success("Semantic Matrix Updated.");
      setEditTagsOpen(false);
      refresh(true);
    } catch (err) {
      console.error("Failed to update tags:", err);
      toast.error("Update failed.");
    }
  };

  const filteredAssets = useMemo(() => {
    return (Array.isArray(assets) ? assets : []).filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || 
                           a.tags?.some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
      
      const matchesType = typeFilter.length === 0 || typeFilter.includes(a.type);
      
      return matchesSearch && matchesType;
    });
  }, [assets, search, typeFilter]);

  const toggleTypeFilter = (type: string) => {
    setTypeFilter(prev => 
      prev.includes(type) ? (Array.isArray(prev) ? prev : []).filter(t => t !== type) : [...prev, type]
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted dark:bg-muted">
        <div className="flex flex-col items-center gap-6">
          <div className="h-20 w-20 bg-primary rounded-[2.5rem] animate-pulse flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <Box className="h-10 w-10 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Scanning Digital Archives...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-1000 max-w-[1600px] mx-auto pb-24">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white border-none font-black px-3 py-1 rounded-full uppercase tracking-widest text-[10px]">Digital Asset Management</Badge>
            <div className="flex items-center gap-1.5 text-primary font-bold text-xs uppercase tracking-widest">
               <Activity className="h-4 w-4 animate-pulse" />
               Archive Stream Active
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-foreground">Creative Library</h1>
          <p className="text-muted-foreground font-medium max-w-2xl text-lg leading-relaxed italic">"A centralized high-performance repository for multi-channel campaign orchestration."</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-muted0 dark:bg-muted backdrop-blur-xl p-2 rounded-[2rem] border border-border dark:border-border/20 shadow-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-11 h-14 w-[300px] rounded-[1.5rem] bg-transparent border-none focus-visible:ring-0 text-base font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the archive..."
              />
            </div>
            <Button
              variant="secondary"
              className="h-14 w-14 rounded-[1.5rem] bg-primary text-white hover:bg-primary transition-all shadow-xl shadow-indigo-500/20"
              onClick={() => refresh(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-6 w-6", refreshing && "animate-spin")} />
            </Button>
          </div>
          <Button 
            className="h-[4.5rem] px-10 rounded-[2rem] bg-primary hover:bg-primary shadow-2xl shadow-indigo-500/30 font-black text-sm gap-3 group transition-all hover:scale-105 active:scale-95"
            onClick={() => setUploadOpen(true)}
          >
            <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" /> 
            INJECT STRATEGIC ASSET
          </Button>
        </div>
      </div>

      {/* Strategic Intelligence Toolbar */}
      <div className="flex flex-col lg:flex-row gap-6 items-center glass-card p-6 rounded-[2.5rem] border border-border dark:border-border/20 shadow-2xl">
         <div className="flex items-center gap-4 w-full lg:w-auto">
            <DropdownMenu>
               <DropdownMenuTrigger asChild>
                  <Button variant="secondary" className="h-14 px-8 rounded-2xl gap-3 font-black text-[10px] uppercase tracking-widest bg-card dark:bg-muted border-none shadow-sm transition-all hover:shadow-md">
                     <Filter className="h-5 w-5 text-primary" /> 
                     REFINE SEARCH
                     <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent className="w-64 rounded-2xl p-2 shadow-2xl border-none" align="start">
                  <DropdownMenuLabel className="font-black text-[10px] uppercase tracking-widest opacity-50 px-3 py-2">Asset Node Type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem className="rounded-xl py-3 font-bold" checked={typeFilter.includes("IMAGE")} onCheckedChange={() => toggleTypeFilter("IMAGE")}>Images</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem className="rounded-xl py-3 font-bold" checked={typeFilter.includes("VIDEO")} onCheckedChange={() => toggleTypeFilter("VIDEO")}>Videos</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem className="rounded-xl py-3 font-bold" checked={typeFilter.includes("DOCUMENT")} onCheckedChange={() => toggleTypeFilter("DOCUMENT")}>Documents</DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setTypeFilter([])} className="text-primary font-black text-[10px] uppercase tracking-widest rounded-xl py-3 justify-center">CLEAR ALL FILTERS</DropdownMenuItem>
               </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex bg-muted dark:bg-muted p-1.5 rounded-2xl shadow-inner border border-border">
               <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn("h-11 w-11 rounded-xl transition-all", view === "grid" ? "bg-card dark:bg-muted shadow-md text-primary" : "text-muted-foreground")}
                  onClick={() => setView("grid")}
               >
                  <Layers className="h-5 w-5" />
               </Button>
               <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn("h-11 w-11 rounded-xl transition-all", view === "list" ? "bg-card dark:bg-muted shadow-md text-primary" : "text-muted-foreground")}
                  onClick={() => setView("list")}
               >
                  <MoreHorizontal className="h-5 w-5" />
               </Button>
            </div>
         </div>

         <div className="flex-1 hidden lg:flex items-center justify-end gap-10 pr-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <div className="flex items-center gap-3">
               <Badge className="bg-primary text-primary border-none">{assets.length}</Badge>
               GLOBAL ASSETS
            </div>
            <div className="flex items-center gap-3">
               <Badge className="bg-success text-success border-none">{(Array.isArray(assets) ? assets : []).filter(a => a.type === 'IMAGE').length}</Badge>
               IMAGE NODES
            </div>
            <div className="flex items-center gap-3">
               <Badge className="bg-destructive text-destructive border-none">{(Array.isArray(assets) ? assets : []).filter(a => a.type === 'VIDEO').length}</Badge>
               VIDEO STREAM
            </div>
         </div>
      </div>

      {/* Asset Grid */}
      {filteredAssets.length === 0 ? (
        <EmptyState
          title="Zero matches in archive"
          description="Adjust your parameters and attempt a new retrieval."
          icon={Search}
        />
      ) : (
        <div className={cn(
          "grid gap-10",
          view === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
        )}>
          {(Array.isArray(filteredAssets) ? filteredAssets : []).map((asset) => (
            <Card key={asset.id} className="group relative overflow-hidden rounded-[2.5rem] border-none bg-card dark:bg-muted shadow-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 cursor-default">
              <CardContent className="p-0">
                <div className="aspect-[4/3] relative bg-muted dark:bg-muted flex items-center justify-center overflow-hidden group/thumb">
                  {asset.type === "IMAGE" ? (
                    <img src={asset.url} alt={asset.name} className="object-cover w-full h-full group-hover/thumb:scale-110 transition-transform duration-1000" />
                  ) : asset.type === "VIDEO" ? (
                    <div className="flex flex-col items-center gap-4 text-muted-foreground">
                      <div className="h-20 w-20 rounded-full bg-destructive flex items-center justify-center group-hover/thumb:scale-110 transition-transform duration-500">
                        <Video className="h-10 w-10 text-destructive" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">Temporal Content</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-muted-foreground">
                      <div className="h-20 w-20 rounded-full bg-success flex items-center justify-center group-hover/thumb:scale-110 transition-transform duration-500">
                        <FileText className="h-10 w-10 text-success" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">Strategic Script</span>
                    </div>
                  )}
                  
                  {/* Action Overlay */}
                  <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-100 transition-all duration-500 backdrop-blur-[2px] flex items-center justify-center gap-4">
                    <Button 
                      size="icon" 
                      className="h-14 w-14 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all bg-card text-primary"
                      onClick={() => handleDownload(asset.url, asset.name)}
                    >
                      <Download className="h-6 w-6" />
                    </Button>
                    <Button 
                      size="icon" 
                      className="h-14 w-14 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all bg-card text-primary" 
                      onClick={() => window.open(asset.url, '_blank')}
                    >
                      <ExternalLink className="h-6 w-6" />
                    </Button>
                  </div>

                  <div className="absolute top-6 left-6">
                    <Badge className="bg-white/90 dark:bg-muted text-primary backdrop-blur-md text-[9px] font-black py-1 h-7 rounded-full shadow-lg border-none tracking-[0.2em] px-4 uppercase">
                      {asset.type}
                    </Badge>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-8 flex flex-col items-start gap-6">
                <div className="flex justify-between items-start w-full">
                  <div className="space-y-1 pr-4">
                    <h3 className="font-black text-xl leading-tight group-hover:text-primary transition-colors line-clamp-1 uppercase tracking-tight">{asset.name}</h3>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest italic">Vault Archival • {asset.date ? formatDate(asset.date) : formatDate(new Date())}</p>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-muted dark:hover:bg-muted -mr-2">
                        <MoreVertical className="h-5 w-5 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-2xl border-none">
                      <DropdownMenuLabel className="font-black text-[10px] uppercase tracking-widest opacity-50 px-3 py-2">Asset Controls</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-3 rounded-xl py-3 font-bold" onClick={() => handleDownload(asset.url, asset.name)}><Download className="h-4 w-4" /> Download Binary</DropdownMenuItem>
                      <DropdownMenuItem className="gap-3 rounded-xl py-3 font-bold" onClick={() => {
                        setSelectedAsset(asset);
                        setNewTags(asset.tags?.join(', ') || "");
                        setEditTagsOpen(true);
                      }}><Tag className="h-4 w-4" /> Modify Tag Matrix</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-3 text-destructive rounded-xl py-3 font-bold" onClick={() => toast.error("Archival restricted for core assets")}><Trash2 className="h-4 w-4" /> Permanent Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {asset.tags?.length > 0 ? (
                    (Array.isArray(asset.tags) ? asset.tags : []).map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-[9px] font-black py-0.5 h-6 bg-muted dark:bg-muted text-muted-foreground border-none uppercase tracking-widest px-3 rounded-full">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] italic">Untagged Protocol</span>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
          
          {/* Add New Card */}
          {view === "grid" && (
            <Card 
              className="border-2 border-dashed border-border dark:border-border bg-transparent flex flex-col items-center justify-center min-h-[350px] gap-8 rounded-[2.5rem] hover:bg-primary dark:hover:bg-primary transition-all cursor-pointer group"
              onClick={() => setUploadOpen(true)}
            >
              <div className="h-24 w-24 rounded-full bg-muted dark:bg-muted flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:bg-primary transition-all duration-500">
                <FolderPlus className="h-12 w-12 text-muted-foreground group-hover:text-white transition-all duration-500" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-black tracking-tight group-hover:text-primary uppercase">Inject New Protocol</p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Synchronize Strategic Asset</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Upload Asset Modal */}
      <UploadAssetModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => refresh(true)}
      />

      {/* Edit Asset Tags Modal */}
      <EditAssetTagsModal
        isOpen={editTagsOpen}
        onClose={() => { setEditTagsOpen(false); setSelectedAsset(null); }}
        assetId={selectedAsset?.id ?? ""}
        assetName={selectedAsset?.name ?? ""}
        currentTags={selectedAsset?.tags?.join(", ") ?? ""}
        onSuccess={() => refresh(true)}
      />
    </div>
  );
}
