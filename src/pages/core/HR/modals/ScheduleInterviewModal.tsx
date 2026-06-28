import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { scheduleInterviewSchema, type ScheduleInterviewInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface ScheduleInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates?: { id: string; name: string }[];
  defaultCandidateId?: string;
  onSuccess?: () => void;
}

export function ScheduleInterviewModal({
  isOpen,
  onClose,
  candidates = [],
  defaultCandidateId = "",
  onSuccess,
}: ScheduleInterviewModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<ScheduleInterviewInput, unknown>(
    "/v1/hr/talent/interviews",
    "POST",
    ["/v1/hr/talent"]
  );

  const handleSubmit = async (data: ScheduleInterviewInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Interview scheduled", description: "The interview has been added to the pipeline." });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={scheduleInterviewSchema}
      defaultValues={{
        candidateId: defaultCandidateId,
        date: new Date().toISOString().slice(0, 10),
        time: "09:00",
        interviewerNotes: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Schedule Interview"
      isOpen={isOpen}
      description="Schedule an interview for a candidate in the talent pipeline."
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
          <div className="grid gap-4 md:grid-cols-2">
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
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time *</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="interviewerNotes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interviewer Notes</FormLabel>
                <FormControl><Textarea placeholder="Interview preparation notes" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
