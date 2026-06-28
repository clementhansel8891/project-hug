import React, { useState, useEffect } from "react";
import {
  PlusCircle,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  User,
  Database,
  Building2,
  Globe,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/core/security/session";
import { retailService } from "@/core/services/retail/retailService";
import { hrService } from "@/core/services/hr/hrService";
import type { RetailStore, RetailStoreType } from "@/core/types/retail/retail";
import { COUNTRIES, getCountry } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface CreateStoreDialogProps {
  onSuccess: (store: RetailStore) => void;
  trigger?: React.ReactNode;
}

export const CreateStoreDialog: React.FC<CreateStoreDialogProps> = ({
  onSuccess,
  trigger,
}) => {
  const session = useSession();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const [locations, setLocations] = useState<
    Array<{ id: string; name: string; code: string; address: string }>
  >([]);
  const [pools, setPools] = useState<Array<{ id: string; name: string }>>([]);
  const [managers, setManagers] = useState<
    Array<{ id: string; fullName: string }>
  >([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [useOfficeAddress, setUseOfficeAddress] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("ID");
  const selectedCountry = getCountry(selectedCountryCode);

  const loadFormData = React.useCallback(async () => {
    if (!session.tenant_id) return;
    setIsLoadingData(true);
    try {
      const tenantId = session.tenant_id;
      const [locs, plsz, mgrs] = await Promise.all([
        hrService.listLocations(tenantId, session),
        retailService.listInventoryPools(tenantId, session),
        hrService.listEmployees(tenantId, session),
      ]);
      setLocations(locs || []);
      setPools(plsz || []);
      setManagers(mgrs || []);
    } catch (err) {
      console.error("Failed to load dialog data", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [session]);

  useEffect(() => {
    if (open && session.tenant_id) {
      loadFormData();
    }
  }, [open, session.tenant_id, loadFormData]);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session.tenant_id) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const code = formData.get("code") as string;
    const type = formData.get("type") as RetailStoreType;
    const phone = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const managerId = formData.get("managerId") as string;
    const inventoryPoolId = formData.get("inventoryPoolId") as string;
    const latitude = formData.get("latitude") ? parseFloat(formData.get("latitude") as string) : undefined;
    const longitude = formData.get("longitude") ? parseFloat(formData.get("longitude") as string) : undefined;
    const geofenceRadius = formData.get("geofence_radius") ? parseFloat(formData.get("geofence_radius") as string) : 200;

    if (!name || !code || !selectedLocationId) {
      toast({
        title: "Validation Error",
        description:
          "Name, Code, and Location Assignment are required for provisioning.",
        variant: "destructive",
      });
      return;
    }

    let finalAddress = manualAddress;
    if (useOfficeAddress) {
      const selectedLoc = locations.find((l) => l.id === selectedLocationId);
      finalAddress = selectedLoc?.address || "";
    }

    setIsRegistering(true);
    try {
      const payload = {
        name,
        code,
        locationId: selectedLocationId,
        type,
        address: finalAddress,
        phone,
        email,
        managerId: managerId || undefined,
        inventoryPoolId: inventoryPoolId || undefined,
        latitude,
        longitude,
        geofenceRadius,
        country: selectedCountryCode || undefined,
        currency: selectedCountry?.currency || undefined,
        timezone: "Asia/Jakarta", // Defaulting for ID, could be made dynamic
      };

      const created = await retailService.createStore(
        session.tenant_id,
        session,
        payload as Partial<RetailStore>,
      );

      toast({
        title: "Node Provisioned",
        description: `${name} has been successfully added to the fleet registry.`,
      });
      onSuccess(created);
      setOpen(false);
    } catch (err) {
      toast({
        title: "Provisioning Failed",
        description:
          "The system encountered an error while establishing the new node.",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="h-11 px-6 rounded-2xl bg-primary hover:bg-primary text-foreground font-black italic uppercase tracking-widest text-[10px] gap-2 shadow-xl transition-all active:scale-95">
            <PlusCircle className="w-4 h-4" /> Provision New Node
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-2xl border-border/50 bg-white/80 backdrop-blur-2xl shadow-2xl max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        <DialogHeader className="p-8 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary rounded-xl text-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <DialogTitle className="font-black italic text-2xl uppercase tracking-tighter text-muted-foreground">
              Establish New Retail Node
            </DialogTitle>
          </div>
          <DialogDescription className="font-bold text-muted-foreground uppercase tracking-widest text-[10px]">
            Assign unique identifiers and operational parameters for fleet
            integration.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleRegister}
          className="flex-1 overflow-y-auto p-8 pt-0"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
            {/* Metadata & Identity */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">
                  Node Identity (Name)
                </Label>
                <div className="relative group">
                  <input
                    type="text"
                    name="name"
                    required
                    className="flex h-12 w-full rounded-2xl border border-border bg-secondary/5 px-4 py-2 font-bold italic text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-primary transition-all"
                    placeholder="e.g. Ubud Flagship"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">
                  Authoritative Code (Unique)
                </Label>
                <input
                  type="text"
                  name="code"
                  required
                  className="flex h-12 w-full rounded-2xl border border-border bg-secondary/5 px-4 py-2 font-bold italic text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-primary transition-all"
                  placeholder="e.g. UBX-01"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">
                  Node Classification
                </Label>
                <select
                  name="type"
                  defaultValue="flagship"
                  className="w-full h-12 rounded-2xl border border-border bg-secondary/5 px-4 font-bold italic text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="flagship">Flagship Node</option>
                  <option value="satellite">Satellite Branch</option>
                  <option value="warehouse">Logistics Hub (Warehouse)</option>
                  <option value="pop-up">Pop-Up Instance</option>
                  <option value="express">Express Outlet</option>
                </select>
              </div>

              <div className="space-y-6 pt-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">
                    Node Contact Info
                  </Label>
                  <div className="space-y-3">
                    <div className="relative">
                      <Phone className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                      <input
                        type="tel"
                        name="phone"
                        className="flex h-12 w-full rounded-2xl border border-border bg-secondary/5 pl-11 pr-4 py-2 font-bold italic text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-primary transition-all"
                        placeholder="Registry Phone Line"
                      />
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                      <input
                        type="email"
                        name="email"
                        className="flex h-12 w-full rounded-2xl border border-border bg-secondary/5 pl-11 pr-4 py-2 font-bold italic text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-primary transition-all"
                        placeholder="Node Email Alias"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Context & Placement */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> HR Location Context
                </Label>
                <select
                  required
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full h-12 rounded-2xl border border-border bg-secondary/5 px-4 font-bold italic text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>
                    Select Bound Location...
                  </option>
                  <option
                    value="placeholder"
                    className="text-primary font-black italic"
                  >
                    + PROVISION NEW PHYSICAL LOCATION
                  </option>
                  <hr className="my-2" />
                  {(Array.isArray(locations) ? locations : []).map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} [{loc.code}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Physical Address
                  </Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="use-office"
                      checked={useOfficeAddress}
                      onCheckedChange={(v) => setUseOfficeAddress(v as boolean)}
                      className="rounded-md border-border"
                    />
                    <Label
                      htmlFor="use-office"
                      className="text-[9px] font-black uppercase tracking-widest text-primary cursor-pointer"
                    >
                      Inherit from Location
                    </Label>
                  </div>
                </div>
                <textarea
                  value={
                    useOfficeAddress
                      ? locations.find((l) => l.id === selectedLocationId)
                          ?.address || "No authoritative address found"
                      : manualAddress
                  }
                  onChange={(e) => setManualAddress(e.target.value)}
                  disabled={useOfficeAddress}
                  className="flex min-h-[100px] w-full rounded-2xl border border-border bg-secondary/5 px-4 py-3 font-bold italic text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-primary transition-all disabled:opacity-50 resize-none"
                  placeholder="Street, City, Building, Floor..."
                />
              </div>

              {/* Geospatial Section */}
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" /> Geospatial Anchoring
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Latitude</Label>
                    <input
                      type="number"
                      step="any"
                      name="latitude"
                      placeholder="0.0000"
                      className="flex h-10 w-full rounded-lg border border-border bg-card px-2 font-bold text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Longitude</Label>
                    <input
                      type="number"
                      step="any"
                      name="longitude"
                      placeholder="0.0000"
                      className="flex h-10 w-full rounded-lg border border-border bg-card px-2 font-bold text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Geofence Radius (m)</Label>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    name="geofence_radius"
                    defaultValue="200"
                    className="w-full h-1.5 bg-primary rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Node Commander
                  </Label>
                  <select
                    name="managerId"
                    className="w-full h-11 rounded-2xl border border-border bg-secondary/5 px-4 font-bold italic text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-primary transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {(Array.isArray(managers) ? managers : []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> Inventory Pool
                  </Label>
                  <select
                    name="inventoryPoolId"
                    className="w-full h-11 rounded-2xl border border-border bg-secondary/5 px-4 font-bold italic text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-primary transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Private Local Pool</option>
                    {(Array.isArray(pools) ? pools : []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-12 sticky bottom-0 bg-background/80 backdrop-blur-md pb-8 -mx-8 px-8 border-t border-border pt-6">
            <div className="flex w-full gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1 h-14 rounded-2xl border-border font-black italic uppercase tracking-widest text-[10px] hover:bg-secondary/5 transition-all"
              >
                Abort Provisioning
              </Button>
              <Button
                type="submit"
                disabled={isRegistering || isLoadingData}
                className="flex-[2] h-14 bg-primary hover:bg-primary text-foreground font-black italic rounded-2xl shadow-xl shadow-blue-500/20 uppercase tracking-[0.2em] text-[10px] group transition-all active:scale-95"
              >
                {isRegistering ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <div className="flex items-center gap-2">
                    Establish Authoritative Node
                    <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                  </div>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
