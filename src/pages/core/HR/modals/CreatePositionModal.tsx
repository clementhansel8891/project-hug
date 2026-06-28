import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { createPositionSchema, type CreatePositionInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface CreatePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments?: { id: string; name: string }[];
  defaultDepartmentId?: string;
  onSuccess?: () => void;
}

export function CreatePositionModal({
  isOpen,
  onClose,
  departments = [],
  defaultDepartmentId = "",
  onSuccess,
}: CreatePositionModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<CreatePositionInput, unknown>(
    "/v1/hr/org/positions",
    "POST",
    ["/v1/hr/org-structure"]
  );

  const handleSubmit = async (data: CreatePositionInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Position created", description: `Position "${data.title}" has been added to the org chart.` });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={createPositionSchema}
      defaultValues={{
        title: "",
        departmentId: defaultDepartmentId,
        level: "mid",
        description: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Create Position"
      isOpen={isOpen}
      description="Define a new position within the organizational structure."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Position Title *</FormLabel>
                <FormControl><Input placeholder="e.g. Senior Developer" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="departmentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Level *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="junior">Junior</SelectItem>
                    <SelectItem value="mid">Mid</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="director">Director</SelectItem>
                  </SelectContent>
                </Select>
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
                <FormControl><Textarea placeholder="Position responsibilities" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
