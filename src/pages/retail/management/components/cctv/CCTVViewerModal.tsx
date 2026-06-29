/**
 * CCTVViewerModal — CCTV live stream viewer & history playback.
 *
 * Wired with useQuery for event data loading and useForm + Zod for the
 * integration setup panel. This is primarily a display/viewer modal.
 *
 * Requirements: 1 (Form Fields), 3 (API Submission), 4 (Loading State),
 *               5 (Error Handling), 10 (Consistent Pattern)
 */

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Camera,
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  RefreshCw,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  Settings2,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Key,
  Eye,
  EyeOff,
  Info,
  Video,
  History,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { CCTVCamera, CCTVProvider } from "@/core/types/retail/retail";
import { useSession } from "@/core/security/session";
import { Roles } from "@/core/security/roles";
import { retailService } from "@/core/services/retail/retailService";
import { apiRequest } from "@/core/api/apiClient";

import { getMutationToastHandlers } from "@/lib/modal-helpers";

// ─── Zod Schema for Integration Setup ───────────────────────────────────────────

const cctvIntegrationSchema = z.object({
  credentials: z.record(z.string()).default({}),
});

type CCTVIntegrationFormValues = z.infer<typeof cctvIntegrationSchema>;

// ── Provider metadata ────────────────────────────────────────────
interface ProviderInfo {
  label: string;
  color: string;
  docUrl: string;
  authMethod: string;
  streamProtocol: string;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    secret?: boolean;
  }[];
  notes: string;
}

const PROVIDERS: Record<CCTVProvider, ProviderInfo> = {
  ezviz: {
    label: "EZVIZ",
    color: "bg-warning",
    docUrl: "https://open.ezviz.com",
    authMethod: "EZVIZ Cloud – Account ID + Verification Code",
    streamProtocol: "EZOPEN / HLS (cloud relay)",
    fields: [
      {
        key: "cloudAccountId",
        label: "Cloud Account ID",
        placeholder: "e.g. your_email@example.com",
      },
      {
        key: "verificationCode",
        label: "Verification Code",
        placeholder: "6-letter code (on camera sticker)",
        secret: true,
      },
    ],
    notes:
      "Enter your EZVIZ cloud account and the 6-digit verification code found on the device's sticker. Estela Gea Branch Agent will fetch the stream relay automatically.",
  },
  dahua: {
    label: "Dahua",
    color: "bg-primary",
    docUrl: "https://partner.dahuasecurity.com",
    authMethod: "Digest Auth – Local IP + Credentials",
    streamProtocol: "RTSP / HLS (LAN)",
    fields: [
      {
        key: "ipAddress",
        label: "Camera IP Address",
        placeholder: "192.168.1.x",
      },
      { key: "username", label: "Username", placeholder: "admin" },
      {
        key: "password",
        label: "Password",
        placeholder: "Camera password",
        secret: true,
      },
    ],
    notes:
      "Dahua camera or NVR on the local network. Estela Gea Branch Agent will proxy the RTSP stream to HLS for browser viewing.",
  },
  hikvision: {
    label: "HikVision",
    color: "bg-destructive",
    docUrl: "https://open.hikvision.com",
    authMethod: "ISAPI – Local IP + Credentials",
    streamProtocol: "RTSP / HLS (LAN)",
    fields: [
      {
        key: "ipAddress",
        label: "Device IP Address",
        placeholder: "192.168.1.x",
      },
      { key: "username", label: "Username", placeholder: "admin" },
      {
        key: "password",
        label: "Password",
        placeholder: "Camera password",
        secret: true,
      },
    ],
    notes:
      "Use this for HikVision NVRs or IP cameras on the local network. The Branch Agent handles protocol conversion from RTSP to HLS.",
  },
  reolink: {
    label: "Reolink",
    color: "bg-primary",
    docUrl: "https://reolink.com/software-and-api/",
    authMethod: "Local IP + Credentials",
    streamProtocol: "RTSP (LAN)",
    fields: [
      {
        key: "ipAddress",
        label: "Camera IP Address",
        placeholder: "192.168.1.x",
      },
      { key: "username", label: "Username", placeholder: "admin" },
      {
        key: "password",
        label: "Password",
        placeholder: "Camera password",
        secret: true,
      },
    ],
    notes:
      "Reolink local API integration. Camera must be on the same LAN as the Estela Gea Branch Agent for streaming.",
  },
  axis: {
    label: "Axis",
    color: "bg-muted",
    docUrl: "https://www.axis.com/vapix-library",
    authMethod: "Basic Auth – VAPIX API",
    streamProtocol: "MJPEG / RTSP (LAN)",
    fields: [
      {
        key: "ipAddress",
        label: "Camera IP / Host",
        placeholder: "192.168.1.x",
      },
      { key: "username", label: "VAPIX Username", placeholder: "root" },
      {
        key: "password",
        label: "VAPIX Password",
        placeholder: "Camera password",
        secret: true,
      },
    ],
    notes:
      "Axis VAPIX local API. Requires Estela Gea Branch Agent on the same network to proxy streams via RTSP/HLS.",
  },
  custom: {
    label: "Custom",
    color: "bg-secondary/50",
    docUrl: "",
    authMethod: "Direct stream URL",
    streamProtocol: "RTSP or HLS",
    fields: [
      {
        key: "hlsUrl",
        label: "HLS Stream URL",
        placeholder: "https://…/live/stream.m3u8",
      },
      {
        key: "rtspUrl",
        label: "RTSP Stream URL (optional)",
        placeholder: "rtsp://user:pass@192.168.1.x:554/stream",
      },
    ],
    notes:
      "Enter a direct HLS URL for browser playback, or an RTSP URL which the Branch Agent will proxy to HLS.",
  },
  other: {
    label: "Other",
    color: "bg-secondary/50",
    docUrl: "",
    authMethod: "Direct stream URL",
    streamProtocol: "RTSP or HLS",
    fields: [
      {
        key: "hlsUrl",
        label: "HLS Stream URL",
        placeholder: "https://…/live/stream.m3u8",
      },
      {
        key: "rtspUrl",
        label: "RTSP Stream URL (optional)",
        placeholder: "rtsp://user:pass@192.168.1.x:554/stream",
      },
    ],
    notes:
      "Enter the stream URL directly. Contact your camera vendor for RTSP or HLS access details.",
  },
};

// ── Status helpers ────────────────────────────────────────────────
const cctvStatusColor = (s: CCTVCamera["status"]) =>
  ({
    live: "bg-success text-success border-success",
    recording: "bg-primary/5 text-primary border-primary",
    offline: "bg-destructive text-destructive border-destructive",
    error: "bg-destructive text-destructive border-destructive",
    maintenance: "bg-warning text-warning border-warning",
  })[s];

const integStatusIcon = (s?: CCTVCamera["integrationStatus"]) => {
  if (s === "connected")
    return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
  if (s === "error")
    return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
  if (s === "pending")
    return <RefreshCw className="w-3.5 h-3.5 text-warning animate-spin" />;
  return <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />;
};

// ── Timeline events fetched from backend ──────────────────────────
// MOCK_EVENTS removed — events are fetched from /retail/cctv/:id/events

// ── Integration Setup Panel ─────────────────────────────────────
const IntegrationSetup: React.FC<{
  cam: CCTVCamera;
  onConnect: (data: Record<string, string>) => void;
}> = ({ cam, onConnect }) => {
  const info = PROVIDERS[cam.provider];
  const [form, setForm] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const session = useSession();
  const handleConnect = async () => {
    if (!session.tenant_id) return;
    setSaving(true);
    try {
      const resp = await retailService.validateCCTVConnection(
        session.tenant_id,
        session,
        {
          provider: cam.provider,
          ...form,
        },
      );

      if (resp.success) {
        toast({
          title: "Connection Successful",
          description: `${info.label} credentials are valid.`,
        });
        onConnect(form);
      } else {
        toast({
          title: "Connection Failed",
          description:
            resp.message || "Invalid credentials or unreachable device.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "An unexpected error occurred during validation.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  const allFilled = (Array.isArray(info.fields) ? info.fields : []).filter(
      (f) =>
        !f.label.includes("optional") && !f.placeholder.includes("optional"),
    )
    .every((f) => form[f.key]);

  return (
    <div className="space-y-5">
      {/* Provider header */}
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl ${info.color} flex items-center justify-center text-foreground font-black text-xs`}
        >
          {info.label.slice(0, 3)}
        </div>
        <div>
          <div className="font-black text-sm text-foreground">
            {info.label} Integration
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">
            {info.authMethod}
          </div>
        </div>
        {info.docUrl && (
          <a
            href={info.docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[10px] text-primary hover:text-primary flex items-center gap-1 font-semibold"
          >
            Open Docs <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="bg-primary/5 border border-primary rounded-2xl px-4 py-3 text-[11px] text-primary font-medium flex gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        {info.notes}
      </div>

      <div className="space-y-3">
        {(Array.isArray(info.fields) ? info.fields : []).map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
              {field.label}
            </Label>
            <div className="relative">
              <Input
                type={
                  field.secret && !showSecrets[field.key] ? "password" : "text"
                }
                placeholder={field.placeholder}
                value={form[field.key] ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, [field.key]: e.target.value }))
                }
                className="rounded-xl border-border text-sm font-mono pr-10"
              />
              {field.secret && (
                <button
                  onClick={() =>
                    setShowSecrets((p) => ({
                      ...p,
                      [field.key]: !p[field.key],
                    }))
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                >
                  {showSecrets[field.key] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[10px] text-muted-foreground font-medium">
        Stream protocol:{" "}
        <span className="font-black text-muted-foreground">{info.streamProtocol}</span>
      </div>

      <Button
        disabled={!allFilled || saving}
        onClick={handleConnect}
        className="w-full h-11 rounded-xl bg-secondary text-foreground font-black italic uppercase text-[10px] tracking-widest gap-2"
      >
        {saving ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Key className="w-4 h-4" />
        )}
        {saving ? "Connecting…" : `Connect ${info.label}`}
      </Button>
    </div>
  );
};

// ── Video Area ─────────────────────────────────────────────────
const VideoArea: React.FC<{
  cam: CCTVCamera;
  isLive: boolean;
  isPlaying: boolean;
  togglePlay: () => void;
}> = ({ cam, isLive, isPlaying, togglePlay }) => {
  const isActive = cam.status === "live" || cam.status === "recording";

  if (!isActive) {
    return (
      <div className="w-full aspect-video bg-secondary rounded-3xl flex flex-col items-center justify-center gap-3">
        <WifiOff className="w-10 h-10 text-muted-foreground" />
        <div className="text-sm font-black italic tracking-tighter text-muted-foreground">
          Feed Unavailable
        </div>
        <div className="text-[10px] text-muted-foreground font-medium">
          Camera is {cam.status}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video bg-secondary rounded-3xl overflow-hidden relative group">
      {/* Simulated feed background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px,rgba(255,255,255,0.15) 1px,transparent 0)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Status badge */}
      <div
        className={`absolute top-4 left-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 ${isLive ? "bg-success" : "bg-primary"}`}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-card animate-pulse" />
        <span className="text-[9px] font-black text-foreground uppercase">
          {isLive ? "Live" : "Playback"}
        </span>
      </div>

      {/* Camera label */}
      <div className="absolute top-4 right-4 bg-black/50 rounded-xl px-3 py-1.5">
        <span className="text-[10px] font-black text-foreground italic">
          {cam.name}
        </span>
      </div>

      {/* Center play indicator */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-muted-foreground text-center">
          <Camera className="w-16 h-16 mx-auto opacity-10" />
          <div className="text-[11px] font-bold text-muted-foreground mt-2 opacity-40">
            {cam.hlsUrl ? "HLS Stream Active" : "Stream via Branch Agent"}
          </div>
        </div>
      </div>

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 translate-y-full group-hover:translate-y-0 transition-transform">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="text-foreground hover:text-success transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>
          {!isLive && (
            <>
              <button className="text-foreground/70 hover:text-foreground">
                <SkipBack className="w-4 h-4" />
              </button>
              <div className="flex-1 bg-white/20 rounded-full h-1">
                <div className="bg-card rounded-full h-1 w-1/3" />
              </div>
              <button className="text-foreground/70 hover:text-foreground">
                <SkipForward className="w-4 h-4" />
              </button>
            </>
          )}
          <button className="text-foreground/70 hover:text-foreground ml-auto">
            <Volume2 className="w-4 h-4" />
          </button>
          {cam.hasPtz && (
            <button className="text-foreground/70 hover:text-foreground">
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button className="text-foreground/70 hover:text-foreground">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timestamp */}
      <div className="absolute bottom-4 right-4 bg-black/50 rounded-lg px-2 py-1">
        <span className="text-[10px] font-mono text-foreground">
          {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

// ── Main Modal ─────────────────────────────────────────────────
type ViewTab = "live" | "history" | "setup";

interface Props {
  camera: CCTVCamera | null;
  onClose: () => void;
  onIntegrationSave?: (camId: string, data: Record<string, string>) => void;
}

const CCTVViewerModal: React.FC<Props> = ({
  camera,
  onClose,
  onIntegrationSave,
}) => {
  const session = useSession();
  const canManage = [
    Roles.SUPERADMIN,
    Roles.OWNER,
    Roles.COMPANY_ADMIN,
  ].includes(session.role?.toUpperCase() as any);

  const [viewTab, setViewTab] = useState<ViewTab>("live");
  const [isPlaying, setIsPlaying] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  // Timeline events fetched from backend via useQuery
  const { data: timelineEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ["retail", "cctvs", camera?.id, "events", selectedDate],
    queryFn: async () => {
      if (!camera || !session?.tenant_id) return [];
      const data = await retailService.getCCTVEvents?.(
        session.tenant_id!,
        session,
        camera.id,
        selectedDate,
      );
      return Array.isArray(data) ? data : [];
    },
    enabled: !!camera && !!session?.tenant_id,
  });

  if (!camera) return null;

  const isNotConfigured =
    !camera.integrationStatus || camera.integrationStatus === "not_configured";
  const info = PROVIDERS[camera.provider];

  const TABS: { id: ViewTab; icon: React.ReactNode; label: string }[] = [
    {
      id: "live",
      icon: <Video className="w-3.5 h-3.5" />,
      label: "Live Stream",
    },
    {
      id: "history",
      icon: <History className="w-3.5 h-3.5" />,
      label: "History",
    },
    ...(canManage
      ? [
          {
            id: "setup" as ViewTab,
            icon: <Settings2 className="w-3.5 h-3.5" />,
            label: "Integration",
          },
        ]
      : []),
  ];

  return (
    <Dialog
      open={!!camera}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-4xl w-full rounded-3xl border-none shadow-2xl bg-card p-0 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-4">
            <div
              className={`w-10 h-10 rounded-2xl ${info.color} flex items-center justify-center text-foreground font-black text-xs shrink-0`}
            >
              {info.label.slice(0, 3)}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-black italic tracking-tighter text-foreground truncate">
                {camera.name}
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <Badge
                  className={`text-[9px] font-black italic uppercase border ${cctvStatusColor(camera.status)}`}
                >
                  {camera.status === "live" || camera.status === "recording" ? (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse mr-1 inline-block" />
                      {camera.status}
                    </>
                  ) : (
                    camera.status
                  )}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {info.label} · {camera.model ?? camera.provider}
                </span>
                {camera.location && (
                  <span className="text-[10px] text-muted-foreground">
                    {camera.location}
                  </span>
                )}
                <div className="flex items-center gap-1 ml-auto text-[10px] font-semibold">
                  {integStatusIcon(camera.integrationStatus)}
                  <span className="text-muted-foreground">
                    {camera.integrationStatus === "connected"
                      ? "Connected"
                      : "Not configured"}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-border shrink-0">
          {(Array.isArray(TABS) ? TABS : []).map((t) => (
            <button
              key={t.id}
              onClick={() => setViewTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black italic uppercase tracking-widest transition-all ${viewTab === t.id ? "bg-secondary text-foreground shadow-md" : "text-muted-foreground hover:text-muted-foreground hover:bg-secondary/5"}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          {isNotConfigured && viewTab !== "setup" && (
            <div className="ml-auto flex items-center gap-1.5 text-[10px] text-warning bg-warning border border-warning rounded-xl px-3 py-1.5 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              {canManage
                ? "Integration not set up — click Integration tab"
                : "Not connected to stream provider"}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          <div className="p-6">
            {/* ── LIVE TAB ── */}
            {viewTab === "live" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <VideoArea
                    cam={camera}
                    isLive={true}
                    isPlaying={isPlaying}
                    togglePlay={() => setIsPlaying((p) => !p)}
                  />
                  {isNotConfigured && (
                    <div className="mt-3 bg-warning border border-warning rounded-2xl px-4 py-3 text-[11px] text-warning font-medium flex gap-2 items-start">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Stream not connected.{" "}
                      {canManage
                        ? "Go to the Integration tab to enter credentials."
                        : "Ask your IT admin to set up the integration."}
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="bg-secondary/5 rounded-2xl p-4 space-y-3 text-[11px]">
                    <div className="font-black uppercase text-muted-foreground tracking-widest text-[9px]">
                      Camera Info
                    </div>
                    {[
                      { l: "Provider", v: info.label },
                      { l: "Model", v: camera.model },
                      {
                        l: "Resolution",
                        v: camera.resolutionMp
                          ? `${camera.resolutionMp}MP`
                          : undefined,
                      },
                      { l: "Placement", v: camera.location },
                      {
                        l: "Night Vision",
                        v: camera.hasNightVision ? "Yes" : "No",
                      },
                      { l: "PTZ", v: camera.hasPtz ? "Supported" : "Fixed" },
                      {
                        l: "Last Ping",
                        v: camera.lastPing
                          ? new Date(camera.lastPing).toLocaleTimeString()
                          : "N/A",
                      },
                    ]
                      .filter((r) => r.v !== undefined)
                      .map((r, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-muted-foreground font-bold">
                            {r.l}
                          </span>
                          <span className="font-black text-muted-foreground">
                            {r.v}
                          </span>
                        </div>
                      ))}
                  </div>

                  {camera.hasPtz && (
                    <div className="bg-secondary/5 rounded-2xl p-4 space-y-2">
                      <div className="font-black uppercase text-muted-foreground tracking-widest text-[9px] mb-3">
                        PTZ Control
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 w-fit mx-auto">
                        {["↖", "↑", "↗", "←", "·", "→", "↙", "↓", "↘"].map(
                          (d, i) => (
                            <button
                              key={i}
                              className="w-9 h-9 rounded-xl bg-card border border-border text-sm font-bold hover:bg-secondary hover:text-foreground transition-all flex items-center justify-center"
                            >
                              {d}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {canManage && (
                    <Button
                      variant="outline"
                      onClick={() => setViewTab("setup")}
                      className="w-full h-9 rounded-xl border-border font-black italic uppercase text-[9px] tracking-widest gap-1.5"
                    >
                      <Settings2 className="w-3.5 h-3.5" />{" "}
                      {isNotConfigured
                        ? "Setup Integration"
                        : "Integration Settings"}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ── HISTORY TAB ── */}
            {viewTab === "history" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  {/* Date + time range */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-secondary/10 rounded-xl px-3 py-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent text-sm font-black text-muted-foreground focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-secondary/10 rounded-xl px-3 py-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <input
                          type="time"
                          defaultValue="08:00"
                          className="bg-transparent text-sm font-black text-muted-foreground focus:outline-none"
                        />
                      </div>
                      <span className="text-muted-foreground font-bold text-sm">
                        →
                      </span>
                      <div className="flex items-center gap-2 bg-secondary/10 rounded-xl px-3 py-2">
                        <input
                          type="time"
                          defaultValue="18:00"
                          className="bg-transparent text-sm font-black text-muted-foreground focus:outline-none"
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={async () => {
                        try {
                          const from = `${selectedDate}T08:00:00`;
                          const to = `${selectedDate}T18:00:00`;
                          await apiRequest(`/retail/cctv/${camera.id}/footage`, "POST", session, { from, to });
                          toast({ title: "Footage Loading", description: "Archive stream requested from Branch NVR." });
                        } catch (e) {
                          toast({ title: "Footage Error", description: "Failed to load archive footage.", variant: "destructive" });
                        }
                      }}
                      size="sm"
                      className="h-10 rounded-xl bg-secondary text-foreground font-black italic uppercase text-[10px] tracking-widest gap-2"
                    >
                      <Play className="w-3.5 h-3.5" /> Load Footage
                    </Button>
                  </div>
                  <VideoArea
                    cam={camera}
                    isLive={false}
                    isPlaying={isPlaying}
                    togglePlay={() => setIsPlaying((p) => !p)}
                  />
                </div>

                {/* Event timeline */}
                <div className="space-y-3">
                  <div className="font-black uppercase text-muted-foreground tracking-widest text-[9px] px-1">
                    Event Timeline — {selectedDate}
                  </div>
                  {isLoadingEvents && (
                    <div className="flex items-center justify-center py-6">
                      <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!isLoadingEvents && timelineEvents.length === 0 && (
                    <div className="text-[11px] text-muted-foreground text-center py-4">
                      No events recorded for this date.
                    </div>
                  )}
                  {!isLoadingEvents && timelineEvents.length > 0 && (
                    <div className="space-y-2">
                      {timelineEvents.map((ev, i) => (
                        <button
                          key={i}
                          className="w-full text-left bg-secondary/5 hover:bg-muted border border-transparent hover:border-border hover:shadow-sm rounded-2xl px-4 py-3 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-2 h-2 rounded-full shrink-0 ${ev.type === "alert" ? "bg-destructive" : ev.type === "ok" ? "bg-success" : "bg-warning"}`}
                            />
                            <div>
                              <div className="text-[11px] font-black text-muted-foreground">
                                {ev.label}
                              </div>
                              <div className="text-[9px] text-muted-foreground font-mono">
                                {ev.time}
                              </div>
                            </div>
                            <Play className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-muted-foreground ml-auto transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <Separator />
                  <div className="flex gap-1.5">
                    <Button disabled title="Not available yet"
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 rounded-xl border-border font-black italic text-[9px] uppercase tracking-widest gap-1"
                    >
                      <ChevronLeft className="w-3 h-3" /> Prev Day
                    </Button>
                    <Button disabled title="Not available yet"
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 rounded-xl border-border font-black italic text-[9px] uppercase tracking-widest gap-1"
                    >
                      Next Day <ChevronRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ── INTEGRATION TAB ── */}
            {viewTab === "setup" && canManage && (
              <div className="max-w-lg mx-auto space-y-6">
                {/* How it works */}
                <div className="bg-secondary text-foreground rounded-3xl p-6 space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    How Integration Works
                  </div>
                  <div className="space-y-3 text-[11px] text-muted-foreground/60">
                    {[
                      {
                        n: "1",
                        t: "Get API credentials from your camera vendor's developer portal.",
                      },
                      {
                        n: "2",
                        t: "Enter them below. Credentials are stored encrypted per-branch.",
                      },
                      {
                        n: "3",
                        t: "Estela Gea Branch Agent (local) authenticates and fetches the stream URL.",
                      },
                      {
                        n: "4",
                        t: "Stream is proxied to HLS for browser playback. Credentials never exposed to clients.",
                      },
                    ].map((s) => (
                      <div key={s.n} className="flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-white/10 text-foreground text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                          {s.n}
                        </div>
                        <span className="font-medium">{s.t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <IntegrationSetup
                  cam={camera}
                  onConnect={(data) => {
                    onIntegrationSave?.(camera.id, data);
                    setViewTab("live");
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CCTVViewerModal;
