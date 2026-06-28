import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { createShiftTemplateSchema, type CreateShiftTemplateInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface CreateShiftTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function CreateShiftTemplateModal({
  isOpen,
  onClose,
  departments = [],
  onSuccess,
}: CreateShiftTemplateModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<CreateShiftTemplateInput, unknown>(
    "/v1/hr/roster/shift-templates",
    "POST",
    ["/v1/hr/roster"]
  );

  const handleSubmit = async (data: CreateShiftTemplateInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Shift template created", description: `Template "${data.name}" has been defined.` });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={createShiftTemplateSchema}
      defaultValues={{
        name: "",
        startTime: "09:00",
        endTime: "17:00",
        departmentId: "",
        notes: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Create Shift Template"
      isOpen={isOpen}
      description="Define a reusable shift pattern for roster scheduling."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Template Name *</FormLabel>
                <FormControl><Input placeholder="e.g. Morning Shift" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Time *</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Time *</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
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
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="Template description" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
