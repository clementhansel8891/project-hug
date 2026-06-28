import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { launchCycleSchema, type LaunchCycleInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface LaunchCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycles?: { id: string; name: string }[];
  defaultCycleId?: string;
  onSuccess?: () => void;
}

export function LaunchCycleModal({
  isOpen,
  onClose,
  cycles = [],
  defaultCycleId = "",
  onSuccess,
}: LaunchCycleModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<LaunchCycleInput, unknown>(
    "/v1/hr/performance/cycles/launch",
    "POST",
    ["/v1/hr/performance"]
  );

  const handleSubmit = async (data: LaunchCycleInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Cycle launched", description: "Performance review cycle is now active." });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={launchCycleSchema}
      defaultValues={{
        cycleId: defaultCycleId,
        notes: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Launch Review Cycle"
      isOpen={isOpen}
      description="Activate a review cycle and notify participants."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="cycleId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Review Cycle *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select cycle" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {cycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Launch Notes</FormLabel>
                <FormControl><Textarea placeholder="Notes for the launch notification" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
