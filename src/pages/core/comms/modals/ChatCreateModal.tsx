import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { createChatGroupSchema, type CreateChatGroupInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface ChatCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Chat group creation modal.
 *
 * Creates a new chat channel/group with name, type (public/private),
 * and optional description.
 */
export function ChatCreateModal({
  isOpen,
  onClose,
  onSuccess,
}: ChatCreateModalProps) {
  const { toast } = useToast();

  const mutation = useModuleMutation<CreateChatGroupInput, unknown>(
    "/comms/chat/channels",
    "POST",
    ["/comms/chat/channels"]
  );

  const handleSubmit = async (data: CreateChatGroupInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: "Group created",
      description: `"${data.name}" channel is now live.`,
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={createChatGroupSchema}
      defaultValues={{
        name: "",
        type: "PUBLIC",
        description: "",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Create Chat Group"
      description="Initialize a new communication channel for your team."
      isOpen={isOpen}
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Group Name *</FormLabel>
                <FormControl><Input placeholder="e.g. Product Launch Team" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Public</SelectItem>
                    <SelectItem value="PRIVATE">Private</SelectItem>
                  </SelectContent>
                </Select>
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
                  <Textarea placeholder="What is this group for?" className="min-h-[60px]" {...field} />
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
