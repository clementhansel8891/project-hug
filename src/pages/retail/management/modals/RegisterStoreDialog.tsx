/**
 * RegisterStoreDialog — Store registration with React Hook Form + Zod + useMutation.
 *
 * Wired according to the canonical pattern:
 * 1. Zod schema for validation (name, code, locationId required)
 * 2. useForm with zodResolver
 * 3. useMutation with apiRequest
 * 4. getMutationToastHandlers for standardized success/error
 * 5. Loading states (isPending disables submit/cancel/fields via fieldset)
 * 6. Accessibility: aria-describedby on error fields, aria-invalid, role="alert"
 *
 * Requirements: 1 (Form Fields), 2 (Validation), 3 (API Submission),
 *               4 (Loading State), 5 (Error Handling), 6 (Success Handling),
 *               10 (Consistent Pattern)
 */

import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Plus,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  User,
  Database,
  Globe,
  Loader2,
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
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { retailService } from "@/core/services/retail/retailService";
import { hrService } from "@/core/services/hr/hrService";
import type { RetailStore, RetailStoreType } from "@/core/types/retail/retail";
import { COUNTRIES, getCountry } from "@/lib/countries";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const storeTypeValues = ["flagship", "express", "kiosk", "pop-up", "warehouse"] as const;

const registerStoreSchema = z.object({
  name: z.string().min(1, "Store name is required").max(200, "Name must be 200 characters or fewer"),
  code: z.string().min(1, "Store code is required").max(20, "Code must be 20 characters or fewer"),
  type: z.enum(storeTypeValues).default("flagship"),
  locationId: z.string().min(1, "Location assignment is required"),
  address: z.string().max(500).optional().default(""),
  phone: z.string().max(20).optional().default(""),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  managerId: z.string().optional().default(""),
  inventoryPoolId: z.string().optional().default(""),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  geofenceRadius: z.coerce.number().min(50).max(1000).default(200),
  country: z.string().optional().default(""),
});

export type RegisterStoreFormValues = z.infer<typeof registerStoreSchema>;

// ─── Props ──────────────────────────────────────────────────────────────────────

interface RegisterStoreDialogProps {
  onSuccess: (store: RetailStore) => void;
  trigger?: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const RegisterStoreDialog: React.FC<RegisterStoreDialogProps> = ({
  onSuccess,
  trigger,
}) => {
  const session = useSession();
  const isAdmin = ["OWNER", "SUPERADMIN", "ADMIN"].includes(session.role || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [locations, setLocations] = useState<
    Array<{ id: string; name: string; code: string; address: string }>
  >([]);
  const [pools, setPools] = useState<Array<{ id: string; name: string }>>([]);
  const [managers, setManagers] = useState<
    Array<{ id: string; fullName: string }>
  >([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [useOfficeAddress, setUseOfficeAddress] = useState(false);

  const form = useForm<RegisterStoreFormValues>({
    resolver: zodResolver(registerStoreSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "flagship",
      locationId: "",
      address: "",
      phone: "",
      email: "",
      managerId: "",
      inventoryPoolId: "",
      latitude: undefined,
      longitude: undefined,
      geofenceRadius: 200,
      country: "",
    },
  });

  const { register, formState: { errors }, handleSubmit, reset, watch, setValue } = form;
  const selectedLocationId = watch("locationId");
  const selectedCountryCode = watch("country");
  const selectedCountry = getCountry(selectedCountryCode || "");

  const loadFormData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const tenantId = session.tenant_id;
      if (!tenantId) return;

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

  // When useOfficeAddress changes, update the address field
  useEffect(() => {
    if (useOfficeAddress && selectedLocationId) {
      const selectedLoc = locations.find((l) => l.id === selectedLocationId);
      setValue("address", selectedLoc?.address || "");
    }
  }, [useOfficeAddress, selectedLocationId, locations, setValue]);

  function handleClose() {
    if (mutation.isPending) return;
    reset();
    setUseOfficeAddress(false);
    setOpen(false);
  }

  const mutation = useMutation({
    mutationFn: (data: RegisterStoreFormValues) =>
      apiRequest<RetailStore>("/v1/retail/stores", "POST", session, {
        name: data.name,
        code: data.code,
        location_id: data.locationId,
        type: data.type,
        address: data.address,
        phone: data.phone || undefined,
        email: data.email || undefined,
        manager_id: data.managerId || undefined,
        inventory_pool_id: data.inventoryPoolId || undefined,
        latitude: data.latitude,
        longitude: data.longitude,
        geofence_radius: data.geofenceRadius,
        country: data.country || undefined,
        currency: selectedCountry?.currency || undefined,
        timezone: "Asia/Jakarta",
      }),
    onSuccess: (created) => {
      toast({
        title: "Success",
        description: "Branch established successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["retail", "stores"] });
      form.reset();
      setUseOfficeAddress(false);
      onSuccess(created);
      setOpen(false);
    },
    onError: (error: unknown) => {
      const apiError = error as { message?: string; data?: { fieldErrors?: Record<string, string> } } | undefined;
      const message = apiError?.message || "Registration failed.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      // Map field errors if available
      const fieldErrors = apiError?.data?.fieldErrors;
      if (fieldErrors && typeof fieldErrors === "object") {
        Object.entries(fieldErrors).forEach(([field, msg]) => {
          if (typeof msg === "string") {
            form.setError(field as keyof RegisterStoreFormValues, { message: msg });
          }
        });
      }
    },
  });

  const isPending = mutation.isPending;
  const onSubmit = handleSubmit((data) => mutation.mutate(data));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-primary font-black italic gap-1"
          >
            <Plus className="w-4 h-4" /> Register New
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-[2rem] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-black italic text-2xl uppercase tracking-tighter text-primary">
            Establishing New Branch
          </DialogTitle>
          <DialogDescription className="font-bold italic">
            Assign unique code and identifiers for the new physical store.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={isPending || isLoadingData} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="reg-store-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Store Name *
                </Label>
                <input
                  id="reg-store-name"
                  type="text"
                  {...register("name")}
                  className="flex h-12 w-full rounded-xl border border-border bg-card px-3 py-2 font-bold italic text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Jakarta South Plaza"
                  autoFocus
                  aria-describedby={errors.name ? "reg-store-name-error" : undefined}
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <p id="reg-store-name-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-store-code" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Unique Code *
                </Label>
                <input
                  id="reg-store-code"
                  type="text"
                  {...register("code")}
                  className="flex h-12 w-full rounded-xl border border-border bg-card px-3 py-2 font-bold italic text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. JK-002"
                  aria-describedby={errors.code ? "reg-store-code-error" : undefined}
                  aria-invalid={!!errors.code}
                />
                {errors.code && (
                  <p id="reg-store-code-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.code.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-store-type" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Store Type
                </Label>
                <select
                  id="reg-store-type"
                  {...register("type")}
                  className="w-full h-12 rounded-xl border border-border px-3 font-bold italic text-sm bg-card"
                >
                  <option value="flagship">Flagship</option>
                  <option value="express">Express</option>
                  <option value="kiosk">Kiosk</option>
                  <option value="pop-up">Pop-Up</option>
                  <option value="warehouse">Warehouse</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-store-phone" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Primary Contact (Phone)
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input
                    id="reg-store-phone"
                    type="tel"
                    {...register("phone")}
                    className="flex h-12 w-full rounded-xl border border-border bg-card pl-10 pr-3 py-2 font-bold italic text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+62 21..."
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="reg-store-email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Contact Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input
                    id="reg-store-email"
                    type="email"
                    {...register("email")}
                    className="flex h-12 w-full rounded-xl border border-border bg-card pl-10 pr-3 py-2 font-bold italic text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="branch@company.com"
                    aria-describedby={errors.email ? "reg-store-email-error" : undefined}
                    aria-invalid={!!errors.email}
                  />
                </div>
                {errors.email && (
                  <p id="reg-store-email-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            {/* Operational & Location */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="reg-store-location" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Location Assignment *
                </Label>
                <select
                  id="reg-store-location"
                  {...register("locationId")}
                  className="w-full h-12 rounded-xl border border-border px-3 font-bold italic text-sm bg-card"
                  aria-describedby={errors.locationId ? "reg-store-location-error" : undefined}
                  aria-invalid={!!errors.locationId}
                >
                  <option value="" disabled>
                    Select HR Location...
                  </option>
                  {(Array.isArray(locations) ? locations : []).map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                  {locations.length === 0 && (
                    <option disabled>No locations found</option>
                  )}
                </select>
                {errors.locationId && (
                  <p id="reg-store-location-error" className="text-[10px] text-destructive font-medium" role="alert">
                    {errors.locationId.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2 pb-1">
                  <Checkbox
                    id="office-address"
                    checked={useOfficeAddress}
                    onCheckedChange={(checked) =>
                      setUseOfficeAddress(checked as boolean)
                    }
                  />
                  <Label
                    htmlFor="office-address"
                    className="text-[10px] font-black uppercase tracking-widest text-primary cursor-pointer"
                  >
                    Same as Office Address
                  </Label>
                </div>
                <Label htmlFor="reg-store-address" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Physical Address
                </Label>
                <textarea
                  id="reg-store-address"
                  {...register("address")}
                  disabled={useOfficeAddress}
                  className="flex min-h-[80px] w-full rounded-xl border border-border bg-card px-3 py-2 font-bold italic text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="Street, City, Building..."
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
                    <Label htmlFor="reg-store-lat" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Latitude</Label>
                    <input
                      id="reg-store-lat"
                      type="number"
                      step="any"
                      {...register("latitude")}
                      placeholder="0.0000"
                      className="flex h-10 w-full rounded-lg border border-border bg-card px-2 font-bold text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="reg-store-lng" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Longitude</Label>
                    <input
                      id="reg-store-lng"
                      type="number"
                      step="any"
                      {...register("longitude")}
                      placeholder="0.0000"
                      className="flex h-10 w-full rounded-lg border border-border bg-card px-2 font-bold text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reg-store-geofence" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Geofence Radius (m)</Label>
                  <input
                    id="reg-store-geofence"
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    {...register("geofenceRadius")}
                    className="w-full h-1.5 bg-primary rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="reg-store-country" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Regulatory Region (Optional)
                </Label>
                <select
                  id="reg-store-country"
                  {...register("country")}
                  className="w-full h-12 rounded-xl border border-border px-3 font-bold italic text-sm bg-card"
                >
                  <option value="">Inherit from Head Office</option>
                  {(Array.isArray(COUNTRIES) ? COUNTRIES : []).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>

                {selectedCountry && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-primary bg-primary/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                      Currency:
                    </span>
                    <span className="text-xs font-bold text-primary">
                      {selectedCountry.currency}
                    </span>
                    <span className="text-[10px] font-medium text-primary/70">
                      ({selectedCountry.symbol})
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="reg-store-manager" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" /> Branch Manager
                </Label>
                <select
                  id="reg-store-manager"
                  {...register("managerId")}
                  className="w-full h-12 rounded-xl border border-border px-3 font-bold italic text-sm bg-card"
                >
                  <option value="">(None assigned)</option>
                  {(Array.isArray(managers) ? managers : []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="reg-store-pool" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <Database className="w-3 h-3" /> Inventory Pool
                </Label>
                <select
                  id="reg-store-pool"
                  {...register("inventoryPoolId")}
                  className="w-full h-12 rounded-xl border border-border px-3 font-bold italic text-sm bg-card"
                >
                  <option value="">Private (Self-managed)</option>
                  {(Array.isArray(pools) ? pools : []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <DialogFooter className="mt-4">
            <Button
              type="submit"
              className="w-full h-14 bg-primary hover:bg-primary text-foreground font-black italic rounded-xl shadow-xl uppercase tracking-widest"
              disabled={isPending || isLoadingData}
            >
              {isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isAdmin ? (
                "Establish Branch"
              ) : (
                "Request Authorization"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
