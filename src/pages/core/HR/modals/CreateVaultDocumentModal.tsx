import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { createVaultDocumentSchema, type CreateVaultDocumentInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface CreateVaultDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateVaultDocumentModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateVaultDocumentModalProps) {
  const { toast } = useToast();
  const mutation = useModuleMutation<CreateVaultDocumentInput, unknown>(
    "/v1/hr/documents",
    "POST",
    ["/v1/hr/documents"]
  );

  const handleSubmit = async (data: CreateVaultDocumentInput) => {
    await mutation.mutateAsync(data);
    toast({ title: "Document created", description: `"${data.title}" has been added to the vault.` });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={createVaultDocumentSchema}
      defaultValues={{
        title: "",
        type: "CONTRACT",
        notes: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Create Vault Document"
      isOpen={isOpen}
      description="Add a new document to the secure HR document vault."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Document Title *</FormLabel>
                <FormControl><Input placeholder="e.g. Employment Contract" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Document Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="CONTRACT">Contract</SelectItem>
                    <SelectItem value="VISA_FILE">Visa File</SelectItem>
                    <SelectItem value="POLICY">Policy</SelectItem>
                    <SelectItem value="PAYROLL_EXPORT">Payroll Export</SelectItem>
                    <SelectItem value="KPI_REPORT">KPI Report</SelectItem>
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
                <FormControl><Textarea placeholder="Additional document notes" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
