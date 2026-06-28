import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { shiftOverrideSchema, type ShiftOverrideInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface ShiftOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees?: { id: string; fullName: string }[];
  defaultEmployeeId?: string;
  defaultDate?: string;
  onSuccess?: () => void;
}

export function ShiftOverrideModal({
  isOpen,
  onClose,
  employees = [],
  defaultEmployeeId = "",
  defaultDate = "",
  onSuccess,
}: ShiftOverrideModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<ShiftOverrideInput, unknown>(
    "/v1/hr/roster/overrides",
    "POST",
    ["/v1/hr/roster"]
  );

  const handleSubmit = async (data: ShiftOverrideInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Override authorized", description: "Emergency shift override has been processed." });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={shiftOverrideSchema}
      defaultValues={{
        employeeId: defaultEmployeeId,
        coveringEmployeeId: "",
        date: defaultDate || new Date().toISOString().slice(0, 10),
        reason: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Emergency Shift Override"
      isOpen={isOpen}
      description="Authorize an emergency shift change bypassing standard workflow."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Original Employee *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Employee leaving shift" /></SelectTrigger>
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
            name="coveringEmployeeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Covering Employee *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select relief professional" /></SelectTrigger>
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
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Operational Reason *</FormLabel>
                <FormControl><Textarea placeholder="e.g. Unscheduled Sick Leave - High Priority" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
