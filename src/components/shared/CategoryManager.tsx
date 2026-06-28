import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Edit2, Save, X, FolderTree, Loader2 } from "lucide-react";
import { inventoryService } from "@/core/services/inventory/inventoryService";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Zod Schemas ───────────────────────────────────────────────────────────────

const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100, "Name too long"),
});

const editCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100, "Name too long"),
});

type CreateCategoryFormValues = z.infer<typeof createCategorySchema>;
type EditCategoryFormValues = z.infer<typeof editCategorySchema>;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  parent_id?: string;
  icon?: string;
}

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChange?: () => void;
}

export function CategoryManager({ isOpen, onClose, onCategoriesChange }: CategoryManagerProps) {
  const { session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  // ─── Create Form ───────────────────────────────────────────────────────────
  const createForm = useForm<CreateCategoryFormValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: "" },
  });

  // ─── Edit Form ─────────────────────────────────────────────────────────────
  const editForm = useForm<EditCategoryFormValues>({
    resolver: zodResolver(editCategorySchema),
    defaultValues: { name: "" },
  });

  // ─── Query: Fetch Categories ───────────────────────────────────────────────
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["shared", "categories", session?.tenant_id],
    queryFn: () => inventoryService.listCategories(session!.tenant_id, session!),
    enabled: isOpen && !!session?.tenant_id,
  });

  // ─── Mutation: Create Category ─────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryFormValues) =>
      inventoryService.createCategory(session!.tenant_id, session!, { name: data.name }),
    onSuccess: () => {
      toast({ title: "Category Created", description: "New category added successfully." });
      queryClient.invalidateQueries({ queryKey: ["shared", "categories"] });
      createForm.reset();
      onCategoriesChange?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create category.", variant: "destructive" });
    },
  });

  // ─── Mutation: Update Category ─────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditCategoryFormValues }) =>
      inventoryService.updateCategory(session!.tenant_id, session!, id, { name: data.name }),
    onSuccess: () => {
      toast({ title: "Category Updated", description: "Category renamed successfully." });
      queryClient.invalidateQueries({ queryKey: ["shared", "categories"] });
      setEditingId(null);
      editForm.reset();
      onCategoriesChange?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update category.", variant: "destructive" });
    },
  });

  // ─── Mutation: Delete Category ─────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      inventoryService.deleteCategory(session!.tenant_id, session!, id),
    onSuccess: () => {
      toast({ title: "Category Deleted", description: "Category removed successfully." });
      queryClient.invalidateQueries({ queryKey: ["shared", "categories"] });
      onCategoriesChange?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete category.", variant: "destructive" });
    },
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleCreate = createForm.handleSubmit((data) => {
    createMutation.mutate(data);
  });

  const handleUpdate = editForm.handleSubmit((data) => {
    if (!editingId) return;
    updateMutation.mutate({ id: editingId, data });
  });

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    deleteMutation.mutate(id);
  };

  const startEditing = (cat: Category) => {
    setEditingId(cat.id);
    editForm.reset({ name: cat.name });
  };

  const cancelEditing = () => {
    setEditingId(null);
    editForm.reset();
  };

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isPending) { createForm.reset(); onClose(); } }}>
      <DialogContent className="rounded-[3rem] border-border bg-muted backdrop-blur-3xl shadow-2xl sm:max-w-[700px] p-0 overflow-hidden max-h-[85vh]">
        <DialogHeader className="p-10 bg-muted border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-5 text-3xl font-black tracking-tighter text-white uppercase italic leading-none">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-primary text-white shadow-xl shadow-indigo-600/20 border border-border">
                  <FolderTree className="h-7 w-7" />
                </div>
                Category Manager
              </DialogTitle>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground mt-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> CLASSIFICATION_ENGINE_V2
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-2xl hover:bg-muted text-muted-foreground hover:text-white"
              onClick={onClose}
              disabled={isPending}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
          {/* Create Form */}
          <form onSubmit={handleCreate} className="p-8 bg-muted rounded-[2rem] border border-border space-y-6">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Initialize New Node</p>
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-3">
                <Label htmlFor="new-category" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Label Designation</Label>
                <Input
                  id="new-category"
                  placeholder="e.g. RAW_MATERIALS_01"
                  {...createForm.register("name")}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="h-14 rounded-xl bg-muted border-white/5 text-white shadow-inner font-black italic tracking-widest placeholder:text-muted-foreground focus:border-primary transition-all"
                  disabled={createMutation.isPending}
                  aria-describedby={createForm.formState.errors.name ? "create-name-error" : undefined}
                />
                {createForm.formState.errors.name && (
                  <p id="create-name-error" className="text-sm text-destructive ml-2">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="h-14 px-8 rounded-xl bg-card text-muted-foreground font-black italic uppercase tracking-widest text-[10px] hover:bg-muted shadow-2xl transition-all hover:scale-105"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Commit
              </Button>
            </div>
          </form>

          {/* Categories Table */}
          <div className="rounded-[2rem] border border-border bg-muted overflow-hidden shadow-2xl">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent bg-muted">
                  <TableHead className="p-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Node Label</TableHead>
                  <TableHead className="p-6 w-[150px] text-right text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Operation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="text-center py-20">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : categories.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2} className="text-center py-20 text-muted-foreground italic font-black uppercase tracking-widest text-xs">
                      No classification nodes found. Initialization required.
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((cat: Category, i: number) => (
                    <TableRow key={cat.id} className={cn("group hover:bg-muted transition-all duration-300 border-white/5", i === categories.length - 1 && "border-0")}>
                      <TableCell className="p-6">
                        {editingId === cat.id ? (
                          <Input
                            {...editForm.register("name")}
                            className="h-12 rounded-lg bg-muted border-border text-white font-black italic tracking-widest"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                            disabled={updateMutation.isPending}
                            aria-describedby={editForm.formState.errors.name ? "edit-name-error" : undefined}
                          />
                        ) : (
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-primary border border-primary flex items-center justify-center">
                              <FolderTree className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-black text-white italic tracking-tight uppercase text-base">{cat.name}</span>
                          </div>
                        )}
                        {editingId === cat.id && editForm.formState.errors.name && (
                          <p id="edit-name-error" className="text-sm text-destructive mt-1">{editForm.formState.errors.name.message}</p>
                        )}
                      </TableCell>
                      <TableCell className="p-6 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {editingId === cat.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl text-success hover:bg-success"
                                onClick={() => handleUpdate()}
                                disabled={updateMutation.isPending}
                              >
                                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive"
                                onClick={cancelEditing}
                                disabled={updateMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl text-primary hover:bg-primary"
                                onClick={() => startEditing(cat)}
                                disabled={isPending}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl text-destructive hover:text-destructive hover:bg-destructive"
                                onClick={() => handleDelete(cat.id)}
                                disabled={isPending}
                              >
                                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="p-10 bg-muted border-t border-border">
          <Button
            variant="outline"
            className="rounded-xl font-black italic text-[10px] uppercase tracking-widest h-12 px-8 border-border bg-muted text-white hover:bg-muted/10"
            onClick={onClose}
            disabled={isPending}
          >
            Termination Protocol
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
