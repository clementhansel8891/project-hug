import React, { useState } from "react";
import { ChevronRight, ChevronDown, Loader2, AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ReportNode {
  accountCode: string;
  accountName: string;
  level: number;
  balance: number;
  isGroup: boolean;
  children?: ReportNode[];
}

interface HierarchicalReportTableProps {
  data: ReportNode[];
  title: string;
  /** Whether the underlying query is still loading. */
  isLoading?: boolean;
  /** Whether the underlying query errored. */
  isError?: boolean;
  /** Retry handler for the error state. */
  onRetry?: () => void;
  /** Message explaining why the report is empty (shown when data is empty). */
  emptyMessage?: string;
}

const ReportRow: React.FC<{ node: ReportNode; isExpanded: boolean; onToggle: () => void }> = ({
  node,
  isExpanded,
  onToggle,
}) => {
  return (
    <tr
      className={cn(
        "group border-b transition-colors hover:bg-muted/50",
        node.isGroup ? "bg-muted/30 font-semibold" : "bg-background"
      )}
    >
      <td className="p-3" style={{ paddingLeft: `${node.level * 1.5 + 0.75}rem` }}>
        <div className="flex items-center gap-2">
          {node.isGroup ? (
            <button
              onClick={onToggle}
              className="flex h-5 w-5 items-center justify-center rounded-sm hover:bg-muted"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <div className="w-5" />
          )}
          <span className="text-muted-foreground">{node.accountCode}</span>
          <span>{node.accountName}</span>
        </div>
      </td>
      <td className={cn("p-3 text-right", node.balance < 0 ? "text-destructive" : "")}>
        {new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(node.balance)}
      </td>
    </tr>
  );
};

const RecursiveRows: React.FC<{ node: ReportNode }> = ({ node }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <>
      <ReportRow
        node={node}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />
      {isExpanded && (Array.isArray(node.children) ? node.children : []).map((child) => (
        <RecursiveRows key={child.accountCode} node={child} />
      ))}
    </>
  );
};

export const HierarchicalReportTable: React.FC<HierarchicalReportTableProps> = ({
  data,
  title,
  isLoading,
  isError,
  onRetry,
  emptyMessage,
}) => {
  const rows = Array.isArray(data) ? data : [];
  const isEmpty = rows.length === 0;

  return (
    <div className="rounded-md border">
      <div className="bg-muted px-4 py-2 font-medium">{title}</div>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-3 text-left">Account</th>
            <th className="p-3 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {/* Loading */}
          {isLoading && (
            <tr>
              <td colSpan={2} className="p-10">
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm font-medium">Loading report…</span>
                </div>
              </td>
            </tr>
          )}

          {/* Error — distinct from empty */}
          {!isLoading && isError && (
            <tr>
              <td colSpan={2} className="p-10">
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Couldn&apos;t load this report</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    A problem occurred while retrieving ledger data. This is a system error, not a
                    lack of data.
                  </p>
                  {onRetry && (
                    <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 mt-1">
                      <RefreshCw className="h-3.5 w-3.5" /> Retry
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          )}

          {/* Populated */}
          {!isLoading && !isError && rows.map((root) => (
            <RecursiveRows key={root.accountCode} node={root} />
          ))}

          {/* Empty — explains WHY, distinct from error */}
          {!isLoading && !isError && isEmpty && (
            <tr>
              <td colSpan={2} className="p-10">
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Inbox className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-foreground">No ledger activity for this period</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    {emptyMessage ??
                      "No journal entries have been posted to this fiscal period yet. Once transactions are recorded (sales, purchases, payments, or manual journals), they will appear here automatically."}
                  </p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
