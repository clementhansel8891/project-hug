import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileArchive,
  XCircle,
  History,
  Trash2,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/core/api/apiClient";

// ─── Zod Schema ────────────────────────────────────────────────────────────────

const importFormSchema = z.object({
  locationId: z.string().optional(),
});

type ImportFormValues = z.infer<typeof importFormSchema>;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpoint: string;
  title: string;
  onSuccess: (data: any) => void;
  type?: "DATA" | "IMAGES";
}

export function ImportDialog({
  open,
  onOpenChange,
  endpoint,
  title,
  onSuccess,
  type = "DATA",
}: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ImportFormValues>({
    resolver: zodResolver(importFormSchema),
    defaultValues: { locationId: "" },
  });

  // Fetch locations for DATA imports
  useEffect(() => {
    if (type === "DATA" && open) {
      apiRequest<any>("/hr/locations", "GET", session)
        .then(data => {
          const locList = Array.isArray(data) ? data : (data as any)?.data || [];
          setLocations(locList);
        })
        .catch(console.error);
    }
  }, [type, open, session]);

  // Poll import job status
  useEffect(() => {
    let interval: any;
    if (jobId && open) {
      interval = setInterval(async () => {
        try {
          const data = await apiRequest<any>(
            `inventory/import/status/${jobId}`,
            "GET",
            session
          );
          setStatus(data);
          if (data.status === "COMPLETED" || data.status === "FAILED") {
            clearInterval(interval);
            if (data.status === "COMPLETED") {
              toast({ title: "Import Completed", description: "Data imported successfully." });
              queryClient.invalidateQueries({ queryKey: ["inventory"] });
              onSuccess(data);
            } else {
              toast({ title: "Import Failed", description: "The import process encountered errors.", variant: "destructive" });
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [jobId, open, session, toast, queryClient, onSuccess]);

  // ─── Upload Mutation ─────────────────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest<any>(endpoint, "POST", session, formData);
    },
    onSuccess: (data) => {
      if (data.success && data.jobId) {
        setJobId(data.jobId);
        toast({ title: "Import Started", description: "Import job started in background." });
      } else if (data.success) {
        toast({ title: "Import Completed", description: data.message || "Import completed." });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        onSuccess(data.data);
        onOpenChange(false);
      } else {
        toast({ title: "Import Failed", description: data.message || "Import initiation failed.", variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Upload Failed", description: error.message || "Failed to upload file.", variant: "destructive" });
    },
  });

  // ─── Abort Mutation ──────────────────────────────────────────────────────────

  const abortMutation = useMutation({
    mutationFn: (id: string) => apiRequest<any>(`inventory/import/jobs/${id}`, "DELETE", session),
    onSuccess: (_data, id) => {
      toast({ title: "Job Aborted", description: "Import job aborted successfully." });
      if (id === jobId) {
        setJobId(null);
        setStatus(null);
      }
    },
    onError: (error: any) => {
      toast({ title: "Abort Failed", description: error.message || "Failed to abort job.", variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = form.handleSubmit((data) => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    if (data.locationId && data.locationId !== "none") {
      formData.append("location_id", data.locationId);
    }

    uploadMutation.mutate(formData);
  });

  const handleAbort = (id: string) => {
    abortMutation.mutate(id);
  };

  const isProcessing = status && (status.status === "PENDING" || status.status === "PROCESSING");
  const isCompleted = status && status.status === "COMPLETED";
  const isFailed = status && status.status === "FAILED";
  const isAborted = status && status.status === "ABORTED";

  const progress = status?.total_items > 0
    ? Math.round((status.processed_items / status.total_items) * 100)
    : isProcessing ? 10 : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (isProcessing) return;
        if (!val) {
          form.reset();
          setFile(null);
        }
        onOpenChange(val);
      }}
    >
      <DialogContent
        className="sm:max-w-[500px] border-none shadow-2xl rounded-[2rem] overflow-hidden bg-white/95 backdrop-blur-xl"
        onPointerDownOutside={(e) => isProcessing && e.preventDefault()}
        onEscapeKeyDown={(e) => isProcessing && e.preventDefault()}
      >
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
            {title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {jobId
              ? `Job ID: ${jobId.slice(0, 8)}...`
              : type === "IMAGES"
                ? "Upload a ZIP archive containing product images (SKU_*.jpg)."
                : "Upload a CSV or Excel file to bulk import inventory."}
          </DialogDescription>
        </DialogHeader>

        {jobId ? (
          <div className="space-y-6 py-6 px-2">
            <div className="flex flex-col items-center justify-center space-y-6 text-center">
              {isProcessing && (
                <div className="w-full space-y-4">
                  <div className="relative h-20 w-20 mx-auto">
                    <Loader2 className="h-20 w-20 animate-spin text-primary opacity-20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">{progress}%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-muted-foreground">
                      {status.status === "PENDING" ? "Queueing Job..." : "Importing Data..."}
                    </p>
                    <p className="text-sm text-muted-foreground font-medium">
                      Processed <span className="text-primary">{status.processed_items}</span> of <span className="text-muted-foreground font-bold">{status.total_items || "?"}</span> records
                    </p>
                  </div>

                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground italic">
                    This may take a few minutes for very large files. You can minimize this and it will continue in the background.
                  </p>
                </div>
              )}

              {isCompleted && (
                <div className="w-full space-y-4 py-4">
                  <div className="h-20 w-20 rounded-full bg-success flex items-center justify-center mx-auto border-4 border-success">
                    <CheckCircle2 className="h-12 w-12 text-success" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-bold text-muted-foreground">Success!</p>
                    <p className="text-muted-foreground font-medium">
                      Imported {status.processed_items} items successfully.
                    </p>
                  </div>
                </div>
              )}

              {isFailed && (
                <div className="w-full space-y-4 py-4">
                  <div className="h-20 w-20 rounded-full bg-destructive flex items-center justify-center mx-auto border-4 border-destructive">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-bold text-destructive">Import Failed</p>
                    <p className="text-muted-foreground font-medium">
                      The process encountered a critical error.
                    </p>
                  </div>
                </div>
              )}

              {isAborted && (
                <div className="w-full space-y-4 py-4">
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto border-4 border-border">
                    <XCircle className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-bold text-muted-foreground">Import Aborted</p>
                    <p className="text-muted-foreground font-medium">
                      The operation was cancelled by user.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {status?.errors && status.errors.length > 0 && (
              <div className="rounded-2xl border bg-destructive p-4">
                <p className="text-sm font-bold text-destructive mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Migration Anomalies Detected ({status.error_count || status.errors.length})
                </p>
                <ScrollArea className="h-40 pr-4">
                  <div className="space-y-2">
                    {status.errors.map((err: any, i: number) => (
                      <div key={i} className="text-[10px] bg-white/80 p-3 rounded-xl border border-destructive shadow-sm text-destructive font-bold leading-tight">
                        <span className="text-muted-foreground uppercase tracking-tighter mr-2">[{err.identifier || "ITEM"}]</span>
                        {err.message || JSON.stringify(err)}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <DialogFooter className="gap-2 pt-4 border-t">
              {isProcessing ? (
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl py-6 font-bold text-destructive hover:bg-destructive"
                    onClick={() => handleAbort(jobId)}
                    disabled={abortMutation.isPending}
                  >
                    {abortMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Abort Sync
                  </Button>
                  <Button
                    className="flex-[2] rounded-xl py-6 font-bold shadow-lg"
                    onClick={() => onOpenChange(false)}
                  >
                    Continue in Background
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl py-6"
                    onClick={() => {
                      setJobId(null);
                      setStatus(null);
                      setFile(null);
                      form.reset();
                    }}
                  >
                    Start New
                  </Button>
                  <Button
                    className="flex-1 rounded-xl py-6 font-bold shadow-lg"
                    onClick={() => onOpenChange(false)}
                  >
                    Finish
                  </Button>
                </>
              )}
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="grid gap-6 py-6">
            <div className="space-y-3">
              <Label className="text-sm font-bold text-muted-foreground ml-1">
                Payload Source
              </Label>
              <div
                className="group border-2 border-dashed border-border rounded-[2rem] p-10 flex flex-col items-center justify-center gap-4 hover:border-primary hover:bg-muted transition-all cursor-pointer relative"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <div className="h-20 w-20 rounded-3xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  {file ? (
                    type === "IMAGES" ? <FileArchive className="h-10 w-10 text-primary" /> : <FileText className="h-10 w-10 text-primary" />
                  ) : (
                    <Upload className="h-10 w-10 text-muted-foreground group-hover:text-primary" />
                  )}
                </div>

                <div className="text-center">
                  {file ? (
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-muted-foreground">{file.name}</p>
                      <p className="text-xs font-medium text-muted-foreground">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to sync
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-muted-foreground">Drop your file here</p>
                      <p className="text-xs text-muted-foreground">
                        {type === "IMAGES" ? "ZIP archive only" : "CSV or XLSX format"}
                      </p>
                    </div>
                  )}
                </div>

                <Input
                  id="file-upload"
                  type="file"
                  accept={type === "IMAGES" ? ".zip" : ".csv, .xlsx"}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {type === "DATA" && (
              <div className="space-y-3">
                <Label className="text-sm font-bold text-muted-foreground ml-1">
                  Destination Location (Optional)
                </Label>
                <Select
                  value={form.watch("locationId") || ""}
                  onValueChange={(val) => form.setValue("locationId", val)}
                >
                  <SelectTrigger className="rounded-xl h-12 bg-muted border-border">
                    <SelectValue placeholder="Default to CSV location or Headquarters" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none">Default to CSV Location</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground ml-1">
                  If selected, this overrides the location specified in the CSV.
                </p>
              </div>
            )}

            <DialogFooter className="pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl px-8"
                onClick={() => onOpenChange(false)}
                disabled={uploadMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl px-10 font-bold shadow-lg shadow-primary/20 h-12"
                disabled={uploadMutation.isPending || !file}
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-5 w-5" />
                )}
                {uploadMutation.isPending ? "Preparing..." : "Begin Migration"}
              </Button>
            </DialogFooter>

            <ActiveJobsList session={session} onSelectJob={(id) => setJobId(id)} onAbort={handleAbort} />
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActiveJobsList({
  session,
  onSelectJob,
  onAbort
}: {
  session: any,
  onSelectJob: (id: string) => void,
  onAbort: (id: string) => void
}) {
  const [jobs, setJobs] = useState<any[]>([]);

  const fetchJobs = async () => {
    try {
      const data = await apiRequest<any[]>("inventory/import/jobs", "GET", session);
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch jobs", err);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [session]);

  if (jobs.length === 0) return null;

  return (
    <div className="space-y-3 pt-4 border-t border-dashed">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <History className="w-3 h-3" /> Recent Activity
        </h4>
        {jobs.some(j => j.status === 'PROCESSING') && (
          <div className="flex items-center space-x-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[10px] font-medium text-primary uppercase">Active</span>
          </div>
        )}
      </div>
      <ScrollArea className="max-h-[250px]">
        <div className="space-y-2 pr-4 pb-2">
          {jobs.map((job) => {
            const progress = job.total_items > 0 ? Math.round((job.processed_items / job.total_items) * 100) : 0;
            const isActive = job.status === 'PROCESSING' || job.status === 'PENDING';
            return (
              <div
                key={job.id}
                className={`group relative bg-muted hover:bg-primary/5 border border-border hover:border-primary/20 rounded-2xl p-4 transition-all duration-300 cursor-pointer overflow-hidden ${isActive ? 'ring-1 ring-primary/20' : ''}`}
              >
                <div className="flex items-start justify-between relative z-10" onClick={() => onSelectJob(job.id)}>
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-white shadow-sm group-hover:scale-110 transition-transform duration-300">
                      {isActive ? (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      ) : job.status === 'COMPLETED' ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : job.status === 'ABORTED' ? (
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground truncate max-w-[180px]">
                        {job.filename}
                      </p>
                      <p className="text-[10px] font-medium text-muted-foreground">
                        {job.created_at && !isNaN(new Date(job.created_at).getTime())
                          ? new Date(job.created_at).toLocaleTimeString()
                          : "Pending"} • {job.status}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    {isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full hover:bg-destructive hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAbort(job.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                    <div>
                      <p className="text-xs font-bold text-muted-foreground">{progress}%</p>
                      <p className="text-[10px] font-medium text-muted-foreground">
                        {job.processed_items} / {job.total_items}
                      </p>
                    </div>
                  </div>
                </div>
                {isActive && (
                  <div className="mt-3 relative h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
