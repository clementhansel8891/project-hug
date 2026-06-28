import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { notificationPreferencesSchema, type NotificationPreferencesInput } from "./schemas";
import { useToast } from "@/hooks/use-toast";

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPreferences?: Partial<NotificationPreferencesInput>;
  onSuccess?: () => void;
}

export function NotificationPreferencesModal({
  isOpen,
  onClose,
  currentPreferences,
  onSuccess,
}: NotificationPreferencesModalProps) {
  const { toast } = useToast();

  const mutation = useModuleMutation<NotificationPreferencesInput, unknown>(
    "/v1/settings/notifications",
    "PUT",
    ["/v1/settings/notifications"]
  );

  const handleSubmit = async (data: NotificationPreferencesInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: "Preferences saved",
      description: "Your notification preferences have been updated.",
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={notificationPreferencesSchema}
      defaultValues={{
        emailNotifications: currentPreferences?.emailNotifications ?? true,
        pushNotifications: currentPreferences?.pushNotifications ?? true,
        smsNotifications: currentPreferences?.smsNotifications ?? false,
        digestFrequency: currentPreferences?.digestFrequency || "daily",
        quietHoursStart: currentPreferences?.quietHoursStart || "22:00",
        quietHoursEnd: currentPreferences?.quietHoursEnd || "07:00",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Notification Preferences"
      isOpen={isOpen}
      description="Configure how and when you receive notifications from the platform."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="emailNotifications"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Email Notifications</FormLabel>
                  <p className="text-xs text-muted-foreground">Receive notifications via email</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pushNotifications"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Push Notifications</FormLabel>
                  <p className="text-xs text-muted-foreground">Receive browser push notifications</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="smsNotifications"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>SMS Notifications</FormLabel>
                  <p className="text-xs text-muted-foreground">Receive critical alerts via SMS</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="digestFrequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Digest Frequency *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily Digest</SelectItem>
                    <SelectItem value="weekly">Weekly Summary</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="quietHoursStart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quiet Hours Start</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quietHoursEnd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quiet Hours End</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
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
