import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { channelConfigSchema, type ChannelConfigInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface ChannelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Channel/category configuration modal for bulletin hub.
 *
 * Creates a new channel (category) with name, code, and color for
 * organizing bulletin posts.
 */
export function ChannelConfigModal({
  isOpen,
  onClose,
  onSuccess,
}: ChannelConfigModalProps) {
  const { toast } = useToast();

  const mutation = useModuleMutation<ChannelConfigInput, unknown>(
    "/comms/bulletin-categories",
    "POST",
    ["/comms/bulletin-categories"]
  );

  const handleSubmit = async (data: ChannelConfigInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: "Channel created",
      description: `"${data.name}" channel group is now available.`,
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={channelConfigSchema}
      defaultValues={{
        name: "",
        code: "",
        color: "#6366f1",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Create Channel"
      description="Add a new organizational channel for bulletin posts."
      isOpen={isOpen}
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Channel Name *</FormLabel>
                <FormControl><Input placeholder="e.g. Engineering Updates" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code *</FormLabel>
                <FormControl><Input placeholder="e.g. engineering" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Color</FormLabel>
                <FormControl><Input type="color" {...field} className="h-10 w-20 p-1 cursor-pointer" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </ModuleModal>
  );
}
