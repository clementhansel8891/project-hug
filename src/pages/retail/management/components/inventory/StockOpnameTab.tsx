import React, { useRef, useMemo } from "react";
import { ClipboardCheck, Edit3, ScanLine, Upload, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { OpnameSessionHeader } from "./opname/OpnameSessionHeader";
import { OpnameFilters } from "./opname/OpnameFilters";
import { OpnameTable, type OpnameEntry } from "./opname/OpnameTable";
import { InventoryFilters } from "./types";
import { UnresolvedBarcodesModal } from "@/components/shared/UnresolvedBarcodesModal";

interface OpnameEntryWithUnresolved extends OpnameEntry {
  barcode?: string;
}

type Props = {
  storeName?: string;
  opnameActive: boolean;
  opnameEntries: OpnameEntry[];
  unresolvedBarcodes: string[];
  filters: InventoryFilters;
  categoryOptions: { id: string; name: string }[];
  onFiltersChange: (patch: Partial<InventoryFilters>) => void;
  barcodeInput: string;
  onStart: () => void;
  onDiscard: () => void;
  onSubmit: () => void;
  onBarcodeChange: (val: string) => void;
  onBarcodeKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onCountChange: (index: number, value: string) => void;
  onResolveUnresolvedBarcodes: (barcodes: string[], resolveType: "flag" | "register") => void;
  isLoading?: boolean;
  statusBadge: (status: string) => string;
};

export const StockOpnameTab: React.FC<Props> = ({
  storeName,
  opnameActive,
  opnameEntries,
  unresolvedBarcodes,
  filters,
  categoryOptions,
  onFiltersChange,
  barcodeInput,
  onStart,
  onDiscard,
  onSubmit,
  onBarcodeChange,
  onBarcodeKeyDown,
  onCountChange,
  onResolveUnresolvedBarcodes,
  isLoading = false,
  statusBadge,
}) => {
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Hook into the global scanner
  useBarcodeScanner((barcode) => {
    if (opnameActive) {
      onBarcodeChange(barcode);
      // Simulate enter key to trigger the register logic in parent
      onBarcodeKeyDown({
        key: "Enter",
      } as React.KeyboardEvent<HTMLInputElement>);
    }
  });

  // Local filtering for the view
  const filteredEntries = useMemo(() => {
    return (Array.isArray(opnameEntries) ? opnameEntries : []).filter((entry) => {
      const matchesSearch =
        !filters.search ||
        entry.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        entry.sku.toLowerCase().includes(filters.search.toLowerCase());

      const matchesCategory =
        filters.category === "all" || entry.categoryId === filters.category;

      const matchesStatus =
        filters.status === "all" ||
        entry.status?.toLowerCase() === filters.status.toLowerCase();

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [opnameEntries, filters]);

  // Handle submit with unresolved barcodes check
  const handleSubmitWithUnresolvedCheck = () => {
    if (unresolvedBarcodes.length > 0) {
      // Show unresolved modal instead of submitting
      onResolveUnresolvedBarcodes(unresolvedBarcodes, "flag");
    } else {
      onSubmit();
    }
  };

  if (!opnameActive) {
    return (
      <Card className="rounded-2xl border border-border shadow-xl bg-card backdrop-blur-xl overflow-hidden">
        <CardContent className="p-6 text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto border border-primary/20">
            <ClipboardCheck className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase text-foreground">
              Stock Opname
            </h2>
            <p className="text-sm text-muted-foreground font-bold italic mt-2">
              Physical count &amp; reconciliation for{" "}
              <span className="text-primary">{storeName}</span>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-left max-w-lg mx-auto">
            {[
              {
                icon: Edit3,
                label: "Manual Input",
                desc: "Enter counts per row",
              },
              {
                icon: ScanLine,
                label: "Barcode Scan",
                desc: "Scan to increment",
              },
              {
                icon: Upload,
                label: "CSV Import",
                desc: "Upload count sheet",
              },
            ].map((m, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl p-5 text-center space-y-2 backdrop-blur-sm"
              >
                <m.icon className="w-5 h-5 text-primary mx-auto" />
                <div className="text-xs font-black italic uppercase text-foreground">
                  {m.label}
                </div>
                <div className="text-[10px] text-muted-foreground font-bold">
                  {m.desc}
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={onStart}
            className="h-14 px-12 rounded-2xl bg-primary text-primary-foreground font-black italic uppercase tracking-widest text-xs gap-2 shadow-xl hover:bg-primary/90 transition-all"
          >
            <Zap className="w-5 h-5" /> Start Opname Session
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <OpnameSessionHeader
        storeName={storeName}
        onDiscard={onDiscard}
        onSubmit={handleSubmitWithUnresolvedCheck}
      />

      <OpnameFilters
        filters={filters}
        categoryOptions={categoryOptions}
        onFiltersChange={onFiltersChange}
        barcodeInput={barcodeInput}
        onBarcodeChange={onBarcodeChange}
        onBarcodeKeyDown={onBarcodeKeyDown}
        barcodeRef={barcodeRef}
      />

      <OpnameTable
        entries={filteredEntries}
        isLoading={isLoading}
        onCountChange={(filteredIdx, val) => {
          // Map filtered index back to original index
          const originalEntry = filteredEntries[filteredIdx];
          const originalIdx = opnameEntries.findIndex(
            (e) => e.sku === originalEntry.sku,
          );
          if (originalIdx !== -1) {
            onCountChange(originalIdx, val);
          }
        }}
        statusBadge={statusBadge}
      />

      {/* Unresolved Barcodes Modal */}
      <UnresolvedBarcodesModal
        isOpen={false}
        onClose={() => {}}
        unresolvedBarcodes={unresolvedBarcodes}
        onFlagAnomalies={(barcodes) => onResolveUnresolvedBarcodes(barcodes, "flag")}
        onItemsRegistered={(items) => onResolveUnresolvedBarcodes(items.map(i => i.barcode || ""), "register")}
        categoryOptions={categoryOptions}
      />
    </div>
  );
};
