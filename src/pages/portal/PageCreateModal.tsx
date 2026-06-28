import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { pageCreateSchema, type PageCreateInput } from "./schemas";
import { useToast } from "@/hooks/use-toast";

interface PageCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentPageId?: string;
  onSuccess?: () => void;
}

export function PageCreateModal({
  isOpen,
  onClose,
  parentPageId = "",
  onSuccess,
}: PageCreateModalProps) {
  const { toast } = useToast();

  const mutation = useModuleMutation<PageCreateInput, unknown>(
    "/v1/portal/pages",
    "POST",
    ["/v1/portal/pages"]
  );

  const handleSubmit = async (data: PageCreateInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: "Page created",
      description: `Portal page "${data.title}" has been created successfully.`,
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={pageCreateSchema}
      defaultValues={{
        title: "",
        slug: "",
        layout: "full-width",
        parentPageId,
        isPublished: false,
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Create Portal Page"
      isOpen={isOpen}
      description="Add a new page to the employee portal. Pages can be nested under parent pages."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Page Title *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Company Policies" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL Slug *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. company-policies" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="layout"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Layout *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select layout" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="full-width">Full Width</SelectItem>
                    <SelectItem value="sidebar">Sidebar</SelectItem>
                    <SelectItem value="centered">Centered</SelectItem>
                    <SelectItem value="dashboard">Dashboard Grid</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="parentPageId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Page (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Parent page ID (leave empty for root)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isPublished"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Publish Immediately</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Make this page visible to portal users right away
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
