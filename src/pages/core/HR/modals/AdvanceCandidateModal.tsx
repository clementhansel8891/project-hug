import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { advanceCandidateSchema, type AdvanceCandidateInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface AdvanceCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates?: { id: string; name: string }[];
  defaultCandidateId?: string;
  onSuccess?: () => void;
}

export function AdvanceCandidateModal({
  isOpen,
  onClose,
  candidates = [],
  defaultCandidateId = "",
  onSuccess,
}: AdvanceCandidateModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<AdvanceCandidateInput, unknown>(
    "/v1/hr/talent/candidates/advance",
    "POST",
    ["/v1/hr/talent"]
  );

  const handleSubmit = async (data: AdvanceCandidateInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Candidate advanced", description: "Candidate has been moved to the next stage." });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={advanceCandidateSchema}
      defaultValues={{
        candidateId: defaultCandidateId,
        notes: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Advance Candidate"
      isOpen={isOpen}
      description="Move a candidate to the next stage in the recruitment pipeline."
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
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="Optional notes for this advancement" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
