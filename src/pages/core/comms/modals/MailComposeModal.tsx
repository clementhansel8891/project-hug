import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { useModuleMutation } from "@/hooks/useModuleQuery";
import { composeMailSchema, type ComposeMailInput } from "../schemas";
import { useToast } from "@/hooks/use-toast";

interface MailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  onSuccess?: () => void;
}

/**
 * Mail compose modal.
 *
 * Sends a new email or saves as draft with recipient, subject, and body fields.
 * Validates all addresses and subjects before transmission.
 */
export function MailComposeModal({
  isOpen,
  onClose,
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
  onSuccess,
}: MailComposeModalProps) {
  const { toast } = useToast();

  const mutation = useModuleMutation<{ toAddresses: string[]; subject: string; bodyText: string; status: string }, unknown>(
    "/comms/mail/send",
    "POST",
    ["/comms/mail/messages"]
  );

  const handleSubmit = async (data: ComposeMailInput) => {
    const payload = {
      toAddresses: data.to.split(/[,;]/).map((a) => a.trim()).filter(Boolean),
      subject: data.subject,
      bodyText: data.body || "",
      status: data.status,
    };
    await mutation.mutateAsync(payload);
    toast({
      title: data.status === "draft" ? "Draft saved" : "Mail sent",
      description: data.status === "draft"
        ? "Your draft has been saved."
        : "Mail dispatched successfully.",
    });
    onSuccess?.();
    onClose();
  };

  return (
    <ModuleModal
      schema={composeMailSchema}
      defaultValues={{
        to: defaultTo,
        subject: defaultSubject,
        body: defaultBody,
        status: "sent",
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      title="Compose Mail"
      description="Draft and send secure organizational correspondence."
      isOpen={isOpen}
    >
      {(form) => (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="to"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Recipient(s) *</FormLabel>
                <FormControl>
                  <Input placeholder="address@zenvix.io (comma-separated for multiple)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subject *</FormLabel>
                <FormControl><Input placeholder="Subject of transmission" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Body</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Draft your message here..."
                    className="min-h-[200px]"
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
