import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  RefreshCw,
  Copy,
  CheckCircle2,
  Info,
  ArrowDownToLine,
  ArrowUpFromLine,
  Key,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ecommerceHubService,
  type ChannelRecord,
} from "@/core/services/retail/ecommerceHubService";
import type { SessionContext } from "@/core/security/session";
import { cn } from "@/lib/utils";

interface Props {
  channel: ChannelRecord;
  session: SessionContext;
  onUpdated: () => void;
}

type WebhookEvent = {
  key: string;
  label: string;
  description: string;
  category: "order" | "inventory" | "customer" | "payment";
};

const WEBHOOK_EVENTS: WebhookEvent[] = [
  {
    key: "orders.created",
    label: "Order Created",
    description: "Fired when a new order is placed",
    category: "order",
  },
  {
    key: "orders.updated",
    label: "Order Updated",
    description: "Fired when order status or items change",
    category: "order",
  },
  {
    key: "orders.cancelled",
    label: "Order Cancelled",
    description: "Fired when an order is cancelled",
    category: "order",
  },
  {
    key: "orders.fulfilled",
    label: "Order Fulfilled",
    description: "Fired when all items are dispatched",
    category: "order",
  },
  {
    key: "inventory.updated",
    label: "Inventory Updated",
    description: "Fired when stock levels change",
    category: "inventory",
  },
  {
    key: "inventory.low_stock",
    label: "Low Stock Alert",
    description: "Fired when stock falls below threshold",
    category: "inventory",
  },
  {
    key: "refund.issued",
    label: "Refund Issued",
    description: "Fired when a refund is processed",
    category: "payment",
  },
  {
    key: "customer.created",
    label: "Customer Created",
    description: "Fired when a new customer record is created",
    category: "customer",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  order: "bg-primary/5 text-primary",
  inventory: "bg-warning text-warning",
  payment: "bg-success text-success",
  customer: "bg-primary text-primary",
};

export const WebhookSettingsPanel: React.FC<Props> = ({
  channel,
  session,
  onUpdated,
}) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Outbound settings
  const [outboundUrl, setOutboundUrl] = useState("");
  const [outboundAuth, setOutboundAuth] = useState("");
  const [retryPolicy, setRetryPolicy] = useState("3x");
  const [enabledEvents, setEnabledEvents] = useState<Set<string>>(new Set());

  // Inbound — generated, read-only
  const inboundUrl = `https://gateway.estelagea.io/webhooks/inbound/${channel.id}`;
  const hmacKey =
    (channel.settings as Record<string, string>)?.hmacKey ?? "••••••••••••••••";

  useEffect(() => {
    const s = (channel.settings ?? {}) as Record<string, string>;
    setOutboundUrl(s.outboundUrl ?? "");
    setOutboundAuth(s.outboundAuth ?? "");
    setRetryPolicy(s.retryPolicy ?? "3x");
    const events = s.enabledEvents
      ? (JSON.parse(s.enabledEvents) as string[])
      : [];
    setEnabledEvents(new Set(events));
  }, [channel.id, channel.settings]);

  const toggleEvent = (key: string) => {
    setEnabledEvents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const copy = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await ecommerceHubService.updateChannel(session, channel.id, {
        settings: {
          ...((channel.settings as Record<string, string>) ?? {}),
          outboundUrl,
          outboundAuth,
          retryPolicy,
          enabledEvents: JSON.stringify([...enabledEvents]),
        },
      });
      toast({ title: "Webhook settings saved" });
      onUpdated();
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRotateHmac = async () => {
    setIsRotating(true);
    try {
      await ecommerceHubService.rotateChannelCredentials(session, channel.id);
      toast({
        title: "HMAC key rotated",
        description: "All existing signatures are invalidated.",
      });
      onUpdated();
    } catch {
      toast({ title: "Rotation failed", variant: "destructive" });
    } finally {
      setIsRotating(false);
    }
  };

  const CopyBtn = ({ value, field }: { value: string; field: string }) => (
    <button
      onClick={() => copy(value, field)}
      className="p-1.5 rounded-lg hover:bg-secondary/10 transition-colors"
    >
      {copiedField === field ? (
        <CheckCircle2 className="w-4 h-4 text-success" />
      ) : (
        <Copy className="w-4 h-4 text-muted-foreground" />
      )}
    </button>
  );

  return (
    <div className="space-y-8">
      {/* ── Inbound Section ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <ArrowDownToLine className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-black italic text-foreground text-sm">
              Inbound Webhook
            </h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Estela Gea receives events
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border overflow-hidden divide-y divide-slate-100">
          {/* Inbound URL */}
          <div className="p-4 space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Listening Endpoint
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-secondary/5 border border-border rounded-xl px-4 py-3 truncate text-muted-foreground">
                {inboundUrl}
              </code>
              <CopyBtn value={inboundUrl} field="inbound" />
            </div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground italic">
              <Info className="w-3 h-3 shrink-0" />
              Point your external platform to this URL to send events to Estela Gea.
              All requests must be POST with JSON body.
            </p>
          </div>

          {/* HMAC Key */}
          <div className="p-4 space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              HMAC Signing Key
            </Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-secondary/5 border border-border rounded-xl px-4 py-3">
                <Key className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <code className="text-xs font-mono text-muted-foreground truncate">
                  {hmacKey}
                </code>
              </div>
              <CopyBtn value={hmacKey} field="hmac" />
              <Button
                size="sm"
                variant="outline"
                onClick={handleRotateHmac}
                disabled={isRotating}
                className="rounded-xl font-black italic text-xs gap-1.5 border-warning text-warning hover:bg-warning shrink-0"
              >
                <RotateCcw
                  className={cn("w-3.5 h-3.5", isRotating && "animate-spin")}
                />
                {isRotating ? "Rotating…" : "Rotate"}
              </Button>
            </div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground italic">
              <Info className="w-3 h-3 shrink-0" />
              Estela Gea will include an{" "}
              <code className="bg-secondary/10 px-1 rounded">
                X-Estela Gea-Signature
              </code>{" "}
              header with every inbound event for HMAC-SHA256 verification.
            </p>
          </div>
        </div>
      </div>

      {/* ── Outbound Section ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
            <ArrowUpFromLine className="w-4 h-4 text-success" />
          </div>
          <div>
            <h3 className="font-black italic text-foreground text-sm">
              Outbound Webhook
            </h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Estela Gea sends events to you
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Target URL
            </Label>
            <Input
              value={outboundUrl}
              onChange={(e) => setOutboundUrl(e.target.value)}
              placeholder="https://yoursystem.com/webhooks/estelagea"
              className="h-11 rounded-xl font-bold text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Authorization Header
              </Label>
              <Input
                type="password"
                value={outboundAuth}
                onChange={(e) => setOutboundAuth(e.target.value)}
                placeholder="Bearer your-token"
                className="h-11 rounded-xl font-bold text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Retry Policy
              </Label>
              <Select value={retryPolicy} onValueChange={setRetryPolicy}>
                <SelectTrigger className="h-11 rounded-xl font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    { value: "1x", label: "1 attempt (no retry)" },
                    { value: "3x", label: "3 attempts (recommended)" },
                    { value: "5x", label: "5 attempts (high reliability)" },
                  ].map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="font-bold"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Event Toggles */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Events to Forward
            </Label>
            <div className="rounded-2xl border border-border overflow-hidden divide-y divide-slate-50">
              {(Array.isArray(WEBHOOK_EVENTS) ? WEBHOOK_EVENTS : []).map((ev) => (
                <div
                  key={ev.key}
                  className="flex items-center justify-between px-4 py-3 hover:bg-secondary/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      className={cn(
                        "text-[9px] font-black border-none px-2 py-0.5",
                        CATEGORY_COLORS[ev.category],
                      )}
                    >
                      {ev.category}
                    </Badge>
                    <div>
                      <div className="font-black italic text-muted-foreground text-xs">
                        {ev.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-bold">
                        {ev.description}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={enabledEvents.has(ev.key)}
                    onCheckedChange={() => toggleEvent(ev.key)}
                    className="shrink-0"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full h-11 rounded-xl font-black italic bg-secondary gap-2"
      >
        {isSaving ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {isSaving ? "Saving…" : "Save Webhook Settings"}
      </Button>
    </div>
  );
};
