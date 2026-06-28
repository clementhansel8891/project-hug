import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { rejectCandidateSchema, type RejectCandidateInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface RejectCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates?: { id: string; name: string }[];
  defaultCandidateId?: string;
  onSuccess?: () => void;
}

export function RejectCandidateModal({
  isOpen,
  onClose,
  candidates = [],
  defaultCandidateId = "",
  onSuccess,
}: RejectCandidateModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<RejectCandidateInput, unknown>(
    "/v1/hr/talent/candidates/reject",
    "POST",
    ["/v1/hr/talent"]
  );

  const handleSubmit = async (data: RejectCandidateInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Candidate rejected", description: "Application has been formally rejected." });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={rejectCandidateSchema}
      defaultValues={{
        candidateId: defaultCandidateId,
        reason: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Reject Application"
      isOpen={isOpen}
      description="Reject a candidate's application with a reason for record."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="candidateId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Candidate *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select candidate" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason for Rejection *</FormLabel>
                <FormControl><Textarea placeholder="Provide a clear reason for rejection" rows={4} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
