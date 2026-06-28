import React from "react";
import { CopyPill } from "../shared/SharedUI";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  ShoppingBag,
  Link2,
  Activity,
  ShieldCheck,
  ArrowRight,
  Settings2,
  Key,
} from "lucide-react";
import type { ChannelRecord } from "@/core/services/retail/ecommerceHubService";
import type { SessionContext } from "@/core/security/session";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface ChannelListItemProps {
  channel: ChannelRecord;
  session: SessionContext;
  branchIds: string[];
  gatewayUrl: string;
  channelSecrets: Record<string, { clientId: string; clientSecret: string }>;
  onOpenDetail: (channel: ChannelRecord) => void;
  copyCredential: (value: string, label: string) => void;
}

export const ChannelListItem = ({
  channel,
  session,
  branchIds,
  gatewayUrl,
  channelSecrets,
  onOpenDetail,
  copyCredential,
}: ChannelListItemProps) => {
  const resolveChannelClientId = (ch: ChannelRecord) =>
    ch.clientId ??
    (ch.credentials as Record<string, unknown>)?.clientId ??
    ch.channelId ??
    "";

  const resolveChannelSecret = (ch: ChannelRecord) =>
    channelSecrets[ch.id]?.clientSecret ??
    (ch.credentials as Record<string, unknown>)?.clientSecret ??
    ch.clientSecret ??
    "";

  const resolveChannelConnector = (ch: ChannelRecord) =>
    ch.connector ?? ch.name ?? "";

  const resolveChannelTenantId = (ch: ChannelRecord) =>
    ch.tenantId ?? ch.tenantId ?? session.tenant_id;

  const resolveChannelBranchId = (ch: ChannelRecord) =>
    (ch as unknown as { branchIds?: string[] }).branchIds?.[0] ??
    ch.branchId ??
    ((ch.credentials as Record<string, unknown>)?.branchId as string) ??
    branchIds[0];

  const resolveChannelGatewayUrl = (ch: ChannelRecord) =>
    ch.gatewayUrl ??
    (ch.credentials as Record<string, unknown>)?.gatewayUrl ??
    gatewayUrl;

  const clientId = resolveChannelClientId(channel);
  const secret = resolveChannelSecret(channel);
  const connector = resolveChannelConnector(channel);
  const tenantId = resolveChannelTenantId(channel);
  const branch = resolveChannelBranchId(channel);
  const gateway = resolveChannelGatewayUrl(channel);

  return (
    <div
      key={channel.id}
      className="group hover:bg-secondary/5 transition-all border-b border-border last:border-none"
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-6 p-8">
        <div className="flex items-center gap-6 flex-1">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-500">
            {channel.integrationCategory === "PRESET" ? (
              <ShoppingBag className="w-8 h-8 text-primary" />
            ) : (
              <Globe className="w-8 h-8 text-success" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-black italic text-foreground tracking-tight uppercase italic">
                {channel.name}
              </h4>
              <Badge
                className={
                  channel.status === "active"
                    ? "bg-success text-success border-none font-black italic text-[8px] uppercase"
                    : "bg-secondary/10 text-muted-foreground border-none font-black italic text-[8px] uppercase"
                }
              >
                {channel.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest italic">
              {channel.type} • Node {channel.id.slice(0, 8)}
              <Separator orientation="vertical" className="h-2 bg-muted/20" />
              <span className="text-primary">
                {channel.syncFrequency || "LIVE"} SYNC
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:flex items-center gap-4 lg:gap-8">
          <div className="space-y-1">
            <div className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">
              Tenant Scope
            </div>
            <div className="text-[11px] font-black text-muted-foreground italic">
              {tenantId}
            </div>
          </div>
          <Separator
            orientation="vertical"
            className="hidden lg:block h-8 bg-muted/20"
          />
          <div className="space-y-1">
            <div className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">
              Operational Unit
            </div>
            <div className="text-[11px] font-black text-muted-foreground italic">
              {branch}
            </div>
          </div>
          <Separator
            orientation="vertical"
            className="hidden lg:block h-8 bg-muted/20"
          />
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => onOpenDetail(channel)}
              className="w-12 h-12 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all p-0"
            >
              <Settings2 className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => onOpenDetail(channel)}
              className="h-12 px-6 rounded-xl bg-secondary border-none font-black italic uppercase text-[9px] tracking-widest flex items-center gap-2 group/btn"
            >
              Vault{" "}
              <Key className="w-3 h-3 group-hover/btn:rotate-12 transition-transform text-warning" />
            </Button>
          </div>
        </div>
      </div>

      {/* Credentials Quick-Access */}
      <div className="px-8 pb-8 flex flex-wrap gap-2">
        {[
          { label: "Gateway", value: gateway, icon: Globe },
          { label: "Client ID", value: clientId, icon: ShieldCheck },
          { label: "Secret", value: secret, icon: Key, isMasked: true },
        ].map((cred, idx) => (
          <button
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              copyCredential(cred.value as string, cred.label);
            }}
            className="h-10 px-4 bg-card border border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all flex items-center gap-3 group/cred"
          >
            <cred.icon className="w-3.5 h-3.5 text-muted-foreground group-hover/cred:text-primary transition-colors" />
            <div className="flex flex-col items-start leading-none text-left">
              <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">
                {cred.label}
              </span>
              <div className="font-mono text-[9px] font-bold text-muted-foreground bg-secondary/5 px-2 py-0.5 rounded truncate max-w-[120px]">
                {cred.isMasked && cred.value
                  ? "••••••••"
                  : (cred.value as string) || "NOT_ISSUED"}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
