import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const toolConfigSchema = z.object({
  name: z.string().min(1, "Tool name is required").max(100),
  category: z.enum(["documents", "spreadsheets", "presentations", "calculators", "exports"], {
    required_error: "Category is required",
  }),
  description: z.string().max(500).optional().default(""),
  maxFileSize: z.coerce.number().min(1, "Max file size must be at least 1 MB").default(50),
  isEnabled: z.boolean().default(true),
});

type ToolConfigInput = z.infer<typeof toolConfigSchema>;

interface ToolConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTool?: Partial<ToolConfigInput> & { id?: string };
  onSuccess?: () => void;
}

export function ToolConfigModal({
  isOpen,
  onClose,
  existingTool,
  onSuccess,
}: ToolConfigModalProps) {
  const { toast } = useToast();
  const isEdit = !!existingTool?.id;

  const mutation = useModuleMutation<ToolConfigInput, unknown>(
    isEdit ? `/v1/tools/${existingTool?.id}` : "/v1/tools",
    isEdit ? "PUT" : "POST",
    ["/v1/tools"]
  );

  const handleSubmit = async (data: ToolConfigInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: isEdit ? "Tool updated" : "Tool configured",
      description: `Tool "${data.name}" has been ${isEdit ? "updated" : "added"} successfully.`,
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={toolConfigSchema}
      defaultValues={{
        name: existingTool?.name || "",
        category: existingTool?.category || "documents",
        description: existingTool?.description || "",
        maxFileSize: existingTool?.maxFileSize ?? 50,
        isEnabled: existingTool?.isEnabled ?? true,
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title={isEdit ? "Edit Tool Configuration" : "Configure New Tool"}
      isOpen={isOpen}
      description="Set up tool parameters including category, file limits, and availability."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tool Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Invoice Generator" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="documents">Documents</SelectItem>
                    <SelectItem value="spreadsheets">Spreadsheets</SelectItem>
                    <SelectItem value="presentations">Presentations</SelectItem>
                    <SelectItem value="calculators">Calculators</SelectItem>
                    <SelectItem value="exports">Exports</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Brief description of the tool's purpose..."
                    className="min-h-[60px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maxFileSize"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max File Size (MB)</FormLabel>
                <FormControl>
                  <Input type="number" min={1} placeholder="50" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Enabled</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Make this tool available to users
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
