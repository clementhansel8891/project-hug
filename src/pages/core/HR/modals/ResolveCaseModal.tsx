import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { resolveCaseSchema, type ResolveCaseInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface ResolveCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases?: { id: string; title: string }[];
  defaultCaseId?: string;
  onSuccess?: () => void;
}

export function ResolveCaseModal({
  isOpen,
  onClose,
  cases = [],
  defaultCaseId = "",
  onSuccess,
}: ResolveCaseModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<ResolveCaseInput, unknown>(
    "/v1/hr/cases/resolve",
    "POST",
    ["/v1/hr/cases"]
  );

  const handleSubmit = async (data: ResolveCaseInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Case resolved", description: "The HR case has been closed." });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={resolveCaseSchema}
      defaultValues={{
        caseId: defaultCaseId,
        resolution: "",
        status: "resolved",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Resolve Case"
      isOpen={isOpen}
      description="Close an HR case with a resolution summary."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="caseId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Case *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select case" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {cases.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resolution Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="resolution"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resolution Notes *</FormLabel>
                <FormControl><Textarea placeholder="Describe how the case was resolved" rows={4} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
