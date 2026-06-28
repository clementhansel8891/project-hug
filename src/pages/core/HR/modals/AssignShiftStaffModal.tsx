import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { assignShiftStaffSchema, type AssignShiftStaffInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface AssignShiftStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees?: { id: string; fullName: string }[];
  shiftTemplates?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function AssignShiftStaffModal({
  isOpen,
  onClose,
  employees = [],
  shiftTemplates = [],
  onSuccess,
}: AssignShiftStaffModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<AssignShiftStaffInput, unknown>(
    "/v1/hr/roster/assignments",
    "POST",
    ["/v1/hr/roster"]
  );

  const handleSubmit = async (data: AssignShiftStaffInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Staff assigned", description: "Employee has been assigned to the shift." });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={assignShiftStaffSchema}
      defaultValues={{
        employeeId: "",
        shiftTemplateId: "",
        date: new Date().toISOString().slice(0, 10),
        notes: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Assign Staff to Shift"
      isOpen={isOpen}
      description="Assign an employee to a specific shift on a given date."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shiftTemplateId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shift Template *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {shiftTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
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
