import React, { useMemo, useRef, useState, useEffect } from "react";
import type { MouseEvent } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { useSession } from "@/core/security/session";
import { API_BASE_URL } from "@/lib/api-config";
import {
  createFolder,
  listFileSystem,
  listFolders,
  uploadFile,
  deleteFile,
  generateForensicCode,
  moveFile,
  renameFile,
  renameFolder,
  moveToRecycle,
  restoreFromRecycle,
  getToolForFile,
} from "@/core/tools/explorer/service";
import { ExportSettingsDialog, type ExportSettings } from "@/components/shared/ExportSettingsDialog";
import { 
  Folder, 
  FileText, 
  FileSpreadsheet, 
  Presentation, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Trash2,
  Upload,
  Download,
  Settings,
  MoreVertical,
  MoreHorizontal,
  Plus,
  History,
  Briefcase,
  FolderOpen,
  Activity,
  FileSearch,
  Zap,
  RefreshCcw,
  HardDrive,
  Info,
  Edit2,
  Bot,
  User,
  Clock,
  ChevronLeft,
  Search,
  Eye
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import DepartmentWorkspaceLayout from "@/components/layouts/DepartmentWorkspaceLayout";

const SECTIONS = [
  {
    title: "STORAGE",
    items: [
      { id: 'explorer', icon: FolderOpen, label: "Explorer", to: "/core/tools/explorer" },
      { id: 'recycle', icon: Trash2, label: "Recycle Bin", to: "/core/tools/explorer/recycle" },
    ]
  },
  {
    title: "AUDIT",
    items: [
      { id: 'audit', icon: FileSearch, label: "Forensic Scan", to: "/core/tools/explorer/audit" },
      { id: 'settings', icon: Settings, label: "Storage Config", to: "/core/tools/explorer/settings" },
    ]
  }
];

const typeLabel = {
  doc: "Doc",
  sheet: "Sheet",
  slide: "Slide",
  pdf: "PDF",
  image: "Image",
  audio: "Audio",
  video: "Video",
  text: "Text",
  json: "JSON",
} as const;

const formatSafeDate = (d: any) => {
  if (!d) return "N/A";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "N/A";
    return format(date, 'yyyy-MM-dd');
  } catch (e) {
    return "N/A";
  }
};

export default function Explorer() {
  const session = useSession();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [version, setVersion] = useState(0);
  const UI_VERSION = "2.1.0-robust";
  const [activeFolder, setActiveFolder] = useState("root");
  const [history, setHistory] = useState<string[]>(["root"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMoveTarget, setBulkMoveTarget] = useState<string>("root");
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"details" | "grid" | "large">("grid");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [lastClick, setLastClick] = useState<{ id: string; time: number } | null>(null);
  const [sortKey, setSortKey] = useState<"name" | "type" | "folder">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const fileAreaRef = useRef<HTMLDivElement | null>(null);
  const detailsAreaRef = useRef<HTMLDivElement | null>(null);

  const [files, setFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [allFolders, setAllFolders] = useState<any[]>([]);
  const [currentFolder, setCurrentFolder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<"none" | "company" | "department">("none");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFileSystem = async () => {
    setLoading(true);
    try {
      if (activeFolder === "recycle") {
        const recycleData = await listRecycleBin(session);
        setFiles(recycleData.files);
        setFolders(recycleData.folders);
        const foldersData = await listFolders(session);
        setAllFolders(foldersData);
        setCurrentFolder({ id: "recycle", name: "Recycle Bin" });
      } else {
        const [fsData, foldersData] = await Promise.all([
          listFileSystem(session, activeFolder === "root" ? undefined : activeFolder),
          listFolders(session)
        ]);
        
        setFiles(fsData.files);
        setFolders(fsData.folders);
        setAllFolders(foldersData);
        setCurrentFolder(fsData.currentFolder || null);
      }
    } catch (err) {
      console.error("Failed to fetch file system", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFileSystem();
  }, [activeFolder, version, session]);

  const selectedFile = useMemo(
    () => files.find((file) => file.id === selectedFileId) ?? null,
    [files, selectedFileId],
  );

  const subfolders = useMemo(
    () => (Array.isArray(folders) ? folders : []).filter((folder) => (folder.parentId ?? "root") === activeFolder),
    [folders, activeFolder],
  );

  const folderMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set("root", "Root");
    allFolders.forEach((folder) => map.set(folder.id, folder.name));
    return map;
  }, [allFolders]);

  const folderById = useMemo(() => {
    const map = new Map<string, (typeof allFolders)[number]>();
    allFolders.forEach((folder) => map.set(folder.id, folder));
    return map;
  }, [allFolders]);

  const orderedFiles = useMemo(() => {
    const filtered = search 
      ? (Array.isArray(files) ? files : []).filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
      : files;

    const sorted = [...filtered].sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (sortKey === "name") return nameA.localeCompare(nameB);
      if (sortKey === "type") return a.type.toLowerCase().localeCompare(b.type.toLowerCase());
      return 0;
    });
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [files, search, sortKey, sortDir]);

  const groupedFiles = useMemo(() => {
    if (groupBy === "none") return { "Files": orderedFiles };
    const groups: Record<string, any[]> = {};
    orderedFiles.forEach(file => {
      const key = groupBy === "company" 
        ? (file.company_id || "Global") 
        : (file.department_id || "Unassigned");
      if (!groups[key]) groups[key] = [];
      groups[key].push(file);
    });
    return groups;
  }, [orderedFiles, groupBy]);

  const orderedFolders = useMemo(
    () => [...folders].sort((a, b) => a.name.localeCompare(b.name)),
    [folders],
  );

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;
  const isRecycleView = activeFolder === "recycle";
  const showRecycleEntry = activeFolder === "root";

  const currentBreadcrumb = useMemo(() => {
    if (activeFolder === "recycle") {
      return [
        { id: "root", label: "Root" },
        { id: "recycle", label: "Recycle Bin" },
      ];
    }
    if (activeFolder === "root") return [{ id: "root", label: "Root" }];
    const path: { id: string; label: string }[] = [];
    let currentId: string | undefined = activeFolder;
    while (currentId && currentId !== "root") {
      const current = folderById.get(currentId);
      if (!current) break;
      path.unshift({ id: current.id, label: current.name });
      currentId = current.parentId ?? "root";
    }
    return [{ id: "root", label: "Root" }, ...path];
  }, [activeFolder, folderById]);

  const folderTree = useMemo(() => {
    const grouped: Record<string, typeof allFolders> = {};
    // Deduplicate folders by name within same parent to avoid UI clutter
    // Also explicitly filter out deleted folders for defense-in-depth
    const uniqueFolders = (Array.isArray(allFolders) ? allFolders : []).filter((f, i, self) => 
      !f.deletedAt && !f.deleted_at && 
      i === self.findIndex(t => t.name === f.name && t.parentId === f.parentId)
    );
    uniqueFolders.forEach((folder) => {
      const parent = folder.parentId ?? "root";
      if (!grouped[parent]) grouped[parent] = [];
      grouped[parent].push(folder);
    });
    return grouped;
  }, [allFolders]);

  const iconForFile = (type: string, size: "sm" | "lg") => {
    const className = size === "lg" ? "h-6 w-6" : "h-4 w-4";
    if (type === "doc") return <FileText className={className} />;
    if (type === "sheet") return <FileSpreadsheet className={className} />;
    if (type === "slide") return <Presentation className={className} />;
    return <File className={className} />;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await uploadFile(
        session,
        file,
        activeFolder === "root" ? undefined : activeFolder
      );
      setVersion(v => v + 1);
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  const handleCreateFolder = async () => {
    const newFolderName = prompt("Folder Name:") || "New Folder";
    try {
      await createFolder(session, newFolderName, activeFolder === "root" ? undefined : activeFolder);
      setVersion(v => v + 1);
    } catch (err) {
      console.error("Folder creation failed", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    try {
      await deleteFile(session, id);
      setVersion(v => v + 1);
    } catch (err) {
      console.error("Deletion failed", err);
    }
  };

  const handleExport = async (settings: ExportSettings) => {
    if (!selectedFile) return;
    try {
      // 1. Generate Forensic Code
      const code = await generateForensicCode(session);
      
      // 2. Trigger Export with settings
      const query = new URLSearchParams({
        watermarkText: settings.watermarkText,
        opacity: settings.opacity.toString(),
        size: settings.size.toString(),
        x: settings.position.x.toString(),
        y: settings.position.y.toString(),
        traceId: code
      }).toString();

      const url = `${API_BASE_URL}/explorer/files/${selectedFile.id}/download?${query}`;
      window.open(url, '_blank');
      setExportDialogOpen(false);
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const toggleSelect = (fileId: string) => {
    setSelectedIds((prev) =>
      prev.includes(fileId) ? (Array.isArray(prev) ? prev : []).filter((id) => id !== fileId) : [...prev, fileId],
    );
  };

  const handleSelection = (fileId: string, index: number, event: MouseEvent) => {
    const isCtrl = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;

    if (isShift && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = orderedFiles.slice(start, end + 1).map((file) => file.id);
      setSelectedIds(rangeIds);
      setSelectedFileId(fileId);
      return;
    }

    if (isCtrl) {
      toggleSelect(fileId);
      setSelectedFileId(fileId);
      setLastSelectedIndex(index);
      return;
    }

    setSelectedIds([fileId]);
    setSelectedFileId(fileId);
    setLastSelectedIndex(index);
  };

  const navigateToFolder = (folderId: string, push = true) => {
    setActiveFolder(folderId);
    setSelectedFileId(null);
    setSelectedIds([]);
    if (!push) return;
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      if (next[next.length - 1] !== folderId) next.push(folderId);
      setHistoryIndex(next.length - 1);
      return next;
    });
  };

  const goBack = () => {
    if (!canGoBack) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    navigateToFolder(history[nextIndex], false);
  };

  const goForward = () => {
    if (!canGoForward) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    navigateToFolder(history[nextIndex], false);
  };

  const handleSort = (key: "name" | "type" | "folder") => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleExpand = (folderId: string) => {
    setExpanded((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const renderFolderNode = (folderId: string, depth: number): JSX.Element | null => {
    const children = folderTree[folderId] ?? [];
    if (children.length === 0) return null;
    return (
      <div>
        {(Array.isArray(children) ? children : []).map((folder) => {
          const isExpanded = expanded[folder.id];
          return (
            <div key={folder.id}>
              <div
                className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${
                  activeFolder === folder.id ? "bg-muted" : "hover:bg-muted/50"
                }`}
                style={{ paddingLeft: `${depth * 12}px` }}
                draggable
                onClick={() => navigateToFolder(folder.id)}
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/x-folder", folder.id);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const folderPayload = event.dataTransfer.getData("application/x-folder");
                  if (folderPayload && folderPayload !== folder.id) {
                    moveFolder(session.tenant_id, session, folderPayload, folder.id);
                    setVersion((prev) => prev + 1);
                    return;
                  }
                  const payload = event.dataTransfer.getData("text/plain");
                  if (payload) handleDrop(payload, folder.id);
                }}
              >
                <button
                  className="flex items-center"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleExpand(folder.id);
                  }}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <Folder className="h-4 w-4" />
                <span className="flex-1 truncate">{folder.name}</span>
                <button
                  className="p-1 hover:bg-muted rounded text-muted-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    setRenameFolderId(folder.id);
                    setRenameFolderValue(folder.name);
                  }}
                  title="Rename folder"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              </div>
              {isExpanded ? renderFolderNode(folder.id, depth + 1) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-sm"
        onClick={handleCreateFolder}
      >
        <Plus className="mr-2 h-4 w-4" />
        New Folder
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-sm"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mr-2 h-4 w-4" />
        Upload
      </Button>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleUpload}
      />
    </div>
  );

  return (
    <DepartmentWorkspaceLayout
      title="File Explorer"
      subtitle="Secure departmental file management with forensic audit scanning."
      headerIcon={FolderOpen}
      accentColor="blue"
      engineName="STORAGE_ENGINE"
      pulseLabel="System Storage"
      pulseIcon={Zap}
      sections={SECTIONS}
      routeLabels={{}}
      basePath="/core/tools/explorer"
      headerActions={headerActions}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr] p-6">
        <WorkspacePanel title="FOLDERS" description="Departmental hierarchy structure.">
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto pr-2 custom-scrollbar">
                <div
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                    activeFolder === "root" ? "bg-primary/10 text-primary shadow-sm" : "hover:bg-muted/50 text-muted-foreground/70"
                  )}
                  onClick={() => navigateToFolder("root")}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    const folderPayload = event.dataTransfer.getData("application/x-folder");
                    if (folderPayload && folderPayload !== "root") {
                      moveFolder(session, folderPayload, undefined);
                      setVersion((prev) => prev + 1);
                      return;
                    }
                    const payload = event.dataTransfer.getData("text/plain");
                    if (payload) handleDrop(payload, "root");
                  }}
                >
                  <button
                    className="flex items-center"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleExpand("root");
                    }}
                  >
                    {expanded.root ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  <Folder className="h-3.5 w-3.5" />
                  ROOT_TERMINAL
                </div>
                {expanded.root ? renderFolderNode("root", 1) : null}
                
                <div className="my-4 border-t border-dashed border-muted" />

                <div
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                    activeFolder === "recycle" ? "bg-destructive text-destructive shadow-sm" : "hover:bg-muted/50 text-muted-foreground/70"
                  )}
                  onClick={() => navigateToFolder("recycle")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  RECYCLE_VAULT
                </div>

                {renameFolderId ? (
                  <div className="space-y-2 mt-4 p-3 border rounded-2xl bg-muted/20 backdrop-blur-sm">
                    <Input
                      value={renameFolderValue}
                      onChange={(event) => setRenameFolderValue(event.target.value)}
                      placeholder="NEW_IDENTITY..."
                      className="h-8 text-[10px] font-black uppercase tracking-widest"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 rounded-lg font-black text-[9px] uppercase tracking-widest"
                        onClick={() => {
                          renameFolder(session, renameFolderId, renameFolderValue);
                          setRenameFolderId(null);
                          setRenameFolderValue("");
                          setVersion((prev) => prev + 1);
                        }}
                      >
                        SAVE
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-lg font-black text-[9px] uppercase tracking-widest" onClick={() => setRenameFolderId(null)}>CANCEL</Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </WorkspacePanel>

        <div className="space-y-6">
          <WorkspacePanel title="ADDRESS_PROTOCOLS" description="Real-time terminal path and forensic search engine.">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors" disabled={!canGoBack} onClick={goBack}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors" disabled={!canGoForward} onClick={goForward}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-1 items-center gap-2 rounded-2xl border bg-background/50 backdrop-blur-md px-4 py-2 min-w-0 shadow-sm ring-1 ring-primary/5">
                <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
                  {(Array.isArray(currentBreadcrumb) ? currentBreadcrumb : []).map((crumb, index) => (
                    <React.Fragment key={`${crumb.id}-${index}`}>
                      <button
                        className={cn(
                          "text-xs font-black transition-all truncate max-w-[150px] uppercase tracking-widest",
                          index === currentBreadcrumb.length - 1 ? "text-primary" : "text-muted-foreground/60 hover:text-primary"
                        )}
                        onClick={() => navigateToFolder(crumb.id)}
                      >
                        {crumb.label}
                      </button>
                      {index < currentBreadcrumb.length - 1 ? (
                        <ChevronRight className="h-3 w-3 text-muted-foreground/20" />
                      ) : null}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="relative flex-1 min-w-[300px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="SEARCH ENGINE: SCAN BY IDENTITY..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-11 h-10 rounded-2xl bg-background/50 backdrop-blur-md border-primary/10 focus:border-primary/30 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm"
                />
              </div>
            </div>
          </WorkspacePanel>

          <WorkspacePanel 
            title={activeFolder === "recycle" ? "RECYCLE_BIN_VAULT" : (folderMap.get(activeFolder) || "FILE_REPOSITORY").toUpperCase()} 
            description={activeFolder === "recycle" ? "Isolated deleted entities awaiting terminal disposal or restoration." : "Verified departmental assets within current terminal scope."}
          >
            <div className="h-[calc(100vh-320px)] overflow-y-auto pr-2 custom-scrollbar">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={viewMode === "details" ? "default" : "outline"}
                    onClick={() => setViewMode("details")}
                  >
                    Details
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "grid" ? "default" : "outline"}
                    onClick={() => setViewMode("grid")}
                  >
                    Grid
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "large" ? "default" : "outline"}
                    onClick={() => setViewMode("large")}
                  >
                    Large Icons
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Group by:</span>
                  <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
                    <SelectTrigger className="w-[120px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="department">Department</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {activeFolder !== "recycle" ? (
                  <>
                    <Select value={bulkMoveTarget} onValueChange={setBulkMoveTarget}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Move to folder" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="root">Root</SelectItem>
                        {(Array.isArray(allFolders) ? allFolders : []).map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            {folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedIds.length === 0}
                      onClick={() => {
                        selectedIds.forEach((id) => moveFile(session, id, bulkMoveTarget));
                        setSelectedIds([]);
                        setVersion((prev) => prev + 1);
                      }}
                    >
                      Move selected
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedIds.length === 0}
                      onClick={() => {
                        selectedIds.forEach((id) => moveToRecycle(session, id));
                        setSelectedIds([]);
                        setVersion((prev) => prev + 1);
                      }}
                    >
                      Delete selected
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selectedIds.length === 0}
                    onClick={() => {
                      selectedIds.forEach((id) => restoreFromRecycle(session, id));
                      setSelectedIds([]);
                      setVersion((prev) => prev + 1);
                    }}
                  >
                    Restore selected
                  </Button>
                )}
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedFile}
                    onClick={() => setExportDialogOpen(true)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Secure Export
                  </Button>
                </div>
              </div>
            
            <ExportSettingsDialog
              open={exportDialogOpen}
              onOpenChange={setExportDialogOpen}
              onConfirm={handleExport}
            />
            {orderedFiles.length === 0 && orderedFolders.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No files found.
              </div>
            ) : viewMode === "details" ? (
              <div
                ref={detailsAreaRef}
                className="relative rounded-lg border overflow-x-auto"
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  const target = event.target as HTMLElement;
                  if (target.closest("[data-file-id]")) return;
                  const bounds = detailsAreaRef.current?.getBoundingClientRect();
                  if (!bounds) return;
                  setMarquee({
                    startX: event.clientX - bounds.left,
                    startY: event.clientY - bounds.top,
                    x: event.clientX - bounds.left,
                    y: event.clientY - bounds.top,
                    active: true,
                  });
                  setSelectedIds([]);
                  setSelectedFileId(null);
                }}
                onMouseMove={(event) => {
                  if (!marquee?.active) return;
                  const bounds = detailsAreaRef.current?.getBoundingClientRect();
                  if (!bounds) return;
                  setMarquee((prev) =>
                    prev
                      ? {
                          ...prev,
                          x: event.clientX - bounds.left,
                          y: event.clientY - bounds.top,
                        }
                      : prev,
                  );
                }}
                onMouseUp={() => {
                  if (!marquee?.active) return;
                  const bounds = detailsAreaRef.current?.getBoundingClientRect();
                  if (!bounds) return;
                  const left = Math.min(marquee.startX, marquee.x);
                  const right = Math.max(marquee.startX, marquee.x);
                  const top = Math.min(marquee.startY, marquee.y);
                  const bottom = Math.max(marquee.startY, marquee.y);
                  const nodes = detailsAreaRef.current?.querySelectorAll("[data-file-id]") ?? [];
                  const hits: string[] = [];
                  nodes.forEach((node) => {
                    const rect = node.getBoundingClientRect();
                    const nodeLeft = rect.left - bounds.left;
                    const nodeRight = rect.right - bounds.left;
                    const nodeTop = rect.top - bounds.top;
                    const nodeBottom = rect.bottom - bounds.top;
                    const intersects =
                      nodeLeft < right && nodeRight > left && nodeTop < bottom && nodeBottom > top;
                    if (intersects) {
                      const id = (node as HTMLElement).dataset.fileId;
                      if (id) hits.push(id);
                    }
                  });
                  setSelectedIds(hits);
                  setSelectedFileId(hits[0] ?? null);
                  setMarquee(null);
                }}
                onMouseLeave={() => {
                  if (marquee?.active) setMarquee(null);
                }}
              >
                {marquee?.active ? (
                  <div
                    className="pointer-events-none absolute z-10 border border-primary/70 bg-primary/10"
                    style={{
                      left: Math.min(marquee.startX, marquee.x),
                      top: Math.min(marquee.startY, marquee.y),
                      width: Math.abs(marquee.x - marquee.startX),
                      height: Math.abs(marquee.y - marquee.startY),
                    }}
                  />
                ) : null}
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="p-2 text-left">
                        <button
                          className="flex items-center gap-2 font-semibold"
                          onClick={() => handleSort("name")}
                        >
                          Name
                          {sortKey === "name" ? (sortDir === "asc" ? "▲" : "▼") : null}
                        </button>
                      </th>
                      <th className="p-2 text-left">
                        <button
                          className="flex items-center gap-2 font-semibold"
                          onClick={() => handleSort("type")}
                        >
                          Type
                          {sortKey === "type" ? (sortDir === "asc" ? "▲" : "▼") : null}
                        </button>
                      </th>
                      <th className="p-2 text-left">
                        <button
                          className="flex items-center gap-2 font-semibold"
                          onClick={() => handleSort("folder")}
                        >
                          Folder
                          {sortKey === "folder" ? (sortDir === "asc" ? "▲" : "▼") : null}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {showRecycleEntry ? (
                      <tr
                        className="cursor-pointer border-t hover:bg-muted/20"
                        onClick={() => navigateToFolder("recycle")}
                      >
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4" />
                            <span className="font-medium">Recycle Bin</span>
                          </div>
                        </td>
                        <td className="p-2 text-muted-foreground">System</td>
                        <td className="p-2">Root</td>
                      </tr>
                    ) : null}
                    {(Array.isArray(orderedFolders) ? orderedFolders : []).map((folder) => (
                      <tr
                        key={folder.id}
                        className="cursor-pointer border-t hover:bg-muted/20"
                        onClick={() => navigateToFolder(folder.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          const folderPayload = event.dataTransfer.getData("application/x-folder");
                          if (folderPayload && folderPayload !== folder.id) {
                            moveFolder(session.tenant_id, session, folderPayload, folder.id);
                            setVersion((prev) => prev + 1);
                            return;
                          }
                          const payload = event.dataTransfer.getData("text/plain");
                          if (payload) handleDrop(payload, folder.id);
                        }}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("application/x-folder", folder.id);
                        }}
                      >
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4" />
                            <span className="font-medium">{folder.name}</span>
                          </div>
                        </td>
                        <td className="p-2 text-muted-foreground">Folder</td>
                        <td className="p-2">{folderMap.get(folder.parentId ?? "root") ?? "Root"}</td>
                      </tr>
                    ))}
                    {(Array.isArray(orderedFiles) ? orderedFiles : []).map((file, index) => (
                      <ContextMenu key={file.id}>
                        <ContextMenuTrigger asChild>
                          <tr
                            data-file-id={file.id}
                            draggable
                            onDragStart={(event) => {
                              const payload = selectedIds.includes(file.id)
                                ? JSON.stringify(selectedIds)
                                : JSON.stringify([file.id]);
                              event.dataTransfer.setData("text/plain", payload);
                            }}
                            onClick={(event) => {
                              const now = Date.now();
                              if (lastClick?.id === file.id && now - lastClick.time < 600) {
                                const tool = getToolForFile(file);
                                if (tool !== "none") {
                                  navigate(`/core/tools/${tool}?fileId=${file.id}`);
                                } else {
                                  setSelectedFileId(file.id);
                                  setPreviewOpen(true);
                                }
                              } else {
                                handleSelection(file.id, index, event);
                                setSelectedFileId(file.id);
                              }
                              setLastClick({ id: file.id, time: now });
                            }}
                            className={`cursor-pointer border-t ${
                              selectedIds.includes(file.id) ? "bg-muted/40" : "hover:bg-muted/20"
                            }`}
                          >
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(file.id)}
                                  onChange={() => toggleSelect(file.id)}
                                  onClick={(event) => event.stopPropagation()}
                                />
                                {iconForFile(file.type, "sm")}
                                {editingId === file.id ? (
                                  <Input
                                    value={editingValue}
                                    onChange={(event) => setEditingValue(event.target.value)}
                                    onBlur={() => {
                                      renameFile(session.tenant_id, session, file.id, editingValue);
                                      setEditingId(null);
                                      setVersion((prev) => prev + 1);
                                    }}
                                  />
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="truncate max-w-[200px] block">{file.name}</span>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-muted border-border text-white font-bold italic">
                                        {file.name}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </td>
                            <td className="p-2">{typeLabel[file.type]}</td>
                            <td className="p-2">{folderMap.get(file.folderId ?? "root") ?? "Root"}</td>
                          </tr>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => {
                              setSelectedFileId(file.id);
                              setPreviewOpen(true);
                            }}
                          >
                            Preview
                          </ContextMenuItem>
                          {isRecycleView ? (
                            <>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => {
                                  restoreFromRecycle(session.tenant_id, session, file.id);
                                  setVersion((prev) => prev + 1);
                                }}
                              >
                                Restore
                              </ContextMenuItem>
                            </>
                          ) : (
                            <>
                              <ContextMenuItem onClick={() => {
                                setEditingId(file.id);
                                setEditingValue(file.name);
                              }}>
                                Rename
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => {
                                  moveToRecycle(session.tenant_id, session, file.id);
                                  setVersion((prev) => prev + 1);
                                }}
                              >
                                Delete
                              </ContextMenuItem>
                            </>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                ref={fileAreaRef}
                className={`relative grid gap-2 ${
                  viewMode === "large" ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3"
                }`}
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  const target = event.target as HTMLElement;
                  if (target.closest("[data-file-id]")) return;
                  const bounds = fileAreaRef.current?.getBoundingClientRect();
                  if (!bounds) return;
                  setMarquee({
                    startX: event.clientX - bounds.left,
                    startY: event.clientY - bounds.top,
                    x: event.clientX - bounds.left,
                    y: event.clientY - bounds.top,
                    active: true,
                  });
                  setSelectedIds([]);
                  setSelectedFileId(null);
                }}
                onMouseMove={(event) => {
                  if (!marquee?.active) return;
                  const bounds = fileAreaRef.current?.getBoundingClientRect();
                  if (!bounds) return;
                  setMarquee((prev) =>
                    prev
                      ? {
                          ...prev,
                          x: event.clientX - bounds.left,
                          y: event.clientY - bounds.top,
                        }
                      : prev,
                  );
                }}
                onMouseUp={() => {
                  if (!marquee?.active) return;
                  const bounds = fileAreaRef.current?.getBoundingClientRect();
                  if (!bounds) return;
                  const left = Math.min(marquee.startX, marquee.x);
                  const right = Math.max(marquee.startX, marquee.x);
                  const top = Math.min(marquee.startY, marquee.y);
                  const bottom = Math.max(marquee.startY, marquee.y);
                  const nodes = fileAreaRef.current?.querySelectorAll("[data-file-id]") ?? [];
                  const hits: string[] = [];
                  nodes.forEach((node) => {
                    const rect = node.getBoundingClientRect();
                    const nodeLeft = rect.left - bounds.left;
                    const nodeRight = rect.right - bounds.left;
                    const nodeTop = rect.top - bounds.top;
                    const nodeBottom = rect.bottom - bounds.top;
                    const intersects =
                      nodeLeft < right && nodeRight > left && nodeTop < bottom && nodeBottom > top;
                    if (intersects) {
                      const id = (node as HTMLElement).dataset.fileId;
                      if (id) hits.push(id);
                    }
                  });
                  setSelectedIds(hits);
                  setSelectedFileId(hits[0] ?? null);
                  setMarquee(null);
                }}
                onMouseLeave={() => {
                  if (marquee?.active) setMarquee(null);
                }}
              >
                {marquee?.active ? (
                  <div
                    className="pointer-events-none absolute z-10 border border-primary/70 bg-primary/10"
                    style={{
                      left: Math.min(marquee.startX, marquee.x),
                      top: Math.min(marquee.startY, marquee.y),
                      width: Math.abs(marquee.x - marquee.startX),
                      height: Math.abs(marquee.y - marquee.startY),
                    }}
                  />
                ) : null}
                {showRecycleEntry ? (
                  <div
                    className="flex cursor-pointer items-center justify-between rounded-lg border bg-muted/20 p-3 hover:bg-muted/30"
                    onClick={() => navigateToFolder("recycle")}
                  >
                    <div className="flex items-center gap-3">
                      <Trash2 className={viewMode === "large" ? "h-6 w-6" : "h-4 w-4"} />
                      <div>
                        <p className="text-sm font-medium text-foreground">Recycle Bin</p>
                        <p className="text-xs text-muted-foreground">System</p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {(Array.isArray(orderedFolders) ? orderedFolders : []).map((folder) => (
                  <div
                    key={folder.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border bg-muted/20 p-3 hover:bg-muted/30"
                    onClick={() => navigateToFolder(folder.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      const folderPayload = event.dataTransfer.getData("application/x-folder");
                      if (folderPayload && folderPayload !== folder.id) {
                        moveFolder(session.tenant_id, session, folderPayload, folder.id);
                        setVersion((prev) => prev + 1);
                        return;
                      }
                      const payload = event.dataTransfer.getData("text/plain");
                      if (payload) handleDrop(payload, folder.id);
                    }}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("application/x-folder", folder.id);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Folder className={viewMode === "large" ? "h-6 w-6" : "h-4 w-4"} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{folder.name}</p>
                        <p className="text-xs text-muted-foreground">Folder</p>
                      </div>
                    </div>
                  </div>
                ))}
                {Object.entries(groupedFiles).map(([groupName, groupFiles]) => (
                  <div key={groupName} className="space-y-4">
                    {groupBy !== "none" && (
                      <div className="flex items-center gap-2 border-b pb-1">
                        <Badge variant="outline" className="font-bold">{groupName}</Badge>
                        <span className="text-[10px] text-muted-foreground uppercase">{groupFiles.length} items</span>
                      </div>
                    )}
                    { viewMode === "details" && (Array.isArray(groupFiles) ? groupFiles : []).some(f => {
                      let m = f.metadata;
                      if (typeof m === 'string') { try { m = JSON.parse(m); } catch(e) {} }
                      return m?.type === "STOCK_OPNAME_REPORT";
                    }) ? (
                      <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-muted/50 border-b">
                          <tr className="text-left text-xs text-muted-foreground font-semibold">
                            <th className="p-3">Report Name</th>
                            <th className="p-3">AI (Name and Version)</th>
                            <th className="p-3">Performer</th>
                            <th className="p-3">Timestamp</th>
                            <th className="p-3 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(groupFiles) ? groupFiles : []).map((file, index) => {
                            let meta = file.metadata;
                            if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch(e) {} }
                            
                            return (
                              <ContextMenu key={file.id}>
                                <ContextMenuTrigger asChild>
                                  <tr
                                    data-file-id={file.id}
                                    className={cn(
                                      "group border-b transition-colors cursor-pointer",
                                      selectedIds.includes(file.id) ? "bg-primary/10 border-primary/20" : "hover:bg-muted/50"
                                    )}
                                    onClick={(event) => {
                                      handleSelection(file.id, index, event);
                                      setSelectedFileId(file.id);
                                    }}
                                  >
                                    <td className="p-3">
                                      <div className="flex items-center gap-3">
                                        <FileText className="h-4 w-4 text-primary" />
                                        <span className="font-medium text-sm">{file.name}</span>
                                      </div>
                                    </td>
                                    <td className="p-3 text-sm">
                                      {meta?.ai_name ? (
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold">
                                            {meta.ai_name}
                                          </Badge>
                                          <span className="text-[10px] text-muted-foreground">{meta.ai_version}</span>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground italic">N/A</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-sm text-muted-foreground font-medium">
                                      {meta?.performer || "N/A"}
                                    </td>
                                    <td className="p-3 text-sm text-muted-foreground">
                                      {meta?.timestamp ? format(new Date(meta.timestamp), 'yyyy-MM-dd HH:mm') : "N/A"}
                                    </td>
                                    <td className="p-3 text-right">
                                      <MoreHorizontal className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </td>
                                  </tr>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                  <ContextMenuItem onClick={() => { setSelectedFileId(file.id); setPreviewOpen(true); }}>Preview</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    ) : (
                      <div className={`grid gap-6 ${
                        viewMode === "large" ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3"
                      }`}>
                        {(Array.isArray(groupFiles) ? groupFiles : []).map((file, index) => (
                          <ContextMenu key={file.id}>
                            <ContextMenuTrigger asChild>
                              <div
                                data-file-id={file.id}
                                draggable
                                onDragStart={(event) => {
                                  const payload = selectedIds.includes(file.id)
                                    ? JSON.stringify(selectedIds)
                                    : JSON.stringify([file.id]);
                                  event.dataTransfer.setData("text/plain", payload);
                                }}
                                onClick={(event) => {
                                  const now = Date.now();
                                  if (lastClick?.id === file.id && now - lastClick.time < 600) {
                                    const tool = getToolForFile(file);
                                    if (tool !== "none") {
                                      navigate(`/core/tools/${tool}?fileId=${file.id}`);
                                    } else {
                                      setSelectedFileId(file.id);
                                      setPreviewOpen(true);
                                    }
                                  } else {
                                    handleSelection(file.id, index, event);
                                    setSelectedFileId(file.id);
                                  }
                                  setLastClick({ id: file.id, time: now });
                                }}
                                className={cn(
                                  "flex cursor-pointer rounded-2xl border p-4 transition-all shadow-sm group",
                                  viewMode === "large" ? "flex-col gap-4" : "items-center justify-between gap-3",
                                  selectedIds.includes(file.id) ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/50 hover:shadow-md"
                                )}
                              >
                                <div className={cn("flex gap-4", viewMode === "large" ? "flex-col" : "items-center flex-1 min-w-0")}>
                                  <div className="flex items-center gap-2.5 flex-shrink-0">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.includes(file.id)}
                                      onChange={() => toggleSelect(file.id)}
                                      onClick={(event) => event.stopPropagation()}
                                      className="h-4 w-4 rounded-full border-muted text-primary focus:ring-primary bg-background shadow-inner"
                                    />
                                    <div className="p-2.5 bg-primary/5 rounded-2xl group-hover:bg-primary/10 transition-colors border border-primary/10 shadow-sm">
                                      {iconForFile(file.type, viewMode === "large" ? "lg" : "sm")}
                                    </div>
                                  </div>
                                  
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    {editingId === file.id ? (
                                      <Input
                                        value={editingValue}
                                        onChange={(event) => setEditingValue(event.target.value)}
                                        onBlur={() => {
                                          renameFile(session, file.id, editingValue);
                                          setEditingId(null);
                                          setVersion((prev) => prev + 1);
                                        }}
                                        autoFocus
                                        className="h-8 text-[10px] rounded-lg font-black uppercase tracking-widest"
                                      />
                                    ) : (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <p 
                                              className="text-[11px] font-black text-foreground truncate w-full group-hover:text-primary transition-all tracking-widest uppercase" 
                                            >
                                              {file.name}
                                            </p>
                                          </TooltipTrigger>
                                          <TooltipContent className="bg-muted border-border text-white font-bold italic shadow-2xl backdrop-blur-xl">
                                            {file.name}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    
                                    <div className="flex flex-col gap-2 mt-2">
                                        <div className="flex items-center gap-2">
                                          <div className="flex items-center gap-1.5 bg-muted dark:bg-muted px-2.5 py-1 rounded-lg border border-border/5 shadow-inner group-hover:bg-primary/5 transition-all">
                                            <Folder className="h-2.5 w-2.5 text-muted-foreground" />
                                            <p className="text-[8px] text-muted-foreground font-black tracking-widest truncate max-w-[120px] uppercase">
                                              {folderMap.get(file.folderId ?? "root") ?? "ROOT_NODE"}
                                            </p>
                                          </div>
                                          {file.access_level && (
                                            <Badge variant={file.access_level === "private" ? "destructive" : "secondary"} className="h-4.5 px-2 text-[8px] uppercase font-black rounded-lg border-none shadow-sm tracking-[0.2em] bg-muted dark:bg-muted text-muted-foreground">
                                              {file.access_level}
                                            </Badge>
                                          )}
                                        </div>

                                      {(() => {
                                        let meta = file.metadata;
                                        if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch(e) {} }
                                        if (meta?.type === "STOCK_OPNAME_REPORT") {
                                          return (
                                            <div className="pt-2 border-t border-dashed border-primary/10 space-y-2 mt-1">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <div className="flex items-center gap-1 bg-gradient-to-r from-indigo-500/10 to-blue-500/5 text-primary text-[8px] px-2 py-1 rounded-lg border border-primary font-black shadow-sm uppercase tracking-widest">
                                                  <Bot className="h-3 w-3" />
                                                  {meta.ai_name || "AUDIT_ENGINE"}
                                                </div>
                                                <div className="flex items-center gap-1 bg-muted text-muted-foreground text-[8px] px-2 py-1 rounded-lg border border-border font-black shadow-sm uppercase tracking-widest">
                                                  <User className="h-3 w-3" />
                                                  {meta.performer}
                                                </div>
                                              </div>
                                              <div className="pt-2">
                                                <Button 
                                                  variant="secondary" 
                                                  size="sm" 
                                                  className="w-full h-7 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg shadow-sm border border-primary/10 hover:bg-primary/10 transition-all group-hover:bg-primary group-hover:text-white"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedFileId(file.id);
                                                    setPreviewOpen(true);
                                                  }}
                                                >
                                                  <Eye className="h-3 w-3 mr-1.5" />
                                                  View Detailed Report
                                                </Button>
                                              </div>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  </div>
                                </div>
                                {viewMode !== "large" && (
                                  <div className="ml-2 flex items-center gap-2 flex-shrink-0 self-start">
                                    <Badge variant="outline" className="text-[10px] rounded-full px-4 py-1.5 bg-primary/5 text-primary border-primary/20 font-black italic shadow-md uppercase tracking-tighter hover:bg-primary/10 transition-colors">
                                      {typeLabel[file.type]}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem
                                onClick={() => {
                                  setSelectedFileId(file.id);
                                  setPreviewOpen(true);
                                }}
                              >
                                Preview
                              </ContextMenuItem>
                              {isRecycleView ? (
                                <>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onClick={() => {
                                      restoreFromRecycle(session.tenant_id, session, file.id);
                                      setVersion((prev) => prev + 1);
                                    }}
                                  >
                                    Restore
                                  </ContextMenuItem>
                                </>
                              ) : (
                                <>
                                  <ContextMenuItem onClick={() => {
                                    setEditingId(file.id);
                                    setEditingValue(file.name);
                                  }}>
                                    Rename
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onClick={() => {
                                      moveToRecycle(session, file.id);
                                      setVersion((prev) => prev + 1);
                                    }}
                                  >
                                    Move to recycle bin
                                  </ContextMenuItem>
                                </>
                              )}
                            </ContextMenuContent>
                          </ContextMenu>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </div>
          </WorkspacePanel>

        </div>
      </div>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          {selectedFile ? (
            <div className="flex flex-col gap-6">
              {/* Specialized Report Header */}
              {(() => {
                let m = selectedFile.metadata;
                if (typeof m === 'string') { try { m = JSON.parse(m); } catch(e) {} }
                const isReport = m?.type === "STOCK_OPNAME_REPORT" || 
                               (selectedFile.name.toLowerCase().startsWith("stock") && selectedFile.name.toLowerCase().includes("opname") && selectedFile.type === "json");
                return isReport;
              })() ? (
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl">
                      <FileSearch className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight">Stock Opname Report</h3>
                      {(() => {
                        let m = selectedFile.metadata;
                        if (typeof m === 'string') { try { m = JSON.parse(m); } catch(e) {} }
                        return (
                          <p className="text-xs text-muted-foreground">
                            Location: <span className="text-foreground font-semibold">{m?.location || "N/A"}</span> - {m?.timestamp ? format(new Date(m.timestamp), 'PPpp') : "N/A"}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        const data = typeof selectedFile.content === 'string' ? JSON.parse(selectedFile.content) : selectedFile.content;
                        if (!data?.items) return;
                        
                        const headers = ["SKU", "Name", "Expected", "Actual", "Variance"];
                        const rows = data.items.map((item: any) => [
                          item.sku,
                          item.name,
                          item.expected_quantity,
                          item.actual_quantity,
                          item.variance
                        ]);
                        
                        const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
                        const blob = new Blob([csvContent], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        const m = typeof selectedFile.metadata === 'string' ? JSON.parse(selectedFile.metadata) : selectedFile.metadata;
                        const loc = m?.location || "Audit";
                        const time = m?.timestamp ? format(new Date(m.timestamp), 'yyyyMMdd_HHmm') : format(new Date(), 'yyyyMMdd');
                        a.download = `Stock_Opname_${loc}_${time}.csv`;
                        a.click();
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export to CSV
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-primary/20 hover:bg-primary/5 text-primary"
                      onClick={() => {
                        const style = document.createElement('style');
                        style.textContent = `
                          @media print {
                            body * { visibility: hidden; }
                            #report-print-content, #report-print-content * { visibility: visible; }
                            #report-print-content { 
                              position: absolute; 
                              left: 0; 
                              top: 0; 
                              width: 100%;
                              background: white !important;
                              padding: 20px;
                            }
                            .no-print { display: none !important; }
                          }
                        `;
                        document.head.appendChild(style);
                        window.print();
                        document.head.removeChild(style);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export to PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <DialogHeader>
                  <DialogTitle>{selectedFile?.name ?? "File preview"}</DialogTitle>
                </DialogHeader>
              )}

              <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
                <div className="space-y-4">
                 {(() => {
                let m = selectedFile.metadata;
                if (typeof m === 'string') { try { m = JSON.parse(m); } catch(e) {} }
                return m?.type === "STOCK_OPNAME_REPORT" || 
                       (selectedFile.name.toLowerCase().startsWith("stock") && selectedFile.name.toLowerCase().includes("opname") && selectedFile.type === "json");
              })() ? (
                    <div id="report-print-content" className="rounded-xl border bg-muted/5 overflow-hidden">
                      <div className="bg-muted/20 p-3 text-xs font-bold uppercase tracking-wider border-b flex justify-between">
                        <span>Report Items</span>
                        <span>{Array.isArray(selectedFile.content?.items) ? selectedFile.content.items.length : 0} Items</span>
                      </div>
                      <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/10 sticky top-0">
                            <tr className="text-left text-xs font-semibold text-muted-foreground border-b">
                              <th className="p-3">Image</th>
                              <th className="p-3">Product</th>
                              <th className="p-3">Expected</th>
                              <th className="p-3">Actual</th>
                              <th className="p-3">Variance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const data = typeof selectedFile.content === 'string' ? JSON.parse(selectedFile.content) : selectedFile.content;
                              return (Array.isArray(data?.items) ? data.items : []).map((item: any, i: number) => (
                                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                                  <td className="p-3">
                                    {item.image ? (
                                      <img src={item.image} className="h-10 w-10 rounded-md object-cover border bg-white" />
                                    ) : (
                                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center border">
                                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <div className="font-bold">{item.name}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">{item.sku}</div>
                                  </td>
                                  <td className="p-3 font-medium">{item.expected_quantity}</td>
                                  <td className="p-3 font-medium">{item.actual_quantity}</td>
                                  <td className="p-3">
                                    <Badge variant={item.variance === 0 ? "secondary" : "destructive"} className="text-[10px]">
                                      {item.variance > 0 ? `+${item.variance}` : item.variance}
                                    </Badge>
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border p-4 text-sm text-muted-foreground overflow-auto max-h-[400px] bg-muted/20 font-mono">
                      {typeof selectedFile.content === 'string' 
                        ? (selectedFile.content.startsWith('{') || selectedFile.content.startsWith('[')
                           ? <pre className="whitespace-pre-wrap">{selectedFile.content}</pre>
                           : selectedFile.content.substring(0, 800))
                        : (selectedFile.content 
                           ? <pre className="whitespace-pre-wrap">{JSON.stringify(selectedFile.content, null, 2)}</pre>
                           : "No preview available.")}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {!isRecycleView ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(selectedFile.id);
                            setEditingValue(selectedFile.name);
                          }}
                        >
                          Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            moveToRecycle(session, selectedFile.id);
                            setPreviewOpen(false);
                            setVersion((prev) => prev + 1);
                          }}
                        >
                          Move to recycle bin
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          restoreFromRecycle(session, selectedFile.id);
                          setPreviewOpen(false);
                          setVersion((prev) => prev + 1);
                        }}
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4 text-sm">
                  <div className="rounded-xl border p-4 bg-muted/5 shadow-sm">
                    <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-2 mb-3">
                      <Info className="h-3 w-3" />
                      Registry Metadata
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between border-b border-dashed pb-1">
                        <span className="text-muted-foreground">ID</span>
                        <span className="font-mono text-[10px]">{selectedFile.id.slice(0, 13)}...</span>
                      </div>
                      <div className="flex justify-between border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Type</span>
                        <span className="capitalize">{selectedFile.type}</span>
                      </div>
                      <div className="flex justify-between border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Access</span>
                        <Badge variant={selectedFile.access_level === "private" ? "destructive" : "secondary"} className="h-4 px-1 text-[9px]">
                          {selectedFile.access_level || "private"}
                        </Badge>
                      </div>
                      <div className="flex justify-between border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Location</span>
                        <span className="font-bold">{selectedFile.metadata?.location || "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Performer</span>
                        <span className="italic">{selectedFile.metadata?.performer || "N/A"}</span>
                      </div>
                      {selectedFile.metadata?.ai_name && (
                        <div className="flex justify-between border-b border-dashed pb-1">
                          <span className="text-muted-foreground">AI Engine</span>
                          <span className="text-right">
                            <div className="font-bold text-primary">{selectedFile.metadata.ai_name}</div>
                            <div className="text-[10px] text-muted-foreground">{selectedFile.metadata.ai_version}</div>
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Company</span>
                        <span>{selectedFile.company_id?.slice(0, 8) || "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Folder</span>
                        <span>{folderMap.get(selectedFile.folderId ?? "root")}</span>
                      </div>
                      <div className="flex justify-between border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Created</span>
                        <span>{formatSafeDate(selectedFile.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                    {selectedFile.last_edited_by && (
                      <div className="mt-2 pt-2 border-t font-medium text-primary">
                        Last Editor ID: {selectedFile.last_edited_by}
                      </div>
                    )}
                  </div>
                </div>
                
                {selectedFile.history && Array.isArray(selectedFile.history) && selectedFile.history.length > 0 && (
                   <div className="rounded-lg border p-4 bg-muted/5">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-1 mb-3">
                        <History className="h-3 w-3" />
                        Forensic History Tape
                      </div>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {(Array.isArray(selectedFile.history) ? selectedFile.history : []).map((log: any, i: number) => (
                          <div key={i} className="text-[11px] border-l-2 border-primary/20 pl-2 py-1">
                            <div className="font-bold text-foreground">{log.action}</div>
                            <div className="text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</div>
                            {log.userName && <div className="italic">by {log.userName}</div>}
                          </div>
                        ))}
                      </div>
                   </div>
                )}
                {!isRecycleView ? (
                  <div className="rounded-lg border p-4">
                    <div className="text-xs text-muted-foreground">Move to folder</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(Array.isArray(folders) ? folders : []).map((folder) => (
                        <Button
                          key={folder.id}
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            moveFile(session, selectedFile.id, folder.id);
                            setVersion((prev) => prev + 1);
                          }}
                        >
                          {folder.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Select a file to see preview and metadata.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DepartmentWorkspaceLayout>
  );
}
