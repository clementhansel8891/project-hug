import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { createIncentivePlanSchema, type CreateIncentivePlanInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface IncentiveConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Incentive Plan configuration modal.
 *
 * Creates a new sales incentive plan with type (percentage/fixed/tiered),
 * value, and active date range.
 */
export function IncentiveConfigModal({
  isOpen,
  onClose,
  onSuccess,
}: IncentiveConfigModalProps) {
  const { toast } = useToast();

  const mutation = useModuleMutation<CreateIncentivePlanInput, unknown>(
    "/v1/sales/incentives/plans",
    "POST",
    ["/v1/sales/incentives/plans", "/v1/sales/dashboard"]
  );

  const handleSubmit = async (data: CreateIncentivePlanInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: "Incentive plan created",
      description: `"${data.name}" protocol is now active.`,
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={createIncentivePlanSchema}
      defaultValues={{
        name: "",
        description: "",
        type: "PERCENTAGE",
        value: 0,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        isActive: true,
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="New Incentive Plan"
      description="Configure a new strategic incentive protocol for the sales team."
      isOpen={isOpen}
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plan Name *</FormLabel>
                <FormControl><Input placeholder="Q4 Revenue Accelerator" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe the incentive structure..." className="min-h-[60px]" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                      <SelectItem value="FIXED">Fixed Amount</SelectItem>
                      <SelectItem value="TIERED">Tiered</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal cursor-pointer">Activate immediately</FormLabel>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
