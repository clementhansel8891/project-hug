import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/button"; // Assuming Select from shadcn
import { Calendar } from "lucide-react";
import { AnalyticsTimeRange } from "@/core/types/retail/analytics";

interface TimeRangeFilterProps {
  value: AnalyticsTimeRange;
  onChange: (value: AnalyticsTimeRange) => void;
}

export const TimeRangeFilter: React.FC<TimeRangeFilterProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-secondary/400 backdrop-blur-md rounded-xl border border-border0 shadow-sm group">
      <Calendar className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
      <div className="flex flex-col">
        <span className="text-[7px] font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-0.5">
          Temporal Window
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as AnalyticsTimeRange)}
          className="bg-transparent border-none p-0 text-[10px] font-black uppercase tracking-widest focus:ring-0 cursor-pointer text-foreground outline-none h-auto min-h-0"
        >
          <option value="TODAY">Today</option>
          <option value="YESTERDAY">Yesterday</option>
          <option value="LAST_7_DAYS">Last 7 Days</option>
          <option value="LAST_30_DAYS">Last 30 Days</option>
          <option value="CUSTOM_RANGE">Custom Range</option>
        </select>
      </div>
    </div>
  );
};
