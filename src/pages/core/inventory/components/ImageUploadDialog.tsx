/**
 * ImageUploadDialog — Upload product images modal.
 *
 * Provides a form interface for uploading images to an inventory item.
 * Uses ModuleModal pattern with Zod validation and TanStack Query mutation.
 * Requirements: 1-6, 10
 */

import { useState, useRef } from "react";
import { ModuleModal } from "@/components/shared/ModuleModal";
import { imageUploadSchema, type ImageUploadInput } from "../schemas";
import { useUploadImage } from "../hooks/useInventoryQueries";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon } from "lucide-react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: string;
  itemName?: string;
  onSuccess?: () => void;
}

export function ImageUploadDialog({
  open,
  onOpenChange,
  itemId = "",
  itemName = "",
  onSuccess,
}: ImageUploadDialogProps) {
  const uploadMutation = useUploadImage(itemId);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (_data: ImageUploadInput) => {
    if (!selectedFile) return;
    await uploadMutation.mutateAsync(selectedFile);
    setSelectedFile(null);
    onSuccess?.();
    onOpenChange(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  return (
    <ModuleModal
      schema={imageUploadSchema}
      defaultValues={{
        item_id: itemId,
        alt_text: "",
        is_primary: false,
      }}
      onSubmit={handleSubmit}
      onCancel={() => {
        setSelectedFile(null);
        onOpenChange(false);
      }}
      title="Upload Image"
      description={itemName ? `Add image for: ${itemName}` : "Upload a product image."}
      isOpen={open}
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="item_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Item ID</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Item identifier" disabled={!!itemId} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <FormLabel>Image File</FormLabel>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {selectedFile ? "Change File" : "Select Image"}
              </Button>
              {selectedFile && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" />
                  {selectedFile.name}
                </span>
              )}
            </div>
            {!selectedFile && (
              <p className="text-xs text-muted-foreground">Select an image file to upload (JPEG, PNG, WebP).</p>
            )}
          </div>

          <FormField
            control={form.control}
            name="alt_text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Alt Text</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Image description for accessibility" />
                </FormControl>
                <FormDescription>Optional description for screen readers.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </ModuleModal>
  );
}

export default ImageUploadDialog;
