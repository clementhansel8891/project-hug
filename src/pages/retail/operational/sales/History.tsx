import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Receipt,
  Calendar,
  Clock,
  CreditCard,
  Banknote,
  Smartphone,
  RotateCcw,
  Package,
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useModuleList } from "@/hooks/useModuleQuery";
import { QueryStateWrapper } from "@/components/shared/QueryStateWrapper";
import { useApp } from "@/contexts/AppContext";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";

// ---------------------------------------------------------------------------
// Zod Schema — Refund Form
// ---------------------------------------------------------------------------

const refundSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500, "Reason must be 500 characters or fewer"),
});

type RefundFormValues = z.infer<typeof refundSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TransactionItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface TransactionRecord {
  id: string;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  paymentMethod: "cash" | "card" | "qr" | "store_credit";
  cashierId: string;
  customerName?: string;
  createdAt: string;
  updatedAt: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

const paymentIcons = {
  cash: Banknote,
  card: CreditCard,
  qr: Smartphone,
  store_credit: CreditCard,
  mobile: Smartphone,
};

const paymentLabels: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  qr: "Mobile",
  store_credit: "Store Credit",
  mobile: "Mobile",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  completed: { label: "Completed", variant: "default" },
  complete: { label: "Completed", variant: "default" },
  paid: { label: "Paid", variant: "default" },
  refunded: { label: "Refunded", variant: "secondary" },
  voided: { label: "Voided", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  pending: { label: "Pending", variant: "secondary" },
  processing: { label: "Processing", variant: "secondary" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizePaymentMethod(method: string | undefined): string {
  if (!method) return "cash";
  const lower = method.toLowerCase();
  if (lower === "qr" || lower === "mobile") return "mobile";
  if (lower === "card") return "card";
  if (lower === "store_credit") return "store_credit";
  return "cash";
}

function getStatusConfig(status: string) {
  return statusConfig[status] ?? { label: status, variant: "secondary" as const };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RetailHistory() {
  const { state } = useApp();
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRecord | null>(null);
  const [isRefundOpen, setIsRefundOpen] = useState(false);

  // ─── Refund Form ────────────────────────────────────────────────────────────
  const refundForm = useForm<RefundFormValues>({
    resolver: zodResolver(refundSchema),
    defaultValues: { reason: "" },
  });

  const refundMutation = useMutation({
    mutationFn: (data: RefundFormValues) =>
      apiRequest(`/v1/retail/orders/${selectedTransaction?.id}/refund`, "POST", session, {
        reason: data.reason,
      }),
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "orders"]],
      onClose: () => {
        setIsRefundOpen(false);
        setSelectedTransaction(null);
      },
      form: refundForm,
      successTitle: "Refund Issued",
      successDescription: "The transaction has been refunded successfully.",
    }),
  });

  const handleOpenRefund = () => {
    refundForm.reset({ reason: "" });
    setIsRefundOpen(true);
  };

  const handleCloseRefund = () => {
    if (refundMutation.isPending) return;
    refundForm.reset();
    setIsRefundOpen(false);
  };

  const onRefundSubmit = refundForm.handleSubmit((data) => refundMutation.mutate(data));

  // Fetch transactions from backend using shared TanStack Query hook
  const {
    data: transactionsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useModuleList<TransactionRecord>("/v1/retail/orders", {
    page,
    pageSize: PAGE_SIZE,
    filters: {
      store_id: state.settings.defaultLocationId || undefined,
    },
  });

  // Extract records from paginated response (handle both paginated envelope and raw array)
  const transactions: TransactionRecord[] = useMemo(() => {
    const rawData = transactionsData?.data ?? (Array.isArray(transactionsData) ? (transactionsData as unknown as TransactionRecord[]) : []);
    // Sort by date descending (most recent first)
    return [...rawData].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [transactionsData]);

  // Pagination metadata
  const totalCount = transactionsData?.totalCount ?? transactions.length;
  const totalPages = transactionsData?.totalPages ?? Math.ceil(totalCount / PAGE_SIZE);
  const currentPage = transactionsData?.currentPage ?? page;

  // Client-side filters (applied on top of the fetched page)
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch =
        searchTerm === "" ||
        t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.items || []).some((item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      const matchesStatus =
        statusFilter === "all" || t.status === statusFilter;
      const normalizedPm = normalizePaymentMethod(t.paymentMethod);
      const matchesPayment =
        paymentFilter === "all" || normalizedPm === paymentFilter;
      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [transactions, searchTerm, statusFilter, paymentFilter]);

  // Calculate stats from current page data
  const todayTotal = useMemo(
    () =>
      transactions
        .filter((t) => t.status === "completed" || t.status === "complete" || t.status === "paid")
        .reduce((sum, t) => sum + (t.totalAmount || 0), 0),
    [transactions]
  );
  const transactionCount = transactions.length;
  const refundCount = useMemo(
    () => transactions.filter((t) => t.status === "refunded").length,
    [transactions]
  );

  // Pagination handlers
  const goToPreviousPage = () => setPage((p) => Math.max(1, p - 1));
  const goToNextPage = () => setPage((p) => Math.min(totalPages || 1, p + 1));

  return (
    <div className="p-4 space-y-4 h-full flex flex-col">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-xl font-bold">{formatCurrency(todayTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/50">
                <Package className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-xl font-bold">{transactionCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <RotateCcw className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Refunds</p>
                <p className="text-xl font-bold">{refundCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID or product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="mobile">Mobile</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transaction List with QueryStateWrapper */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 flex flex-col">
          <QueryStateWrapper
            isLoading={isLoading}
            isError={isError}
            error={error ?? undefined}
            isEmpty={filteredTransactions.length === 0 && !isLoading}
            onRetry={refetch}
            emptyMessage="No transactions found. Sales will appear here once transactions are processed."
          >
            <ScrollArea className="h-[calc(100vh-26rem)]">
              <div className="divide-y">
                {filteredTransactions.map((transaction) => {
                  const pmKey = normalizePaymentMethod(transaction.paymentMethod);
                  const PaymentIcon = paymentIcons[pmKey as keyof typeof paymentIcons] ?? CreditCard;
                  const status = getStatusConfig(transaction.status);

                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedTransaction(transaction)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-muted">
                          <Receipt className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {transaction.id.slice(0, 8)}...
                            </span>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {(transaction.items || []).length} item
                            {(transaction.items || []).length !== 1 ? "s" : ""} •{" "}
                            {(transaction.items || [])
                              .slice(0, 2)
                              .map((i) => i.name)
                              .join(", ")}
                            {(transaction.items || []).length > 2 ? "…" : ""}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <User className="h-3 w-3 inline mr-1" />
                            {transaction.cashierId || "Staff"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p
                            className={cn(
                              "font-semibold",
                              transaction.status === "refunded" &&
                                "text-destructive line-through"
                            )}
                          >
                            {formatCurrency(transaction.totalAmount)}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(transaction.createdAt)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTime(transaction.createdAt)}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-muted" title={paymentLabels[pmKey] ?? pmKey}>
                          <PaymentIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </QueryStateWrapper>

          {/* Pagination Controls */}
          {!isLoading && !isError && filteredTransactions.length > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages || 1} ({totalCount} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm font-medium px-2">
                  {currentPage}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage >= (totalPages || 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-lg">{selectedTransaction.id}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(selectedTransaction.createdAt)}
                    <Clock className="h-4 w-4 ml-2" />
                    {formatTime(selectedTransaction.createdAt)}
                  </div>
                </div>
                <Badge variant={getStatusConfig(selectedTransaction.status).variant}>
                  {getStatusConfig(selectedTransaction.status).label}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Cashier: {selectedTransaction.cashierId || "Staff"}</span>
              </div>

              {/* Line items with quantities and line totals */}
              <div className="border rounded-lg divide-y">
                {(selectedTransaction.items || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between p-3">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <p className="font-medium">
                      {formatCurrency(item.totalPrice || item.quantity * item.unitPrice)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Grand total */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(selectedTransaction.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(selectedTransaction.tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                  <span>Grand Total</span>
                  <span className="text-primary">
                    {formatCurrency(selectedTransaction.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Payment method */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">Payment Method</span>
                <div className="flex items-center gap-2">
                  {(() => {
                    const pmKey = normalizePaymentMethod(selectedTransaction.paymentMethod);
                    const Icon = paymentIcons[pmKey as keyof typeof paymentIcons] ?? CreditCard;
                    return <Icon className="h-4 w-4" />;
                  })()}
                  <span className="capitalize font-medium">
                    {paymentLabels[normalizePaymentMethod(selectedTransaction.paymentMethod)] ??
                      selectedTransaction.paymentMethod}
                  </span>
                </div>
              </div>

              {selectedTransaction.status === "completed" && (
                <Button variant="outline" className="w-full" onClick={handleOpenRefund}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Issue Refund
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={isRefundOpen} onOpenChange={(open) => { if (!open) handleCloseRefund(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Refund</DialogTitle>
          </DialogHeader>
          <form onSubmit={onRefundSubmit} noValidate>
            <fieldset disabled={refundMutation.isPending} className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Refunding transaction <span className="font-semibold">{selectedTransaction?.id}</span> for{" "}
                  <span className="font-semibold">{formatCurrency(selectedTransaction?.totalAmount ?? 0)}</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="refund-reason" className="text-sm font-medium">
                  Reason *
                </Label>
                <Textarea
                  id="refund-reason"
                  placeholder="Enter refund reason..."
                  {...refundForm.register("reason")}
                  aria-describedby={refundForm.formState.errors.reason ? "refund-reason-error" : undefined}
                  aria-invalid={!!refundForm.formState.errors.reason}
                  className="resize-none h-20"
                />
                {refundForm.formState.errors.reason && (
                  <p id="refund-reason-error" className="text-xs text-destructive" role="alert">
                    {refundForm.formState.errors.reason.message}
                  </p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={handleCloseRefund} disabled={refundMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={refundMutation.isPending}>
                  {refundMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Confirm Refund
                </Button>
              </div>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
