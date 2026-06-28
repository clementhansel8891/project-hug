/**
 * ElectronicPaymentModal — POS electronic payment dialog (card/QRIS/wallet).
 *
 * Wired with: React Hook Form + Zod + useMutation + apiRequest + toast + cache invalidation.
 * Preserves existing category/channel selection UI while adding mutation wiring.
 *
 * Requirements: 1 (Form Fields), 2 (Validation), 3 (API Submission),
 *               4 (Loading State), 5 (Error Handling), 6 (Success Handling),
 *               10 (Consistent Pattern)
 */

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard,
  QrCode,
  Smartphone,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { getMutationToastHandlers } from "@/lib/modal-helpers";

// ─── Zod Schema (co-located) ───────────────────────────────────────────────────

const electronicPaymentSchema = z.object({
  paymentMethod: z.enum(["CARD", "QRIS", "WALLET"], {
    required_error: "Payment method is required",
  }),
  channel: z.string().min(1, "Payment channel is required"),
  notes: z.string().max(500).optional().default(""),
});

export type ElectronicPaymentFormValues = z.infer<typeof electronicPaymentSchema>;

// ─── Props ──────────────────────────────────────────────────────────────────────

interface ElectronicPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  isProcessing?: boolean;
  onConfirm: (method: "CARD" | "QRIS" | "WALLET", channel?: string, notes?: string) => void;
  /** Cart items for the transaction (passed from parent CashierPOS) */
  cartItems?: Array<{
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    discount?: number;
    taxRate?: number;
  }>;
  /** Store ID from retail context */
  storeId?: string;
  /** Shift ID from retail context */
  shiftId?: string;
  /** Idempotency key for the transaction */
  idempotencyKey?: string;
  /** Currency code */
  currency?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const ElectronicPaymentModal: React.FC<ElectronicPaymentModalProps> = ({
  isOpen,
  onClose,
  total,
  isProcessing: externalProcessing,
  onConfirm,
  cartItems,
  storeId,
  shiftId,
  idempotencyKey,
  currency = "IDR",
}) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedMain, setSelectedMain] = useState<"CARD" | "QRIS" | "WALLET" | null>(null);
  const [notes, setNotes] = useState("");

  // ─── React Hook Form ────────────────────────────────────────────────────────
  const form = useForm<ElectronicPaymentFormValues>({
    resolver: zodResolver(electronicPaymentSchema),
    defaultValues: {
      paymentMethod: undefined,
      channel: "",
      notes: "",
    },
  });

  // ─── useMutation ─────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (data: ElectronicPaymentFormValues) => {
      const paymentMethodMap: Record<string, string> = {
        CARD: "card",
        QRIS: "qr",
        WALLET: "wallet",
      };

      const payload = {
        store_id: storeId,
        terminal_id: "terminal-pos",
        items: cartItems || [],
        payment_method: paymentMethodMap[data.paymentMethod] || "card",
        payment_received: total,
        grand_total: total,
        shift_id: shiftId,
        currency,
        payment_channel: data.channel,
        notes: data.notes || undefined,
      };

      return apiRequest("/v1/retail/checkout", "POST", session, payload, {
        correlationId: idempotencyKey,
      });
    },
    ...getMutationToastHandlers({
      toast,
      queryClient,
      keys: [["retail", "pos", "transactions"], ["retail", "inventory"]],
      onClose: () => {
        setSelectedMain(null);
        setNotes("");
        onClose();
      },
      form,
      successTitle: "Payment Authorized",
      successDescription: "Electronic payment processed successfully.",
    }),
  });

  const isPending = mutation.isPending || externalProcessing;

  // ─── Handle channel selection (triggers submission) ───────────────────────────
  const handleChannelSelect = (method: "CARD" | "QRIS" | "WALLET", channelId: string) => {
    if (isPending) return;

    // Update form values
    form.setValue("paymentMethod", method);
    form.setValue("channel", channelId);
    form.setValue("notes", notes);

    // If we have cart data, submit via mutation; otherwise fall back to callback
    if (cartItems && storeId) {
      mutation.mutate({
        paymentMethod: method,
        channel: channelId,
        notes,
      });
    } else {
      // Fallback: delegate to parent's onConfirm for backward compatibility
      onConfirm(method, channelId, notes);
    }
  };

  const handleClose = () => {
    if (isPending) return;
    setSelectedMain(null);
    setNotes("");
    form.reset();
    onClose();
  };

  const channels = {
    CARD: [
      { id: "VISA", name: "Visa", icon: <CreditCard className="w-5 h-5" /> },
      { id: "MASTERCARD", name: "Mastercard", icon: <CreditCard className="w-5 h-5" /> },
      { id: "DEBIT", name: "Debit Card", icon: <CreditCard className="w-5 h-5" /> },
    ],
    QRIS: [
      { id: "QRIS_GOPAY", name: "Gopay", icon: <Smartphone className="w-5 h-5" /> },
      { id: "QRIS_OVO", name: "OVO", icon: <Smartphone className="w-5 h-5" /> },
      { id: "QRIS_SHOPEEPAY", name: "ShopeePay", icon: <Smartphone className="w-5 h-5" /> },
    ],
    WALLET: [
      { id: "DANA", name: "DANA", icon: <Smartphone className="w-5 h-5" /> },
      { id: "LINKAJA", name: "LinkAja", icon: <Smartphone className="w-5 h-5" /> },
    ],
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        className="sm:max-w-[600px] p-0 overflow-hidden border-none bg-background text-foreground rounded-[2rem] shadow-2xl"
        aria-describedby="electronic-payment-modal-description"
      >
        <div className="p-10 space-y-10">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <CreditCard className="w-7 h-7" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-widest italic text-foreground">
                  Electronic Payment
                </DialogTitle>
                <p
                  id="electronic-payment-modal-description"
                  className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest"
                >
                  Select card, QRIS, or digital wallet
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Amount Due Area */}
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex flex-col items-center justify-center gap-1">
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] italic">
              Authorization Amount
            </span>
            <div className="text-5xl font-black italic tracking-tighter text-foreground">
              Rp {total.toLocaleString()}
            </div>
          </div>

          <fieldset disabled={isPending} className="space-y-6">
            {/* Main Categories */}
            <div className="grid grid-cols-3 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedMain("CARD")}
                className={`h-24 rounded-2xl flex flex-col gap-2 transition-all border-border ${
                  selectedMain === "CARD"
                    ? "bg-primary border-primary text-primary-foreground shadow-lg"
                    : "bg-secondary/50 hover:bg-secondary text-muted-foreground"
                }`}
              >
                <CreditCard className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Credit/Debit
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedMain("QRIS")}
                className={`h-24 rounded-2xl flex flex-col gap-2 transition-all border-border ${
                  selectedMain === "QRIS"
                    ? "bg-primary border-primary text-primary-foreground shadow-lg"
                    : "bg-secondary/50 hover:bg-secondary text-muted-foreground"
                }`}
              >
                <QrCode className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  QRIS
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedMain("WALLET")}
                className={`h-24 rounded-2xl flex flex-col gap-2 transition-all border-border ${
                  selectedMain === "WALLET"
                    ? "bg-primary border-primary text-primary-foreground shadow-lg"
                    : "bg-secondary/50 hover:bg-secondary text-muted-foreground"
                }`}
              >
                <Smartphone className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  E-Wallet
                </span>
              </Button>
            </div>

            {/* Sub-Channels Grid */}
            <div className="min-h-[160px]">
              {selectedMain ? (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {(Array.isArray(channels[selectedMain]) ? channels[selectedMain] : []).map((ch) => (
                    <Button
                      key={ch.id}
                      type="button"
                      variant="outline"
                      onClick={() => handleChannelSelect(selectedMain, ch.id)}
                      disabled={isPending}
                      className="h-16 bg-secondary/50 border-border hover:bg-secondary hover:border-primary/50 text-foreground rounded-2xl flex items-center justify-start px-6 gap-4"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {ch.icon}
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-widest">
                        {ch.name}
                      </span>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground italic text-[10px] font-bold uppercase tracking-[0.3em]">
                  Please Select Payment Type
                </div>
              )}
            </div>

            {/* TRANSACTION NOTES */}
            <div className="flex flex-col gap-2 mt-4">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-2">
                Transaction Notes
              </span>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add optional notes for this order..."
                disabled={isPending}
                className="bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl resize-none h-16 font-bold italic text-sm focus-visible:ring-primary/20 focus-visible:border-primary"
              />
            </div>
          </fieldset>

          {/* Processing Overlay */}
          {isPending && (
            <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur-sm p-8 flex flex-col items-center justify-center gap-4 animate-in fade-in">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground">
                Waiting for authorization...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
