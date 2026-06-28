import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { generalSettingsSchema, type GeneralSettingsInput } from "./schemas";
import { useToast } from "@/hooks/use-toast";

interface GeneralSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings?: Partial<GeneralSettingsInput>;
  onSuccess?: () => void;
}

export function GeneralSettingsModal({
  isOpen,
  onClose,
  currentSettings,
  onSuccess,
}: GeneralSettingsModalProps) {
  const { toast } = useToast();

  const mutation = useModuleMutation<GeneralSettingsInput, unknown>(
    "/v1/settings/general",
    "PUT",
    ["/v1/settings/general"]
  );

  const handleSubmit = async (data: GeneralSettingsInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: "Settings updated",
      description: "General settings have been saved successfully.",
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={generalSettingsSchema}
      defaultValues={{
        companyName: currentSettings?.companyName || "",
        timezone: currentSettings?.timezone || "Asia/Jakarta",
        dateFormat: currentSettings?.dateFormat || "DD/MM/YYYY",
        currency: currentSettings?.currency || "IDR",
        fiscalYearStart: currentSettings?.fiscalYearStart || "01",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="General Settings"
      isOpen={isOpen}
      description="Configure organization-wide settings for your tenant."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Your organization name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timezone *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Asia/Jakarta" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="dateFormat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Format *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Currency *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="IDR">IDR - Indonesian Rupiah</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="SGD">SGD - Singapore Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="fiscalYearStart"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fiscal Year Start *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="01">January</SelectItem>
                    <SelectItem value="04">April</SelectItem>
                    <SelectItem value="07">July</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
