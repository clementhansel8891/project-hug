import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { swapShiftSchema, type SwapShiftInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface SwapShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees?: { id: string; fullName: string }[];
  defaultOriginalEmployeeId?: string;
  onSuccess?: () => void;
}

export function SwapShiftModal({
  isOpen,
  onClose,
  employees = [],
  defaultOriginalEmployeeId = "",
  onSuccess,
}: SwapShiftModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<SwapShiftInput, unknown>(
    "/v1/hr/roster/swaps",
    "POST",
    ["/v1/hr/roster"]
  );

  const handleSubmit = async (data: SwapShiftInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Shift swapped", description: "Shift swap has been processed." });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={swapShiftSchema}
      defaultValues={{
        originalEmployeeId: defaultOriginalEmployeeId,
        targetEmployeeId: "",
        date: new Date().toISOString().slice(0, 10),
        reason: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Swap Shift"
      isOpen={isOpen}
      description="Exchange a shift assignment between two employees."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="originalEmployeeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Original Employee *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Employee giving up shift" /></SelectTrigger>
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
            name="targetEmployeeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Employee *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Employee taking shift" /></SelectTrigger>
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
                <FormLabel>Shift Date *</FormLabel>
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
                <FormLabel>Reason *</FormLabel>
                <FormControl><Textarea placeholder="Reason for the swap" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
