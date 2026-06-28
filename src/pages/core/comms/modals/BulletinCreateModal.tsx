import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { createBulletinSchema, type CreateBulletinInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface BulletinCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: { id: string; name: string; code: string }[];
  onSuccess?: () => void;
}

/**
 * Bulletin create modal.
 *
 * Posts a new topic or content item to the bulletin board with title,
 * body, and category assignment.
 */
export function BulletinCreateModal({
  isOpen,
  onClose,
  categories,
  onSuccess,
}: BulletinCreateModalProps) {
  const { toast } = useToast();

  const mutation = useModuleMutation<CreateBulletinInput, unknown>(
    "/comms/bulletin",
    "POST",
    ["/comms/bulletin"]
  );

  const handleSubmit = async (data: CreateBulletinInput) => {
    await mutation.mutateAsync(data);
    toast({
      title: "Post published",
      description: "Successfully posted to the bulletin board.",
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={createBulletinSchema}
      defaultValues={{
        title: "",
        body: "",
        category: categories[0]?.code || "general",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Create Bulletin Post"
      description="Publish a new topic or announcement to the board."
      isOpen={isOpen}
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl><Input placeholder="Post title..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.code}>{cat.name}</SelectItem>
                    ))}
                    {categories.length === 0 && (
                      <SelectItem value="general">General</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Write your post content..."
                    className="min-h-[150px]"
                    {...field}
                  />
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
