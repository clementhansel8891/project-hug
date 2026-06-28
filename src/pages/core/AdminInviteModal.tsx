import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const adminInviteSchema = z.object({
  email: z.string().email("Valid email is required"),
  role: z.enum(["ADMIN", "SUPER_ADMIN", "AUDITOR", "COMPLIANCE_OFFICER"], {
    required_error: "Role is required",
  }),
  justification: z.string().min(5, "Justification must be at least 5 characters").max(500),
  expiresInDays: z.coerce.number().min(1).max(30).default(7),
});

type AdminInviteInput = z.infer<typeof adminInviteSchema>;

interface AdminInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdminInviteModal({
  isOpen,
  onClose,
  onSuccess,
}: AdminInviteModalProps) {
  const { toast } = useToast();

  const mutation = useModuleMutation<AdminInviteInput, unknown>(
    "/v1/admin/invitations",
    "POST",
    ["/v1/admin/invitations"]
  );

  const handleSubmit = async (data: AdminInviteInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: "Invitation sent",
      description: `Admin invitation sent to ${data.email} with ${data.role} role.`,
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={adminInviteSchema}
      defaultValues={{
        email: "",
        role: "ADMIN",
        justification: "",
        expiresInDays: 7,
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Invite Administrator"
      isOpen={isOpen}
      description="Generate a secure magic link invitation for a new platform administrator."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address *</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="admin@company.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    <SelectItem value="AUDITOR">Auditor</SelectItem>
                    <SelectItem value="COMPLIANCE_OFFICER">Compliance Officer</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="justification"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Justification *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Explain the business reason for granting this access..."
                    className="min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="expiresInDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Invitation Expiry (days)</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={30} placeholder="7" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
            <p className="font-medium mb-1">Security Note:</p>
            <p>A time-limited magic link will be generated and sent to the specified email. The invitee must complete onboarding within the expiry period. All invitations are logged in the audit trail.</p>
          </div>
        </div>
      )}
    </ModuleModal>
  );
}
