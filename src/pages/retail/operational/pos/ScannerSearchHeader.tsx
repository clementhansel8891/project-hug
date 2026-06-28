import React from "react";
import { Search, ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ScannerSearchHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  barcodeValue: string;
  onBarcodeChange: (value: string) => void;
}

export const ScannerSearchHeader: React.FC<ScannerSearchHeaderProps> = ({
  searchTerm,
  onSearchChange,
  barcodeValue,
  onBarcodeChange,
}) => {
  return (
    <div className="flex items-center gap-4 bg-card backdrop-blur-3xl p-2.5 rounded-[1.5rem] border border-border shadow-2xl shadow-slate-200/50 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />

      {/* Barcode Input Support */}
      <div className="relative group w-72 h-full">
        <ScanLine className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary group-focus-within:animate-pulse z-10" />
        <Input
          className="pl-14 h-12 bg-secondary text-foreground border-none rounded-xl text-[10px] font-black italic placeholder:text-muted-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/50 select-all shadow-xl transition-all group-hover:scale-[1.01] relative z-0"
          placeholder="SCAN BUFFER READY..."
          value={barcodeValue}
          onChange={(e) => onBarcodeChange(e.target.value)}
          autoFocus
        />
        <div className="absolute inset-0 bg-primary/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity -z-10" />
      </div>

      {/* Search Input */}
      <div className="relative flex-1 group h-full">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
        <Input
          className="pl-14 h-12 bg-card backdrop-blur-md border border-border rounded-xl text-xs font-bold italic placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-indigo-500/30 shadow-inner group-hover:bg-muted transition-all relative z-0"
          placeholder="SEARCH SECTOR INVENTORY..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  );
};
