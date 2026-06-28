import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { assignEmployeePositionSchema, type AssignEmployeePositionInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface AssignEmployeePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees?: { id: string; fullName: string }[];
  positions?: { id: string; title: string }[];
  onSuccess?: () => void;
}

export function AssignEmployeePositionModal({
  isOpen,
  onClose,
  employees = [],
  positions = [],
  onSuccess,
}: AssignEmployeePositionModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<AssignEmployeePositionInput, unknown>(
    "/v1/hr/org/assignments",
    "POST",
    ["/v1/hr/org-structure"]
  );

  const handleSubmit = async (data: AssignEmployeePositionInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Employee assigned", description: "Employee has been assigned to the position." });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={assignEmployeePositionSchema}
      defaultValues={{
        employeeId: "",
        positionId: "",
        effectiveDate: new Date().toISOString().slice(0, 10),
        notes: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Assign Employee to Position"
      isOpen={isOpen}
      description="Link an employee to a defined organizational position."
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
            name="positionId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Position *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {positions.map((pos) => (
                      <SelectItem key={pos.id} value={pos.id}>{pos.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="effectiveDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Effective Date *</FormLabel>
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
