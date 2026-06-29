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
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Info,
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

type AuthType = "bearer" | "api-key" | "basic";

type DeliveryLog = {
  id: string;
  timestamp: string;
  event: string;
  statusCode: number;
  latencyMs: number;
  success: boolean;
};

const BRIDGE_EVENTS = [
  { key: "orders.created", label: "Order Created" },
  { key: "orders.updated", label: "Order Updated" },
  { key: "orders.cancelled", label: "Order Cancelled" },
  { key: "orders.fulfilled", label: "Order Fulfilled" },
  { key: "inventory.updated", label: "Inventory Updated" },
  { key: "inventory.low_stock", label: "Low Stock Alert" },
  { key: "refund.issued", label: "Refund Issued" },
  { key: "customer.created", label: "Customer Created" },
];

// Delivery logs fetched from backend (Task 13.2)

export const WebhookBridgeSettingsPanel: React.FC<Props> = ({
  channel,
  session,
  onUpdated,
}) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    error?: string;
  } | null>(null);

  // Delivery logs fetched from backend
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  // Form state
  const [targetUrl, setTargetUrl] = useState("");
  const [authType, setAuthType] = useState<AuthType>("bearer");
  const [authValue, setAuthValue] = useState("");
  const [customHeader, setCustomHeader] = useState("");
  const [retryPolicy, setRetryPolicy] = useState("3x");
  const [enabledEvents, setEnabledEvents] = useState<Set<string>>(
    new Set((Array.isArray(BRIDGE_EVENTS) ? BRIDGE_EVENTS : []).map((e) => e.key)),
  );

  useEffect(() => {
    const s = (channel.settings ?? {}) as Record<string, string>;
    setTargetUrl(s.targetUrl ?? "");
    setAuthType((s.authType as AuthType) ?? "bearer");
    setAuthValue(s.authValue ?? "");
    setCustomHeader(s.customHeader ?? "");
    setRetryPolicy(s.retryPolicy ?? "3x");
    const events = s.enabledEvents
      ? (JSON.parse(s.enabledEvents) as string[])
      : (Array.isArray(BRIDGE_EVENTS) ? BRIDGE_EVENTS : []).map((e) => e.key);
    setEnabledEvents(new Set(events));
    setTestResult(null);
  }, [channel.id, channel.settings]);

  // Fetch delivery logs from backend
  useEffect(() => {
    if (!channel.id || !session?.tenant_id) return;
    const fetchLogs = async () => {
      setIsLoadingLogs(true);
      setLogError(null);
      try {
        const data = await ecommerceHubService.getChannelDeliveryLogs?.(session, channel.id);
        setDeliveryLogs(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.warn("Failed to fetch delivery logs", err);
        setLogError("Failed to load delivery log");
        setDeliveryLogs([]);
      } finally {
        setIsLoadingLogs(false);
      }
    };
    fetchLogs();
  }, [channel.id, session?.tenant_id]);

  const toggleEvent = (key: string) => {
    setEnabledEvents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleTest = async () => {
    if (!targetUrl) {
      toast({ title: "Enter a Target URL first", variant: "destructive" });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await ecommerceHubService.testChannelConnection(
        session,
        channel.id,
      );
      setTestResult(res);
      if (res.success) {
        toast({
          title: "Connection successful",
          description: `Responded in ${res.latencyMs}ms`,
        });
      } else {
        toast({
          title: "Connection failed",
          description: res.error ?? "Endpoint did not respond",
          variant: "destructive",
        });
      }
    } catch {
      setTestResult({
        success: false,
        latencyMs: 0,
        error: "Request error — check the URL and auth settings",
      });
      toast({ title: "Test failed", variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await ecommerceHubService.updateChannel(session, channel.id, {
        settings: {
          ...((channel.settings as Record<string, string>) ?? {}),
          targetUrl,
          authType,
          authValue,
          customHeader,
          retryPolicy,
          enabledEvents: JSON.stringify([...enabledEvents]),
        },
      });
      toast({ title: "Bridge settings saved" });
      onUpdated();
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const authLabel: Record<AuthType, string> = {
    bearer: "Bearer Token",
    "api-key": "API Key (Header Value)",
    basic: "Basic Auth (user:pass base64)",
  };

  return (
    <div className="space-y-8">
      {/* ── Connection Config ── */}
      <div className="space-y-4">
        <div>
          <h3 className="font-black italic text-foreground text-sm">
            SaaS Connection
          </h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
            Configure the target SaaS endpoint
          </p>
        </div>

        <div className="space-y-4">
          {/* Target URL */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Target URL *
            </Label>
            <div className="flex gap-2">
              <Input
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://hooks.yoursaas.io/estelagea-ingest"
                className="flex-1 h-11 rounded-xl font-bold text-sm"
              />
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting || !targetUrl}
                className={cn(
                  "h-11 px-4 rounded-xl font-black italic text-xs gap-1.5 shrink-0 border-2 transition-all",
                  testResult?.success === true &&
                    "border-success text-success bg-success",
                  testResult?.success === false &&
                    "border-destructive text-destructive bg-destructive",
                  !testResult && "border-border",
                )}
              >
                {isTesting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : testResult?.success === true ? (
                  <Wifi className="w-3.5 h-3.5" />
                ) : testResult?.success === false ? (
                  <WifiOff className="w-3.5 h-3.5" />
                ) : (
                  <Wifi className="w-3.5 h-3.5" />
                )}
                {isTesting ? "Testing…" : "Test"}
              </Button>
            </div>
            {testResult && (
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold",
                  testResult.success
                    ? "bg-success text-success"
                    : "bg-destructive text-destructive",
                )}
              >
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Reachable
                    in {testResult.latencyMs}ms
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{" "}
                    {testResult.error ?? "Connection failed"}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Auth */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Auth Type
              </Label>
              <Select
                value={authType}
                onValueChange={(v) => setAuthType(v as AuthType)}
              >
                <SelectTrigger className="h-11 rounded-xl font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bearer" className="font-bold">
                    Bearer Token
                  </SelectItem>
                  <SelectItem value="api-key" className="font-bold">
                    API Key Header
                  </SelectItem>
                  <SelectItem value="basic" className="font-bold">
                    Basic Auth
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {authLabel[authType]}
              </Label>
              <Input
                type="password"
                value={authValue}
                onChange={(e) => setAuthValue(e.target.value)}
                placeholder="Your secret token or credential"
                className="h-11 rounded-xl font-bold text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Custom Header Name (optional)
              </Label>
              <Input
                value={customHeader}
                onChange={(e) => setCustomHeader(e.target.value)}
                placeholder="e.g. X-Api-Key, X-Store-Secret"
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
                  <SelectItem value="1x" className="font-bold">
                    1 attempt (no retry)
                  </SelectItem>
                  <SelectItem value="3x" className="font-bold">
                    3 attempts — exponential backoff
                  </SelectItem>
                  <SelectItem value="5x" className="font-bold">
                    5 attempts — high reliability
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Event Map ── */}
      <div className="space-y-3">
        <div>
          <h3 className="font-black italic text-foreground text-sm">
            Event Forwarding Map
          </h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
            Select which Estela Gea events are forwarded to your SaaS
          </p>
        </div>
        <div className="rounded-2xl border border-border overflow-hidden divide-y divide-slate-50">
          {(Array.isArray(BRIDGE_EVENTS) ? BRIDGE_EVENTS : []).map((ev) => (
            <div
              key={ev.key}
              className="flex items-center justify-between px-4 py-3 hover:bg-secondary/5 transition-colors"
            >
              <div>
                <div className="font-black italic text-muted-foreground text-xs">
                  {ev.label}
                </div>
                <code className="text-[10px] text-muted-foreground font-mono">
                  {ev.key}
                </code>
              </div>
              <Switch
                checked={enabledEvents.has(ev.key)}
                onCheckedChange={() => toggleEvent(ev.key)}
                className="shrink-0"
              />
            </div>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground italic">
          <Info className="w-3 h-3 shrink-0" />
          {enabledEvents.size} of {BRIDGE_EVENTS.length} events will be
          forwarded to your SaaS endpoint.
        </p>
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
        {isSaving ? "Saving…" : "Save Bridge Settings"}
      </Button>

      {/* ── Delivery Log ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black italic text-foreground text-sm">
            Delivery Log
          </h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {isLoadingLogs ? "Loading…" : `${deliveryLogs.length} deliveries`}
          </span>
        </div>
        {isLoadingLogs && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoadingLogs && logError && (
          <div className="text-sm text-destructive text-center py-4">{logError}</div>
        )}
        {!isLoadingLogs && !logError && deliveryLogs.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">No delivery logs yet.</div>
        )}
        {!isLoadingLogs && !logError && deliveryLogs.length > 0 && (
          <div className="rounded-2xl border border-border overflow-hidden divide-y divide-slate-50">
            {deliveryLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/5 transition-colors"
              >
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                    log.success ? "bg-success" : "bg-destructive",
                  )}
                >
                  {log.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] font-mono font-bold text-muted-foreground">
                      {log.event}
                    </code>
                    <Badge
                      className={cn(
                        "text-[9px] font-black border-none px-1.5 py-0",
                        log.success
                          ? "bg-success text-success"
                          : "bg-destructive text-destructive",
                      )}
                    >
                      {log.statusCode}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-muted-foreground font-bold">
                      {log.timestamp}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-bold">
                      ·
                    </span>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-muted-foreground font-bold">
                      {log.latencyMs}ms
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
