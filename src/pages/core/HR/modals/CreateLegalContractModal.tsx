import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { createLegalContractSchema, type CreateLegalContractInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface CreateLegalContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function CreateLegalContractModal({
  isOpen,
  onClose,
  templates = [],
  onSuccess,
}: CreateLegalContractModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<CreateLegalContractInput, unknown>(
    "/v1/hr/legal/contracts",
    "POST",
    ["/v1/hr/legal"]
  );

  const handleSubmit = async (data: CreateLegalContractInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Contract created", description: `Contract "${data.title}" generated from template.` });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={createLegalContractSchema}
      defaultValues={{
        title: "",
        templateId: templates[0]?.id ?? "",
        notes: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Create Legal Contract"
      isOpen={isOpen}
      description="Generate a new legal contract from a template."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contract Title *</FormLabel>
                <FormControl><Input placeholder="e.g. Employment Agreement" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="templateId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Template *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {templates.map((t) => (
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
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="Contract generation notes" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
