import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RefreshCw, ScanLine } from "lucide-react";

export type OpnameEntry = {
  id: string;
  sku: string;
  name: string;
  expected: number;
  counted: number | "";
  status?: string;
  categoryId?: string;
};

interface OpnameTableProps {
  entries: OpnameEntry[];
  isLoading: boolean;
  onCountChange: (index: number, value: string) => void;
  statusBadge: (status: string) => string;
}

export const OpnameTable: React.FC<OpnameTableProps> = ({
  entries,
  isLoading,
  onCountChange,
  statusBadge,
}) => {
  return (
    <div className="rounded-2xl border-none shadow-xl overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {[
                "#",
                "SKU",
                "Item Name",
                "Expected",
                "Counted",
                "Variance",
                "Status",
              ].map((h, i) => (
                <th
                  key={i}
                  className="px-6 py-4 text-left text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground italic"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                    <span className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground">
                      Syncing Inventory State...
                    </span>
                  </div>
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-24 text-center">
                  <div className="flex flex-col items-center gap-4 opacity-30">
                    <div className="w-16 h-16 rounded-3xl bg-secondary/10 flex items-center justify-center">
                      <ScanLine className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-black italic uppercase tracking-tighter">
                        Awaiting Scans
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mt-1">
                        Scan barcodes to begin physical count audit
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              (Array.isArray(entries) ? entries : []).map((entry, i) => {
                const variance =
                  entry.counted !== ""
                    ? Number(entry.counted) - entry.expected
                    : null;
                return (
                  <tr
                    key={entry.id || i}
                    className="group border-b border-border last:border-none hover:bg-secondary/5 transition-colors"
                  >
                    <td className="px-6 py-4 text-[11px] text-muted-foreground font-bold">
                      {i + 1}
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-muted-foreground font-bold">
                      {entry.sku}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-black italic text-sm text-foreground">
                        {entry.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold italic text-muted-foreground">
                      {entry.expected}
                    </td>
                    <td className="px-6 py-4">
                      <Input
                        type="number"
                        min="0"
                        value={entry.counted}
                        onChange={(e) => onCountChange(i, e.target.value)}
                        className="w-24 h-10 rounded-xl font-black italic text-center border-border focus:ring-blue-600 bg-secondary/5"
                      />
                    </td>
                    <td className="px-6 py-4">
                      {variance !== null ? (
                        <span
                          className={cn(
                            "font-black italic text-sm",
                            variance === 0
                              ? "text-success"
                              : variance > 0
                                ? "text-primary"
                                : "text-destructive",
                          )}
                        >
                          {variance > 0 ? "+" : ""}
                          {variance}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 font-bold italic text-sm">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {entry.status && (
                        <Badge
                          className={cn(
                            "border-none font-black italic text-[9px] uppercase tracking-widest px-3",
                            statusBadge(entry.status),
                          )}
                        >
                          {entry.status}
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
