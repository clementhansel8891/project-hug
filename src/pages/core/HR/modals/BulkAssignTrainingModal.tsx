import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { bulkAssignTrainingSchema, type BulkAssignTrainingInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface BulkAssignTrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  programs?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function BulkAssignTrainingModal({
  isOpen,
  onClose,
  programs = [],
  onSuccess,
}: BulkAssignTrainingModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<BulkAssignTrainingInput, unknown>(
    "/v1/hr/training/bulk-assign",
    "POST",
    ["/v1/hr/training"]
  );

  const handleSubmit = async (data: BulkAssignTrainingInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Training assigned", description: "Training has been bulk-assigned to employees." });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={bulkAssignTrainingSchema}
      defaultValues={{
        employeeIds: "",
        programId: "",
        notes: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Bulk Assign Training"
      isOpen={isOpen}
      description="Assign a training program to multiple employees at once."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="employeeIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee IDs *</FormLabel>
                <FormControl><Input placeholder="Comma-separated employee IDs" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="programId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Training Program *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="Assignment notes" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
