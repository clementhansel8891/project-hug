import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { createReviewCycleSchema, type CreateReviewCycleInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface CreateReviewCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateReviewCycleModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateReviewCycleModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<CreateReviewCycleInput, unknown>(
    "/v1/hr/performance/cycles",
    "POST",
    ["/v1/hr/performance"]
  );

  const handleSubmit = async (data: CreateReviewCycleInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Review cycle created", description: `Cycle "${data.name}" has been set up.` });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={createReviewCycleSchema}
      defaultValues={{
        name: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        dueDate: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Create Review Cycle"
      isOpen={isOpen}
      description="Define a new performance review cycle with dates."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cycle Name *</FormLabel>
                <FormControl><Input placeholder="e.g. Q1 2026 Review" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
