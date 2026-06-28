import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { omnichannelConfigSchema, type OmnichannelConfigInput } from "../schemas";
import { toast } from "sonner";

interface OmnichannelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Omnichannel configuration modal.
 *
 * Configures channel routing, auto-reply settings, and assignment rules
 * for the unified inbox communications engine.
 */
export function OmnichannelConfigModal({
  isOpen,
  onClose,
  onSuccess,
}: OmnichannelConfigModalProps) {
  const mutation = useModuleMutation<OmnichannelConfigInput, unknown>(
    "/v1/marketing/omnichannel/config",
    "POST",
    ["/v1/marketing/omnichannel/config"]
  );

  const handleSubmit = async (data: OmnichannelConfigInput) => {
    try {
      await mutation.mutateAsync(data);
      toast.success("Channel configured", {
        description: `${data.channel} routing has been updated.`,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error("Configuration failed", {
        description: err?.message || "An error occurred. Please try again.",
      });
      throw err;
    }
  };

  return (
    <ModuleModal
      schema={omnichannelConfigSchema}
      defaultValues={{
        channel: "WHATSAPP",
        autoReply: false,
        autoReplyMessage: "",
        assignTo: "MANUAL",
        maxConcurrentChats: 10,
        businessHoursOnly: true,
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Omnichannel Configuration"
      isOpen={isOpen}
      description="Configure routing and automation rules for a communication channel."
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="channel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Channel *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="assignTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assignment Strategy *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select strategy" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                    <SelectItem value="MANUAL">Manual</SelectItem>
                    <SelectItem value="AI_ROUTING">AI Routing</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maxConcurrentChats"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Concurrent Chats</FormLabel>
                <FormControl><Input type="number" min={1} max={100} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="autoReply"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal cursor-pointer">Enable auto-reply</FormLabel>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.watch("autoReply") && (
            <FormField
              control={form.control}
              name="autoReplyMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auto-Reply Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Thank you for reaching out. A team member will respond shortly..."
                      className="min-h-[60px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="businessHoursOnly"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal cursor-pointer">Route only during business hours</FormLabel>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
