import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const auditExportSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  module: z.string().optional().default(""),
  severity: z.enum(["ALL", "INFO", "WARN", "CRITICAL"], {
    required_error: "Severity filter is required",
  }),
  format: z.enum(["csv", "json", "pdf"], {
    required_error: "Export format is required",
  }),
  includeMetadata: z.boolean().default(true),
  includeChanges: z.boolean().default(true),
});

type AuditExportInput = z.infer<typeof auditExportSchema>;

interface AuditExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuditExportModal({
  isOpen,
  onClose,
  onSuccess,
}: AuditExportModalProps) {
  const { toast } = useToast();

  const mutation = useModuleMutation<AuditExportInput, unknown>(
    "/v1/audit/export",
    "POST",
    []
  );

  const handleSubmit = async (data: AuditExportInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: "Audit export initiated",
      description: `Audit trail export (${data.format.toUpperCase()}) has been queued for processing.`,
    });
    onSuccess?.();
    onClose();
  };

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <ModuleModal
      schema={auditExportSchema}
      defaultValues={{
        startDate: monthAgo,
        endDate: today,
        module: "",
        severity: "ALL",
        format: "csv",
        includeMetadata: true,
        includeChanges: true,
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Export Audit Trail"
      isOpen={isOpen}
      description="Generate a compliance-ready audit trail report for the selected time range."
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
            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ALL">All Severities</SelectItem>
                      <SelectItem value="INFO">INFO</SelectItem>
                      <SelectItem value="WARN">WARN</SelectItem>
                      <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
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
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="includeMetadata"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Include Metadata</FormLabel>
                  <p className="text-xs text-muted-foreground">Include IP address, user agent, and request context</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="includeChanges"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Include Change Diffs</FormLabel>
                  <p className="text-xs text-muted-foreground">Include before/after snapshots for data changes</p>
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
