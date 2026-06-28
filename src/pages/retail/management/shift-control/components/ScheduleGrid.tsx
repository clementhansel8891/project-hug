/**
 * ScheduleGrid — Shift schedule grid with inline shift assignment dialog.
 *
 * The inline AssignShiftDialog at the end follows the canonical wiring pattern:
 * 1. Zod schema for validation (employeeId, startTime, endTime, role required)
 * 2. useForm with zodResolver
 * 3. useMutation with apiRequest
 * 4. getMutationToastHandlers for standardized success/error
 * 5. Loading states (isPending disables submit/cancel/fields via fieldset)
 * 6. Accessibility: aria-describedby, aria-invalid, role="alert"
 *
 * Requirements: 1 (Form Fields), 2 (Validation), 3 (API Submission),
 *               4 (Loading State), 5 (Error Handling), 6 (Success Handling),
 *               10 (Consistent Pattern)
 */

import React, { useState, useRef, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  LayoutGrid,
  CalendarDays,
  CalendarRange,
  Trash2,
  Calendar as CalendarIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
} from "date-fns";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";

export interface ScheduledShift {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  startTime: string; // HH:mm format
  endTime: string;
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  status: "draft" | "published";
  date?: Date; // Added for precise date management
}

interface ScheduleGridProps {
  shifts: ScheduledShift[];
  onShiftUpdate: (updatedShift: ScheduledShift) => void;
  onShiftCreate: (dayOfWeek: number, startHour?: number, date?: Date) => void;
  onShiftDelete: (shiftId: string) => void;
  onShiftClick: (shift: ScheduledShift) => void;
  viewMode: "daily" | "weekly" | "monthly";
  onViewModeChange: (mode: "daily" | "weekly" | "monthly") => void;
}

const START_HOUR = 0;
const END_HOUR = 24;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, i) => i + START_HOUR,
);
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  shifts,
  onShiftUpdate,
  onShiftCreate,
  onShiftDelete,
  onShiftClick,
  viewMode,
  onViewModeChange,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dragInfo, setDragInfo] = useState<{
    shift: ScheduledShift;
    type: "move" | "resizeTop" | "resizeBottom";
  } | null>(null);

  // Time conversion helpers
  const timeToDecimal = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h + m / 60;
  };

  const decimalToTime = (dec: number) => {
    const h = Math.floor(dec);
    const m = Math.round((dec - h) * 60);
    const clamph = Math.max(0, Math.min(23, h));
    return `${clamph.toString().padStart(2, "0")}:${m === 0 ? "00" : m.toString().padStart(2, "0")}`;
  };

  // Drag and Drop Logic
  const handleDragStart = (
    e: React.DragEvent,
    shift: ScheduledShift,
    type: "move" | "resizeTop" | "resizeBottom",
  ) => {
    e.stopPropagation();
    setDragInfo({ shift, type });
    const img = new Image();
    img.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    e.dataTransfer.setDragImage(img, 0, 0);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (
    e: React.DragEvent,
    targetDay: number,
    targetHour: number,
  ) => {
    e.preventDefault();
    if (!dragInfo) return;

    const { shift, type } = dragInfo;
    let newStartStr = shift.startTime;
    let newEndStr = shift.endTime;
    const newDay = targetDay;

    const currentStartDec = timeToDecimal(shift.startTime);
    const currentEndDec = timeToDecimal(shift.endTime);
    const duration = currentEndDec - currentStartDec;

    if (type === "move") {
      let newStartDec = targetHour;
      let newEndDec = newStartDec + duration;
      if (newEndDec > 24) {
        newEndDec = 24;
        newStartDec = 24 - duration;
      }
      newStartStr = decimalToTime(newStartDec);
      newEndStr = decimalToTime(newEndDec);
    } else if (type === "resizeTop") {
      if (targetHour < currentEndDec) {
        newStartStr = decimalToTime(targetHour);
      }
    } else if (type === "resizeBottom") {
      const targetEndDec = targetHour + 1;
      if (targetEndDec > currentStartDec) {
        newEndStr = decimalToTime(targetEndDec);
      }
    }

    onShiftUpdate({
      ...shift,
      dayOfWeek: newDay,
      startTime: newStartStr,
      endTime: newEndStr,
    });
    setDragInfo(null);
  };

  // Overlap handling logic (Improved for V2)
  const getPositionStyles = (
    shift: ScheduledShift,
    allShifts: ScheduledShift[],
  ) => {
    const dayShifts = (Array.isArray(allShifts) ? allShifts : []).filter((s) => s.dayOfWeek === shift.dayOfWeek)
      .sort((a, b) => timeToDecimal(a.startTime) - timeToDecimal(b.startTime));

    const start = timeToDecimal(shift.startTime);
    const end = timeToDecimal(shift.endTime);

    // Find all shifts that overlap with this shift
    const overlappingShifts = (Array.isArray(dayShifts) ? dayShifts : []).filter((s) => {
      const sStart = timeToDecimal(s.startTime);
      const sEnd = timeToDecimal(s.endTime);
      return Math.max(start, sStart) < Math.min(end, sEnd);
    });

    // Grouping logic for columns
    const columns: string[][] = [];
    overlappingShifts.forEach((s) => {
      let placed = false;
      for (const col of columns) {
        const lastInCol = col[col.length - 1];
        const lastShift = dayShifts.find((ds) => ds.id === lastInCol)!;
        if (timeToDecimal(lastShift.endTime) <= timeToDecimal(s.startTime)) {
          col.push(s.id);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([s.id]);
      }
    });

    const colIndex = columns.findIndex((col) => col.includes(shift.id));
    const totalCols = columns.length;

    const width = 100 / totalCols;
    const left = colIndex * width;

    const topPixels = start * 80;
    const heightPixels = (end - start) * 80;

    return {
      top: `${topPixels + 2}px`,
      height: `${heightPixels - 4}px`,
      width: `calc(${width}% - 8px)`,
      left: `calc(${left}% + 4px)`,
    };
  };

  // Date range helpers
  const getVisibleDays = () => {
    if (viewMode === "daily") return [currentDate];
    if (viewMode === "weekly") {
      const start = startOfWeek(currentDate);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return []; // Monthly handled separately
  };

  if (viewMode === "monthly") {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = [];
    let day = startOfWeek(monthStart);
    while (day <= endOfWeek(monthEnd)) {
      days.push(day);
      day = addDays(day, 1);
    }

    return (
      <div className="bg-muted rounded-3xl border border-border shadow-2xl backdrop-blur-3xl flex flex-col w-full h-full min-h-[600px] text-foreground">
        <ViewControls
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
        />
        <div className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-7 gap-2">
            {(Array.isArray(SHORT_DAYS) ? SHORT_DAYS : []).map((d) => (
              <div
                key={d}
                className="font-bold text-center text-muted-foreground text-xs mb-2 uppercase"
              >
                {d}
              </div>
            ))}
            {(Array.isArray(days) ? days : []).map((d, i) => {
              const dayShifts = (Array.isArray(shifts) ? shifts : []).filter(
                (s) => s.date && isSameDay(new Date(s.date), d),
              );
              const isCurrentMonth = d.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(d, new Date());

              return (
                <div
                  key={i}
                  onClick={() => onShiftCreate(d.getDay(), 8, d)}
                  className={cn(
                    "min-h-[100px] rounded-2xl border p-2 flex flex-col items-start justify-start relative cursor-pointer transition-all group overflow-hidden",
                    !isCurrentMonth && "opacity-30 grayscale",
                    isToday
                      ? "bg-primary/10 border-primary"
                      : "bg-muted border-border hover:border-primary hover:shadow-lg",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-bold mb-1",
                      isToday ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {format(d, "d")}
                  </span>
                  <div className="w-full mt-2 space-y-1">
                    {(Array.isArray(dayShifts) ? dayShifts : []).map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          "h-1.5 w-full rounded-full transition-all hover:h-3 group/bar relative",
                          s.status === "draft"
                            ? "bg-warning group-hover/bar:bg-warning"
                            : "bg-primary group-hover/bar:bg-primary",
                        )}
                      >
                        <div className="absolute inset-0 opacity-0 group-hover/bar:opacity-100 flex items-center px-1 text-[6px] font-black text-foreground uppercase truncate whitespace-nowrap pointer-events-none">
                          {s.startTime} - {s.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const visibleDates = getVisibleDays();

  return (
    <div className="bg-muted rounded-3xl border border-border shadow-2xl backdrop-blur-3xl flex flex-col w-full min-h-full text-foreground">
      <ViewControls
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
      />

      <div className="w-full flex-1">
        <div className="flex flex-col w-full relative">
          {/* Days Header */}
          <div className="flex border-b border-border bg-muted sticky top-0 z-30 backdrop-blur-md">
            <div className="w-20 shrink-0 border-r border-border flex items-center justify-center bg-secondary/50">
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            {(Array.isArray(visibleDates) ? visibleDates : []).map((date, idx) => {
              const isToday = isSameDay(date, new Date());
              return (
                <div
                  key={idx}
                  className="flex-1 min-w-[150px] p-4 text-center border-r border-border relative group"
                >
                  <div
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-widest mb-1",
                      isToday ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {format(date, "EEEE")}
                  </div>
                  <div
                    className={cn(
                      "text-xl font-black italic tracking-tighter",
                      isToday ? "text-primary" : "text-foreground",
                    )}
                  >
                    {format(date, "MMM d")}
                  </div>
                  <Button
                    onClick={() => onShiftCreate(date.getDay(), 8, date)}
                    size="icon"
                    variant="ghost"
                    className="absolute top-4 right-4 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 text-primary hover:bg-primary"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex relative">
            {/* Time Axis */}
            <div className="w-20 shrink-0 border-r border-border bg-secondary/50 flex flex-col pt-2">
              {(Array.isArray(HOURS) ? HOURS : []).map((hour) => (
                <div
                  key={hour}
                  className="h-20 border-b border-border flex items-start justify-center pt-2"
                >
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    {hour.toString().padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Grid Cells */}
            <div className="flex-1 flex pt-2">
              {(Array.isArray(visibleDates) ? visibleDates : []).map((date, dayIdx) => (
                <div
                  key={dayIdx}
                  className="flex-1 min-w-[150px] border-r border-border relative group h-full"
                  onDragOver={handleDragOver}
                >
                  {(Array.isArray(HOURS) ? HOURS : []).map((hour) => (
                    <div
                      key={hour}
                      className="h-20 border-b border-border/50 relative hover:bg-primary/5 transition-colors"
                      onDrop={(e) => handleDrop(e, date.getDay(), hour)}
                      onClick={(e) => {
                        if (e.target === e.currentTarget)
                          onShiftCreate(date.getDay(), hour, date);
                      }}
                    />
                  ))}

                  {(Array.isArray(shifts) ? shifts : []).filter((s) => s.dayOfWeek === date.getDay())
                    .map((shift) => {
                      const style = getPositionStyles(shift, shifts);
                      const isInteracting = dragInfo?.shift.id === shift.id;

                      return (
                        <div
                          key={shift.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, shift, "move")}
                          onClick={() => onShiftClick(shift)}
                          className={cn(
                            "absolute rounded-2xl shadow-sm border transition-all z-20 overflow-hidden group/shift backdrop-blur-sm",
                            shift.status === "draft"
                              ? "bg-warning border-warning/20 text-warning hover:border-warning"
                              : "bg-primary/10 border-primary text-primary hover:border-primary",
                            isInteracting && "opacity-50 scale-95",
                          )}
                          style={style}
                        >
                          {/* Resize Handles */}
                          <div
                            draggable
                            onDragStart={(e) =>
                              handleDragStart(e, shift, "resizeTop")
                            }
                            className="absolute top-0 inset-x-0 h-2 cursor-ns-resize hover:bg-black/10 z-30"
                          />
                          <div
                            draggable
                            onDragStart={(e) =>
                              handleDragStart(e, shift, "resizeBottom")
                            }
                            className="absolute bottom-0 inset-x-0 h-2 cursor-ns-resize hover:bg-black/10 z-30"
                          />

                          {/* Content */}
                          <div className="p-3 h-full flex flex-col relative select-none">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onShiftDelete(shift.id);
                              }}
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-secondary text-muted-foreground opacity-0 group-hover/shift:opacity-100 hover:text-destructive hover:bg-destructive transition-all z-40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <div className="flex items-start justify-between mb-1">
                              <span
                                className={cn(
                                  "text-[10px] font-black uppercase tracking-wider",
                                  shift.status === "draft"
                                    ? "text-warning"
                                    : "text-primary",
                                )}
                              >
                                {shift.startTime} - {shift.endTime}
                              </span>
                            </div>

                            <div className="font-black italic text-sm text-foreground leading-tight truncate mb-0.5">
                              {shift.name}
                            </div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase truncate mt-auto">
                              {shift.role}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ViewControls = ({
  viewMode,
  onViewModeChange,
  currentDate,
  onDateChange,
}: {
  viewMode: "daily" | "weekly" | "monthly";
  onViewModeChange: (mode: "daily" | "weekly" | "monthly") => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
}) => {
  return (
    <div className="p-6 border-b border-border flex flex-col lg:flex-row items-center justify-between gap-6 bg-muted sticky top-0 z-40 backdrop-blur-md">
      <div className="flex items-center gap-4 bg-secondary p-1 rounded-2xl border border-border">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            onDateChange(
              addDays(
                currentDate,
                viewMode === "daily" ? -1 : viewMode === "weekly" ? -7 : -30,
              ),
            )
          }
          className="h-9 w-9 rounded-xl text-foreground hover:bg-muted/10"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="h-9 px-4 font-black italic uppercase text-xs tracking-widest gap-2 text-foreground hover:bg-muted/10"
            >
              <CalendarIcon className="w-4 h-4 text-primary" />
              {viewMode === "daily"
                ? format(currentDate, "MMMM d, yyyy")
                : viewMode === "weekly"
                  ? `${format(startOfWeek(currentDate), "MMM d")} - ${format(endOfWeek(currentDate), "MMM d, yyyy")}`
                  : format(currentDate, "MMMM yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 border-none shadow-2xl rounded-3xl"
            align="start"
          >
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={(d) => d && onDateChange(d)}
              initialFocus
              className="p-4"
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            onDateChange(
              addDays(
                currentDate,
                viewMode === "daily" ? 1 : viewMode === "weekly" ? 7 : 30,
              ),
            )
          }
          className="h-9 w-9 rounded-xl text-foreground hover:bg-muted/10"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5 bg-secondary p-1.5 rounded-[1.25rem] border border-border">
        {(["daily", "weekly", "monthly"] as const).map((mode) => (
          <Button
            key={mode}
            variant={viewMode === mode ? "default" : "ghost"}
            onClick={() => onViewModeChange(mode)}
            className={cn(
              "h-10 px-6 rounded-xl font-black italic uppercase text-[10px] tracking-widest transition-all",
              viewMode === mode
                ? "bg-white/10 text-primary shadow-md scale-105"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            {mode === "daily" && <LayoutGrid className="w-3.5 h-3.5 mr-2" />}
            {mode === "weekly" && <CalendarDays className="w-3.5 h-3.5 mr-2" />}
            {mode === "monthly" && (
              <CalendarRange className="w-3.5 h-3.5 mr-2" />
            )}
            {mode}
          </Button>
        ))}
      </div>

      <div className="hidden sm:flex gap-4">
        <div className="flex flex-col items-end">
          <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Security Node
          </div>
          <div className="text-[10px] font-bold text-primary flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            ACTIVE_ENFORCEMENT
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Inline Shift Assignment Dialog ─────────────────────────────────────────────

const assignShiftSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  role: z.string().min(1, "Role is required"),
}).refine(
  (data) => data.endTime > data.startTime,
  { message: "End time must be after start time", path: ["endTime"] }
);

export type AssignShiftFormValues = z.infer<typeof assignShiftSchema>;

interface AssignShiftDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dayOfWeek: number;
  startHour?: number;
  date?: Date;
  availableStaff?: { id: string; name: string; role: string }[];
}

const SHIFT_ROLES = [
  "Cashier",
  "Shift Supervisor",
  "Store Manager",
  "Inventory Specialist",
  "Security",
];

export const AssignShiftDialog: React.FC<AssignShiftDialogProps> = ({
  isOpen,
  onClose,
  dayOfWeek,
  startHour = 8,
  date,
  availableStaff = [],
}) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const defaultStartTime = `${startHour.toString().padStart(2, "0")}:00`;
  const defaultEndTime = `${Math.min(startHour + 8, 23).toString().padStart(2, "0")}:00`;

  const form = useForm<AssignShiftFormValues>({
    resolver: zodResolver(assignShiftSchema),
    defaultValues: {
      employeeId: "",
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      role: "",
    },
  });

  const { register, control, formState: { errors }, handleSubmit, reset } = form;

  // Reset defaults when props change
  useEffect(() => {
    if (isOpen) {
      reset({
        employeeId: "",
        startTime: defaultStartTime,
        endTime: defaultEndTime,
        role: "",
      });
    }
  }, [isOpen, defaultStartTime, defaultEndTime, reset]);

  const mutation = useMutation({
    mutationFn: (data: AssignShiftFormValues) =>
      apiRequest("/v1/retail/shifts", "POST", session, {
        employeeId: data.employeeId,
        startTime: data.startTime,
        endTime: data.endTime,
        role: data.role,
        dayOfWeek,
        date: date?.toISOString(),
        status: "draft",
      }),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "shifts"]],
      onClose: handleClose,
      form,
      successTitle: "Shift Assigned",
      successDescription: "The shift has been created successfully.",
    }),
  });

  const isPending = mutation.isPending;

  function handleClose() {
    if (isPending) return;
    reset();
    onClose();
  }

  const onSubmit = handleSubmit((data) => mutation.mutate(data));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-sm bg-muted border-border p-6 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-black italic tracking-tighter flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            ASSIGN SHIFT
          </DialogTitle>
          {date && (
            <div className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">
              {format(date, "EEEE, MMM d, yyyy")}
            </div>
          )}
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={isPending} className="space-y-4 mt-4">
            <div>
              <label htmlFor="assign-shift-employee" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                Employee *
              </label>
              <Controller
                control={control}
                name="employeeId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="assign-shift-employee"
                      className="w-full h-11 rounded-xl border-border text-sm font-bold"
                      aria-describedby={errors.employeeId ? "assign-shift-employee-error" : undefined}
                      aria-invalid={!!errors.employeeId}
                    >
                      <SelectValue placeholder="Select employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStaff.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="font-bold text-xs">
                          {s.name} ({s.role})
                        </SelectItem>
                      ))}
                      {availableStaff.length === 0 && (
                        <SelectItem value="__none" disabled className="text-xs text-muted-foreground">
                          No staff available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.employeeId && (
                <p id="assign-shift-employee-error" className="text-[10px] text-destructive font-medium mt-1" role="alert">
                  {errors.employeeId.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="assign-shift-start" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                  Start Time *
                </label>
                <Input
                  id="assign-shift-start"
                  type="time"
                  {...register("startTime")}
                  className="h-11 rounded-xl border-border text-sm font-bold"
                  aria-describedby={errors.startTime ? "assign-shift-start-error" : undefined}
                  aria-invalid={!!errors.startTime}
                />
                {errors.startTime && (
                  <p id="assign-shift-start-error" className="text-[10px] text-destructive font-medium mt-1" role="alert">
                    {errors.startTime.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="assign-shift-end" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                  End Time *
                </label>
                <Input
                  id="assign-shift-end"
                  type="time"
                  {...register("endTime")}
                  className="h-11 rounded-xl border-border text-sm font-bold"
                  aria-describedby={errors.endTime ? "assign-shift-end-error" : undefined}
                  aria-invalid={!!errors.endTime}
                />
                {errors.endTime && (
                  <p id="assign-shift-end-error" className="text-[10px] text-destructive font-medium mt-1" role="alert">
                    {errors.endTime.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="assign-shift-role" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                Role *
              </label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="assign-shift-role"
                      className="w-full h-11 rounded-xl border-border text-sm font-bold"
                      aria-describedby={errors.role ? "assign-shift-role-error" : undefined}
                      aria-invalid={!!errors.role}
                    >
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIFT_ROLES.map((role) => (
                        <SelectItem key={role} value={role} className="font-bold text-xs">
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && (
                <p id="assign-shift-role-error" className="text-[10px] text-destructive font-medium mt-1" role="alert">
                  {errors.role.message}
                </p>
              )}
            </div>
          </fieldset>

          <DialogFooter className="mt-6 gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={handleClose}
              className="rounded-xl text-muted-foreground font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black italic uppercase text-[10px] tracking-widest"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Assign Shift
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
