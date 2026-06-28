import React from "react";
import { Search, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InventoryFilters } from "./types";

type Props = {
  canWrite: boolean;
  filters: InventoryFilters;
  categoryOptions: { id: string; name: string }[];
  onFiltersChange: (patch: Partial<InventoryFilters>) => void;
  onAddSku?: () => void;
  onManageCategories?: () => void;
};

export const FiltersBar: React.FC<Props> = ({
  canWrite,
  filters,
  categoryOptions,
  onFiltersChange,
  onAddSku,
  onManageCategories,
}) => {
  return (
    <div className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border shadow-lg">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
        <Input
          className="pl-12 h-11 bg-secondary/5 border-none rounded-xl font-bold italic placeholder:text-muted-foreground/60"
          placeholder="Search SKU, name or category..."
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
        value={filters.sortBy}
        onValueChange={(v: InventoryFilters["sortBy"]) =>
          onFiltersChange({ sortBy: v })
        }
      >
        <SelectTrigger className="w-40 h-11 rounded-xl font-black italic text-xs border-border">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="name-asc" className="font-bold italic">
            Name (A → Z)
          </SelectItem>
          <SelectItem value="name-desc" className="font-bold italic">
            Name (Z → A)
          </SelectItem>
          <SelectItem value="price-asc" className="font-bold italic">
            Price (Low → High)
          </SelectItem>
          <SelectItem value="price-desc" className="font-bold italic">
            Price (High → Low)
          </SelectItem>
          <SelectItem value="quantity-asc" className="font-bold italic">
            Stock (Low → High)
          </SelectItem>
          <SelectItem value="quantity-desc" className="font-bold italic">
            Stock (High → Low)
          </SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.type}
        onValueChange={(v) => onFiltersChange({ type: v })}
      >
        <SelectTrigger className="w-36 h-11 rounded-xl font-black italic text-xs border-border">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="all" className="font-bold italic">
            All Types
          </SelectItem>
          <SelectItem value="ITEM" className="font-bold italic">
            ITEM
          </SelectItem>
          <SelectItem value="SERVICE" className="font-bold italic">
            SERVICE
          </SelectItem>
          <SelectItem value="RAW_MATERIAL" className="font-bold italic">
            RAW MATERIAL
          </SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 border border-border rounded-xl px-2 h-11 bg-secondary/5">
        <span className="text-[10px] font-black italic text-muted-foreground uppercase">
          Price
        </span>
        <Input
          type="number"
          placeholder="Min"
          className="w-16 h-7 text-xs font-bold italic border-none bg-transparent p-0 placeholder:text-muted-foreground/60"
          value={filters.minPrice ?? ""}
          onChange={(e) =>
            onFiltersChange({
              minPrice: e.target.value ? parseFloat(e.target.value) : undefined,
            })
          }
        />
        <span className="text-muted-foreground/60">-</span>
        <Input
          type="number"
          placeholder="Max"
          className="w-16 h-7 text-xs font-bold italic border-none bg-transparent p-0 placeholder:text-muted-foreground/60"
          value={filters.maxPrice ?? ""}
          onChange={(e) =>
            onFiltersChange({
              maxPrice: e.target.value ? parseFloat(e.target.value) : undefined,
            })
          }
        />
      </div>

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
      {canWrite && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onManageCategories}
            className="h-11 px-4 rounded-xl font-black italic text-xs uppercase tracking-widest gap-2"
          >
            Categories
          </Button>
          <Button
            onClick={onAddSku}
            className="h-11 px-5 rounded-xl bg-secondary text-foreground font-black italic text-xs uppercase tracking-widest gap-2"
          >
            <Plus className="w-4 h-4" /> Add SKU
          </Button>
        </div>
      )}
    </div>
  );
};
