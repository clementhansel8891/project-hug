import React from "react";
import { Search, ScanLine } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { InventoryFilters } from "../types";

interface OpnameFiltersProps {
  filters: InventoryFilters;
  categoryOptions: { id: string; name: string }[];
  onFiltersChange: (patch: Partial<InventoryFilters>) => void;
  barcodeInput: string;
  onBarcodeChange: (val: string) => void;
  onBarcodeKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  barcodeRef?: React.RefObject<HTMLInputElement>;
}

export const OpnameFilters: React.FC<OpnameFiltersProps> = ({
  filters,
  categoryOptions,
  onFiltersChange,
  barcodeInput,
  onBarcodeChange,
  onBarcodeKeyDown,
  barcodeRef,
}) => {
  return (
    <div className="space-y-4">
      {/* Barcode input */}
      <div className="bg-card rounded-xl p-4 border border-border shadow-lg">
        <div className="flex items-center gap-4">
          <ScanLine className="w-5 h-5 text-primary shrink-0" />
          <Input
            ref={barcodeRef}
            className="flex-1 h-12 rounded-xl font-mono font-bold border-border"
            placeholder="Scan barcode here (press Enter to register)..."
            value={barcodeInput}
            onChange={(e) => onBarcodeChange(e.target.value)}
            onKeyDown={onBarcodeKeyDown}
          />
        </div>
      </div>

      {/* Table filters */}
      <div className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border shadow-lg">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <Input
            className="pl-12 h-11 bg-secondary/5 border-none rounded-xl font-bold italic placeholder:text-muted-foreground/60"
            placeholder="Search SKU or name..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
          />
        </div>
        <Select
          value={filters.category}
          onValueChange={(v) => onFiltersChange({ category: v })}
        >
          <SelectTrigger className="w-44 h-11 rounded-xl font-black italic text-xs border-border">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {(Array.isArray(categoryOptions) ? categoryOptions : []).map((c) => (
              <SelectItem key={c.id} value={c.id} className="font-bold italic">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(v) => onFiltersChange({ status: v })}
        >
          <SelectTrigger className="w-36 h-11 rounded-xl font-black italic text-xs border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {["all", "ok", "low", "critical", "overstock"].map((s) => (
              <SelectItem key={s} value={s} className="font-bold italic">
                {s === "all" ? "All Status" : s.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
