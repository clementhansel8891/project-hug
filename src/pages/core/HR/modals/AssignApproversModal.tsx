import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { assignApproversSchema, type AssignApproversInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface AssignApproversModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFlowId?: string;
  onSuccess?: () => void;
}

export function AssignApproversModal({
  isOpen,
  onClose,
  defaultFlowId = "",
  onSuccess,
}: AssignApproversModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<AssignApproversInput, unknown>(
    "/v1/hr/workflows/approvers",
    "POST",
    ["/v1/hr/workflows"]
  );

  const handleSubmit = async (data: AssignApproversInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Approvers assigned", description: "Approvers have been linked to the workflow." });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={assignApproversSchema}
      defaultValues={{
        flowId: defaultFlowId,
        approverIds: "",
        notes: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Assign Approvers"
      isOpen={isOpen}
      description="Assign one or more approvers to a workflow route."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="flowId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Flow ID *</FormLabel>
                <FormControl><Input placeholder="Workflow flow ID" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="approverIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Approver IDs *</FormLabel>
                <FormControl><Input placeholder="Comma-separated approver IDs" {...field} /></FormControl>
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
