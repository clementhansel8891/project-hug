import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { editFlowRouteSchema, type EditFlowRouteInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface EditFlowRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  flowId?: string;
  defaultDestinationDept?: string;
  onSuccess?: () => void;
}

export function EditFlowRouteModal({
  isOpen,
  onClose,
  flowId = "",
  defaultDestinationDept = "HR",
  onSuccess,
}: EditFlowRouteModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<EditFlowRouteInput, unknown>(
    `/v1/hr/workflows/${flowId}`,
    "PATCH",
    ["/v1/hr/workflows"]
  );

  const handleSubmit = async (data: EditFlowRouteInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Flow updated", description: "Workflow route has been updated." });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={editFlowRouteSchema}
      defaultValues={{
        destinationDept: defaultDestinationDept,
        notes: "",
        priority: "medium",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Edit Workflow Route"
      isOpen={isOpen}
      description="Modify the routing and priority for an existing workflow."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="destinationDept"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Destination Department *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="FINANCE">Finance</SelectItem>
                    <SelectItem value="LEGAL">Legal</SelectItem>
                    <SelectItem value="OPERATIONS">Operations</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
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
                <FormControl><Textarea placeholder="Update notes" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
