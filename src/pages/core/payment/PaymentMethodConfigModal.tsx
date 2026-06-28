import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const paymentMethodConfigSchema = z.object({
  providerName: z.string().min(1, "Provider name is required").max(100),
  providerType: z.enum(["bank_transfer", "card_gateway", "ewallet", "qr_payment", "virtual_account"], {
    required_error: "Provider type is required",
  }),
  apiKeyRef: z.string().min(1, "API key reference is required"),
  maxAmountPerTxn: z.coerce.number().min(1, "Maximum amount must be greater than 0"),
  isEnabled: z.boolean().default(true),
  priorityOrder: z.coerce.number().min(1).max(10).default(5),
});

type PaymentMethodConfigInput = z.infer<typeof paymentMethodConfigSchema>;

interface PaymentMethodConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProvider?: Partial<PaymentMethodConfigInput> & { id?: string };
  onSuccess?: () => void;
}

export function PaymentMethodConfigModal({
  isOpen,
  onClose,
  existingProvider,
  onSuccess,
}: PaymentMethodConfigModalProps) {
  const { toast } = useToast();
  const isEdit = !!existingProvider?.id;

  const mutation = useModuleMutation<PaymentMethodConfigInput, unknown>(
    isEdit ? `/v1/payment/providers/${existingProvider?.id}` : "/v1/payment/providers",
    isEdit ? "PUT" : "POST",
    ["/v1/payment/providers"]
  );

  const handleSubmit = async (data: PaymentMethodConfigInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: isEdit ? "Provider updated" : "Provider configured",
      description: `Payment provider "${data.providerName}" has been ${isEdit ? "updated" : "added"} successfully.`,
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={paymentMethodConfigSchema}
      defaultValues={{
        providerName: existingProvider?.providerName || "",
        providerType: existingProvider?.providerType || "bank_transfer",
        apiKeyRef: existingProvider?.apiKeyRef || "",
        maxAmountPerTxn: existingProvider?.maxAmountPerTxn ?? 100000000,
        isEnabled: existingProvider?.isEnabled ?? true,
        priorityOrder: existingProvider?.priorityOrder ?? 5,
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title={isEdit ? "Edit Payment Provider" : "Add Payment Provider"}
      isOpen={isOpen}
      description="Configure a payment provider for transaction routing and processing."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="providerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provider Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Bank BCA, Stripe, GoPay" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="providerType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provider Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card_gateway">Card Gateway</SelectItem>
                    <SelectItem value="ewallet">E-Wallet</SelectItem>
                    <SelectItem value="qr_payment">QR Payment</SelectItem>
                    <SelectItem value="virtual_account">Virtual Account</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="apiKeyRef"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Key Reference *</FormLabel>
                <FormControl>
                  <Input placeholder="Vault key reference (e.g. vault://payment/bca-api-key)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="maxAmountPerTxn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Amount Per Transaction *</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} placeholder="100000000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priorityOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority Order (1-10)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={10} placeholder="5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="isEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Active</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Enable this provider for transaction routing
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
