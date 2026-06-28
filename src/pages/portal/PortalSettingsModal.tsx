import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { portalSettingsSchema, type PortalSettingsInput } from "./schemas";
import { useToast } from "@/hooks/use-toast";

interface PortalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings?: Partial<PortalSettingsInput>;
  onSuccess?: () => void;
}

export function PortalSettingsModal({
  isOpen,
  onClose,
  currentSettings,
  onSuccess,
}: PortalSettingsModalProps) {
  const { toast } = useToast();

  const mutation = useModuleMutation<PortalSettingsInput, unknown>(
    "/v1/portal/settings",
    "PUT",
    ["/v1/portal/settings"]
  );

  const handleSubmit = async (data: PortalSettingsInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: "Portal settings updated",
      description: `Portal "${data.portalName}" settings saved successfully.`,
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={portalSettingsSchema}
      defaultValues={{
        portalName: currentSettings?.portalName || "",
        description: currentSettings?.description || "",
        theme: currentSettings?.theme || "auto",
        language: currentSettings?.language || "en",
        isPublic: currentSettings?.isPublic || false,
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Portal Settings"
      isOpen={isOpen}
      description="Configure your employee portal appearance and accessibility preferences."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="portalName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Portal Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Employee Self-Service" {...field} />
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
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Brief description of the portal purpose..."
                    className="min-h-[60px]"
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
              name="theme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Theme *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="auto">Auto (System)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="id">Bahasa Indonesia</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="isPublic"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Public Access</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Allow unauthenticated users to view portal content
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
