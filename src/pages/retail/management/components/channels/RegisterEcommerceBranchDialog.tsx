/**
 * RegisterEcommerceBranchDialog — E-commerce branch registration.
 *
 * Wired with React Hook Form + Zod + useMutation + getMutationToastHandlers.
 *
 * Requirements: 1 (Form Fields), 2 (Validation), 3 (API Submission),
 *               4 (Loading State), 5 (Error Handling), 6 (Success Handling),
 *               10 (Consistent Pattern)
 */

import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Globe, RefreshCw, Store, PlusCircle, Link2, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/core/security/session";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { hrService } from "@/core/services/hr/hrService";
import {
  ecommerceHubService,
  type RegisterEcommerceBranchResult,
} from "@/core/services/retail/ecommerceHubService";
import type { EcommercePlatform } from "@/core/types/retail/retail";

// ─── Zod Schema ─────────────────────────────────────────────────────────────────

const registerEcommerceBranchSchema = z.object({
  name: z.string().min(1, "Storefront name is required").max(100),
  platform: z.string().min(1, "Platform is required"),
  domain: z.string().min(1, "Domain is required").max(200),
  code: z.string().max(50).optional(),
  locationId: z.string().min(1, "Anchor location is required"),
  bindChannel: z.boolean().default(true),
});

type RegisterEcommerceBranchFormValues = z.infer<typeof registerEcommerceBranchSchema>;

interface RegisterEcommerceBranchDialogProps {
  /** Called with the newly registered virtual branch after a successful registration. */
  onSuccess?: (branch: RegisterEcommerceBranchResult) => void;
  trigger?: React.ReactNode;
}

const PLATFORMS: Array<{ value: EcommercePlatform; label: string }> = [
  { value: "shopify", label: "Shopify" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "tokopedia", label: "Tokopedia" },
  { value: "shopee", label: "Shopee" },
  { value: "lazada", label: "Lazada" },
  { value: "tiktok", label: "TikTok Shop" },
  { value: "custom", label: "Custom / Headless" },
];

/**
 * Unified entry point for registering e-commerce presence as a virtual branch.
 *
 * This dialog is the single "Register E-Commerce" action across the retail module. It
 * calls {@link ecommerceHubService.registerEcommerceBranch}, which creates a
 * `RetailStore` with `type: "ecommerce"` that participates in the branch hierarchy
 * (rather than a standalone entity that links TO branches). Loading state and
 * success/error feedback are surfaced to the user.
 */
export const RegisterEcommerceBranchDialog: React.FC<
  RegisterEcommerceBranchDialogProps
> = ({ onSuccess, trigger }) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [locations, setLocations] = useState<
    Array<{ id: string; name: string; code: string }>
  >([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // ─── React Hook Form + Zod ────────────────────────────────────────────────────
  const form = useForm<RegisterEcommerceBranchFormValues>({
    resolver: zodResolver(registerEcommerceBranchSchema),
    defaultValues: {
      name: "",
      platform: "shopify",
      domain: "",
      code: "",
      locationId: "",
      bindChannel: true,
    },
  });

  const { register, control, formState: { errors }, handleSubmit, reset } = form;

  const mutation = useMutation({
    mutationFn: async (data: RegisterEcommerceBranchFormValues) => {
      return ecommerceHubService.registerEcommerceBranch(session, {
        name: data.name,
        platform: data.platform,
        domain: data.domain,
        locationId: data.locationId,
        code: data.code || undefined,
        channel: data.bindChannel
          ? {
              name: `${data.name} Channel`,
              type: "OWNED",
              integrationCategory: "PREMADE",
            }
          : undefined,
      });
    },
    onSuccess: (branch) => {
      toast({
        title: "E-Commerce Branch Registered",
        description: `${branch.name || "Branch"} is now a virtual branch in the hierarchy.`,
      });
      queryClient.invalidateQueries({ queryKey: ["retail", "channels"] });
      queryClient.invalidateQueries({ queryKey: ["retail", "stores"] });
      onSuccess?.(branch);
      setOpen(false);
      reset();
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error?.message || "The system could not register the e-commerce branch. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isRegistering = mutation.isPending;

  const loadFormData = React.useCallback(async () => {
    if (!session.tenant_id) return;
    setIsLoadingData(true);
    try {
      const locs = await hrService.listLocations(session.tenant_id, session);
      setLocations(Array.isArray(locs) ? locs : []);
    } catch (err) {
      console.error("Failed to load locations", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [session]);

  useEffect(() => {
    if (open && session.tenant_id) {
      loadFormData();
    }
  }, [open, session.tenant_id, loadFormData]);

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            className="h-10 px-6 rounded-2xl bg-primary text-foreground font-black italic uppercase tracking-widest text-[10px] gap-2 shadow-lg"
            data-testid="register-ecommerce-trigger"
          >
            <Globe className="w-4 h-4" /> Register E-Commerce
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-2xl border-border/50 bg-white shadow-2xl max-w-lg p-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-success via-primary to-chart-5" />

        <DialogHeader className="p-8 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-success/10 rounded-xl text-success">
              <Globe className="w-5 h-5" />
            </div>
            <DialogTitle className="font-black italic text-2xl uppercase tracking-tighter text-muted-foreground">
              Register E-Commerce Branch
            </DialogTitle>
          </div>
          <DialogDescription className="font-bold text-muted-foreground uppercase tracking-widest text-[10px]">
            Add an e-commerce presence as a virtual branch inside the store
            hierarchy.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="px-8 pb-2 space-y-5">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">
              Storefront Name
            </Label>
            <input
              type="text"
              {...register("name")}
              autoFocus
              aria-describedby={errors.name ? "ecom-name-error" : undefined}
              aria-invalid={!!errors.name}
              className="flex h-12 w-full rounded-2xl border border-border bg-secondary/5 px-4 py-2 font-bold italic text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-success/20 focus:border-success transition-all"
              placeholder="e.g. Online Flagship Store"
            />
            {errors.name && (
              <p id="ecom-name-error" className="text-[10px] text-destructive font-medium" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">
                Platform
              </Label>
              <select
                {...register("platform")}
                className="w-full h-12 rounded-2xl border border-border bg-secondary/5 px-4 font-bold italic text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-success/20 focus:border-success transition-all appearance-none cursor-pointer"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              {errors.platform && (
                <p className="text-[10px] text-destructive font-medium" role="alert">
                  {errors.platform.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">
                Branch Code
              </Label>
              <input
                type="text"
                {...register("code")}
                className="flex h-12 w-full rounded-2xl border border-border bg-secondary/5 px-4 py-2 font-bold italic text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-success/20 focus:border-success transition-all"
                placeholder="auto"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">
              Storefront Domain
            </Label>
            <input
              type="text"
              {...register("domain")}
              aria-describedby={errors.domain ? "ecom-domain-error" : undefined}
              aria-invalid={!!errors.domain}
              className="flex h-12 w-full rounded-2xl border border-border bg-secondary/5 px-4 py-2 font-bold italic text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-success/20 focus:border-success transition-all"
              placeholder="e.g. shop.example.com"
            />
            {errors.domain && (
              <p id="ecom-domain-error" className="text-[10px] text-destructive font-medium" role="alert">
                {errors.domain.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5" /> Anchor Location (Hierarchy
              Parent)
            </Label>
            <Controller
              control={control}
              name="locationId"
              render={({ field }) => (
                <select
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  aria-describedby={errors.locationId ? "ecom-location-error" : undefined}
                  aria-invalid={!!errors.locationId}
                  className="w-full h-12 rounded-2xl border border-border bg-secondary/5 px-4 font-bold italic text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-success/20 focus:border-success transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>
                    Select anchor location...
                  </option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} [{loc.code}]
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.locationId && (
              <p id="ecom-location-error" className="text-[10px] text-destructive font-medium" role="alert">
                {errors.locationId.message}
              </p>
            )}
          </div>

          <Controller
            control={control}
            name="bindChannel"
            render={({ field }) => (
              <label className="flex items-center gap-2 cursor-pointer pl-1">
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="w-4 h-4 rounded accent-success"
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Bind a sales channel to this
                  branch
                </span>
              </label>
            )}
          />

          <DialogFooter className="pt-2 pb-8">
            <div className="flex w-full gap-4">
              <Button
                type="button"
                variant="outline"
                disabled={isRegistering}
                onClick={() => { reset(); setOpen(false); }}
                className="flex-1 h-13 rounded-2xl border-border font-black italic uppercase tracking-widest text-[10px] py-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isRegistering || isLoadingData}
                className="flex-[2] h-13 bg-success hover:bg-success/90 text-white font-black italic rounded-2xl uppercase tracking-[0.2em] text-[10px] py-4 group transition-all active:scale-95"
              >
                {isRegistering ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <div className="flex items-center gap-2">
                    Register Virtual Branch
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
