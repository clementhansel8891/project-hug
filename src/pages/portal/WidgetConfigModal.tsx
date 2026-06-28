import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { widgetConfigSchema, type WidgetConfigInput } from "./schemas";
import { useToast } from "@/hooks/use-toast";

interface WidgetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageId?: string;
  existingWidget?: Partial<WidgetConfigInput> & { id?: string };
  onSuccess?: () => void;
}

export function WidgetConfigModal({
  isOpen,
  onClose,
  pageId,
  existingWidget,
  onSuccess,
}: WidgetConfigModalProps) {
  const { toast } = useToast();
  const isEdit = !!existingWidget?.id;

  const mutation = useModuleMutation<WidgetConfigInput, unknown>(
    isEdit ? `/v1/portal/widgets/${existingWidget?.id}` : "/v1/portal/widgets",
    isEdit ? "PUT" : "POST",
    ["/v1/portal/widgets", "/v1/portal/pages"]
  );

  const handleSubmit = async (data: WidgetConfigInput) => {
    await mutation.mutateAsync({ ...data, pageId } as any);
    toast({
      title: isEdit ? "Widget updated" : "Widget added",
      description: `Widget "${data.title}" has been ${isEdit ? "updated" : "configured"} successfully.`,
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={widgetConfigSchema}
      defaultValues={{
        widgetType: existingWidget?.widgetType || "metric",
        title: existingWidget?.title || "",
        dataSource: existingWidget?.dataSource || "",
        refreshInterval: existingWidget?.refreshInterval ?? 30,
        width: existingWidget?.width || "2",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title={isEdit ? "Edit Widget" : "Add Widget"}
      isOpen={isOpen}
      description="Configure a dashboard widget to display data from a specific source."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="widgetType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Widget Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select widget type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="chart">Chart</SelectItem>
                    <SelectItem value="table">Table</SelectItem>
                    <SelectItem value="metric">Metric Card</SelectItem>
                    <SelectItem value="feed">Activity Feed</SelectItem>
                    <SelectItem value="calendar">Calendar</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Widget Title *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Monthly Revenue" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dataSource"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data Source *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. /v1/analytics/revenue" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="refreshInterval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Refresh Interval (seconds)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} placeholder="30" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="width"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Column Width *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select width" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">1 Column (25%)</SelectItem>
                      <SelectItem value="2">2 Columns (50%)</SelectItem>
                      <SelectItem value="3">3 Columns (75%)</SelectItem>
                      <SelectItem value="4">4 Columns (100%)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      )}
    </ModuleModal>
  );
}
