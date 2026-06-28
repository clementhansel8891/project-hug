import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { createFlowRouteSchema, type CreateFlowRouteInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface CreateFlowRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateFlowRouteModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateFlowRouteModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<CreateFlowRouteInput, unknown>(
    "/v1/hr/workflows",
    "POST",
    ["/v1/hr/workflows"]
  );

  const handleSubmit = async (data: CreateFlowRouteInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Flow route created", description: `${data.entityType} route to ${data.destinationDept} created.` });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={createFlowRouteSchema}
      defaultValues={{
        entityType: "PAYROLL",
        entityId: "",
        destinationDept: "HR",
        notes: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Create Workflow Route"
      isOpen={isOpen}
      description="Initiate a new structured approval route through FlowGate."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="entityType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Entity Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PAYROLL">Payroll</SelectItem>
                    <SelectItem value="LEAVE">Leave</SelectItem>
                    <SelectItem value="CONTRACT">Contract</SelectItem>
                    <SelectItem value="RECRUITMENT">Recruitment</SelectItem>
                    <SelectItem value="TRAINING">Training</SelectItem>
                    <SelectItem value="PERFORMANCE">Performance</SelectItem>
                    <SelectItem value="CASE">Case</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="entityId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Entity ID *</FormLabel>
                <FormControl><Input placeholder="Entity identifier" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="Additional context for approvers" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
