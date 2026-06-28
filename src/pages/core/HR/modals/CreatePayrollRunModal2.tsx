import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { createPayrollRunSchema2, type CreatePayrollRun2Input } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface CreatePayrollRunModal2Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreatePayrollRunModal2({
  isOpen,
  onClose,
  onSuccess,
}: CreatePayrollRunModal2Props) {
  const { toast } = useToast();
  const mutation = useModuleMutation<CreatePayrollRun2Input, unknown>(
    "/v1/hr/payroll/runs",
    "POST",
    ["/v1/hr/payroll"]
  );

  const handleSubmit = async (data: CreatePayrollRun2Input) => {
    await mutation.mutateAsync(data);
    toast({ title: "Payroll run created", description: `Run for ${data.periodStart} to ${data.periodEnd} initiated.` });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={createPayrollRunSchema2}
      defaultValues={{
        periodStart: new Date().toISOString().slice(0, 10),
        periodEnd: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Create Payroll Run"
      isOpen={isOpen}
      description="Start a new payroll calculation cycle for a period."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="periodStart"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period Start *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="periodEnd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period End *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
