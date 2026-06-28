import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { apiRequest } from "@/core/api/apiClient";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { getMutationToastHandlers } from "@/lib/modal-helpers";
import { Mail, Percent, ShieldCheck } from "lucide-react";

const invitePartnerSchema = z.object({
  email: z.string().email("Valid email is required"),
  jv_profile_id: z.string().min(1, "JV profile is required"),
  role: z.enum(["NON_OPERATOR", "OPERATOR"]).default("NON_OPERATOR"),
  revenue_share: z.coerce.number().min(0).max(100, "Max 100%"),
  profit_share: z.coerce.number().min(0).max(100, "Max 100%"),
});

type InvitePartnerFormData = z.infer<typeof invitePartnerSchema>;

interface InvitePartnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: any[];
}

export function InvitePartnerDialog({ open, onOpenChange, profiles }: InvitePartnerDialogProps) {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InvitePartnerFormData>({
    resolver: zodResolver(invitePartnerSchema),
    defaultValues: {
      email: "",
      jv_profile_id: "",
      role: "NON_OPERATOR",
      revenue_share: 10,
      profit_share: 10,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: InvitePartnerFormData) =>
      apiRequest("/v1/finance/jv/invite", "POST", session, {
        ...data,
        revenue_share: data.revenue_share,
        profit_share: data.profit_share,
      }),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["finance", "jv-partners"]],
      onClose: () => onOpenChange(false),
      form,
      successTitle: "Invitation Sent",
      successDescription: "Joint Venture invitation has been sent.",
    }),
  });

  const onSubmit = (data: InvitePartnerFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !mutation.isPending) { form.reset(); onOpenChange(false); } }}>
      <DialogContent className="sm:max-w-[425px] glass-morphism border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Mail className="h-5 w-5" />
            Invite JV Partner
          </DialogTitle>
          <DialogDescription>
            Send an invitation to a partner tenant. They will be automatically linked once they accept.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Partner Email</Label>
            <Input 
              id="email" 
              placeholder="admin@partner-tenant.com" 
              {...form.register("email")}
              className="bg-muted0"
              disabled={mutation.isPending}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target JV Profile</Label>
            <Select 
              value={form.watch("jv_profile_id")} 
              onValueChange={v => form.setValue("jv_profile_id", v)}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="bg-muted0">
                <SelectValue placeholder="Select a profile" />
              </SelectTrigger>
              <SelectContent>
                {(Array.isArray(profiles) ? profiles : []).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.jv_profile_id && (
              <p className="text-xs text-destructive">{form.formState.errors.jv_profile_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rev Share %</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number" 
                  className="pl-9 bg-muted0"
                  {...form.register("revenue_share", { valueAsNumber: true })}
                  disabled={mutation.isPending}
                />
              </div>
              {form.formState.errors.revenue_share && (
                <p className="text-xs text-destructive">{form.formState.errors.revenue_share.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Profit Share %</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number" 
                  className="pl-9 bg-muted0"
                  {...form.register("profit_share", { valueAsNumber: true })}
                  disabled={mutation.isPending}
                />
              </div>
              {form.formState.errors.profit_share && (
                <p className="text-xs text-destructive">{form.formState.errors.profit_share.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Operational Role</Label>
            <Select 
              value={form.watch("role")} 
              onValueChange={v => form.setValue("role", v as "NON_OPERATOR" | "OPERATOR")}
              disabled={mutation.isPending}
            >
              <SelectTrigger className="bg-muted0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NON_OPERATOR">Non-Operator (Passive)</SelectItem>
                <SelectItem value="OPERATOR">Co-Operator (Active)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { form.reset(); onOpenChange(false); }} disabled={mutation.isPending}>Cancel</Button>
            <Button 
              type="submit"
              disabled={mutation.isPending}
              className="gap-2 shadow-lg shadow-primary/20"
            >
              <ShieldCheck className="h-4 w-4" />
              {mutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
