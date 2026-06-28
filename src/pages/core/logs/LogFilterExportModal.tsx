import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const logFilterExportSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  level: z.enum(["ALL", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"], {
    required_error: "Log level is required",
  }),
  module: z.string().optional().default(""),
  format: z.enum(["csv", "json", "txt"], {
    required_error: "Export format is required",
  }),
  maxRecords: z.coerce.number().min(1).max(100000).default(10000),
});

type LogFilterExportInput = z.infer<typeof logFilterExportSchema>;

interface LogFilterExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LogFilterExportModal({
  isOpen,
  onClose,
  onSuccess,
}: LogFilterExportModalProps) {
  const { toast } = useToast();

  const mutation = useModuleMutation<LogFilterExportInput, unknown>(
    "/v1/logs/export",
    "POST",
    []
  );

  const handleSubmit = async (data: LogFilterExportInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: "Export initiated",
      description: `Log export (${data.format.toUpperCase()}) has been queued. You will be notified when ready.`,
    });
    onSuccess?.();
    onClose();
  };

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <ModuleModal
      schema={logFilterExportSchema}
      defaultValues={{
        startDate: weekAgo,
        endDate: today,
        level: "ALL",
        module: "",
        format: "csv",
        maxRecords: 10000,
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Export System Logs"
      isOpen={isOpen}
      description="Filter and export system logs for analysis or compliance requirements."
    >
      {(form) => (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
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
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Log Level *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ALL">All Levels</SelectItem>
                      <SelectItem value="DEBUG">DEBUG</SelectItem>
                      <SelectItem value="INFO">INFO</SelectItem>
                      <SelectItem value="WARN">WARN</SelectItem>
                      <SelectItem value="ERROR">ERROR</SelectItem>
                      <SelectItem value="FATAL">FATAL</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="module"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Module (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. hr, finance, retail" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Export Format *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="txt">Plain Text</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxRecords"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Records</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={100000} placeholder="10000" {...field} />
                  </FormControl>
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
