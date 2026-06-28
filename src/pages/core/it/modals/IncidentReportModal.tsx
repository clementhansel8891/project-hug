import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import {
  incidentReportSchema,
  type IncidentReportInput,
  INCIDENT_TYPES,
  INCIDENT_SEVERITY,
} from "../schemas/incidentReport";
import { useToast } from "@/hooks/use-toast";

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function IncidentReportModal({
  isOpen,
  onClose,
  onSuccess,
}: IncidentReportModalProps) {
  const { toast } = useToast();

  const mutation = useModuleMutation<IncidentReportInput, unknown>(
    "/v1/it/incidents",
    "POST",
    ["/v1/it/incidents", "/v1/it/tickets"]
  );

  const handleSubmit = async (data: IncidentReportInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: "Incident reported",
      description: `Incident "${data.title}" has been filed with ${data.severity} severity.`,
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={incidentReportSchema}
      defaultValues={{
        title: "",
        description: "",
        type: "service_outage",
        severity: "MEDIUM",
        affectedSystems: "",
        discoveredAt: new Date().toISOString().slice(0, 16),
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Report Incident"
      isOpen={isOpen}
      description="File a new incident report for infrastructure, security, or service disruption events."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Incident Title *</FormLabel>
                <FormControl>
                  <Input placeholder="Brief description of the incident" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Detailed description of what happened, impact, and any immediate actions taken..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Incident Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INCIDENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      {INCIDENT_SEVERITY.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="affectedSystems"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Affected Systems *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Payment Gateway, Auth Service" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="discoveredAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discovered At *</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
