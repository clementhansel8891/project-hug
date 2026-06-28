import React, { useState, useMemo, useEffect, useCallback } from "react";
import { PageHeader } from "@/core/ui/PageHeader";
import {
  Monitor,
  PlusCircle,
  Wifi,
  RefreshCw,
  Camera,
  RadioTower,
  ChevronDown,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MoreVertical,
  WifiOff,
  EyeOff,
  Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/core/security/session";
import { retailService } from "@/core/services/retail/retailService";
import type {
  BranchDeviceType,
  CCTVCamera,
  CCTVProvider,
  BranchSensor,
  SensorType,
} from "@/core/types/retail/retail";

// Modals
import CCTVViewerModal from "./components/cctv/CCTVViewerModal";
import CCTVConnectorModal from "./components/cctv/CCTVConnectorModal";
import DeviceModal from "./components/device-control/DeviceModal";
import SensorModal from "./components/device-control/SensorModal";
import RegisterModal from "./components/device-control/RegisterModal";
import DiscoveryModal from "./components/device-control/DiscoveryModal";

// Modular UI & Types
import {
  DeviceIcon,
  SIcon,
  ConnIcon,
  connLabel,
  dsc,
  csc,
  ssc,
  Empty,
} from "./components/device-control/DeviceControlUI";
import type {
  ExtDevice,
  Tab,
  DiscoveredDevice,
  RegForm,
} from "./components/device-control/DeviceControlTypes";

const DEFAULT_BRANCHES: { id: string; name: string }[] = [];

const DeviceControlCenter = () => {
  const session = useSession();
  const { toast } = useToast();

  const [stores, setStores] =
    useState<{ id: string; name: string }[]>(DEFAULT_BRANCHES);
  const [branch, setBranch] = useState<string>("");
  const [tab, setTab] = useState<Tab>("devices");
  const [showReg, setShowReg] = useState(false);
  const [showCctvReg, setShowCctvReg] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selDevice, setSelDevice] = useState<ExtDevice | null>(null);
  const [selSensor, setSelSensor] = useState<BranchSensor | null>(null);
  const [selCamForView, setSelCamForView] = useState<CCTVCamera | null>(null);

  const [showDiscovery, setShowDiscovery] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<
    DiscoveredDevice[]
  >([]);

  const [devMap, setDevMap] = useState<Record<string, ExtDevice[]>>({});
  const [camMap, setCamMap] = useState<Record<string, CCTVCamera[]>>({});
  const [senMap, setSenMap] = useState<Record<string, BranchSensor[]>>({});

  const fetchStores = useCallback(async () => {
    if (!session.tenant_id) return;
    try {
      const list = await retailService.listStores(session.tenant_id, session);
      if (list && list.length > 0) {
        setStores((Array.isArray(list) ? list : []).map((s) => ({ id: s.id, name: s.name })));
        setBranch(list[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch stores", e);
    }
  }, [session]);

  const fetchData = useCallback(async () => {
    if (!session.tenant_id || !branch) return;
    setIsRefreshing(true);
    try {
      const [d, c, s] = await Promise.all([
        retailService.listDevices(session.tenant_id, session, branch),
        retailService.listCCTVs(session.tenant_id, session, branch),
        retailService.listSensors(session.tenant_id, session, branch),
      ]);
      setDevMap((p) => ({ ...p, [branch]: d as ExtDevice[] }));
      setCamMap((p) => ({ ...p, [branch]: c }));
      setSenMap((p) => ({ ...p, [branch]: s }));
    } catch (e) {
      toast({
        title: "Fetch Error",
        description: "Failed to load branch hardware status.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [session, branch, toast]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const devices = useMemo(() => devMap[branch] ?? [], [devMap, branch]);
  const cameras = useMemo(() => camMap[branch] ?? [], [camMap, branch]);
  const sensors = useMemo(() => senMap[branch] ?? [], [senMap, branch]);
  const branchName = stores.find((b) => b.id === branch)?.name ?? "";
  const onlineDevs = (Array.isArray(devices) ? devices : []).filter((d) => d.status === "online").length;
  const activeCams = (Array.isArray(cameras) ? cameras : []).filter(
    (c) => c.status === "live" || c.status === "recording",
  ).length;
  const alertSens = (Array.isArray(sensors) ? sensors : []).filter(
    (s) => s.status === "warning" || s.status === "critical",
  ).length;

  const handleRefresh = async () => {
    await fetchData();
    toast({
      title: "Refreshed",
      description: `Status synced for ${branchName}.`,
    });
  };

  const handleRegister = async (f: RegForm) => {
    if (!session.tenant_id) return;
    try {
      if (tab === "devices") {
        await retailService.registerDevice(session.tenant_id, session, {
          name: f.name,
          type: f.subType as BranchDeviceType,
          model: f.model || undefined,
          serialNumber: f.serial || undefined,
          ipAddress: f.ip || undefined,
          macAddress: f.mac || undefined,
          notes: f.notes || undefined,
          locationId: branch,
        });
      } else if (tab === "cctv") {
        await retailService.registerCCTV(session.tenant_id, session, {
          name: f.name,
          provider: f.subType as CCTVProvider,
          model: f.model || undefined,
          location: f.placement || undefined,
          notes: f.notes || undefined,
          locationId: branch,
        });
      } else {
        await retailService.registerSensor(session.tenant_id, session, {
          name: f.name,
          type: f.subType as SensorType,
          model: f.model || undefined,
          serialNumber: f.serial || undefined,
          placement: f.placement || undefined,
          notes: f.notes || undefined,
          locationId: branch,
        });
      }
      setShowReg(false);
      toast({
        title: "Registered",
        description: `"${f.name}" added to ${branchName}.`,
      });
      fetchData();
    } catch (e) {
      toast({
        title: "Registration Failed",
        description: "Could not register hardware at this moment.",
        variant: "destructive",
      });
    }
  };

  const handleScan = async () => {
    if (!session.tenant_id) return;
    setIsScanning(true);
    setShowDiscovery(true);
    try {
      const results = await retailService.scanDevices(
        session.tenant_id,
        session,
      );
      setDiscoveredDevices(results as DiscoveredDevice[]);
    } catch (e) {
      toast({
        title: "Scan Failed",
        description: "Branch Agent not responding or discovery error.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleCommit = async (discoveryId: string) => {
    if (!session.tenant_id) return;
    try {
      await retailService.commitScannedDevice(
        session.tenant_id,
        session,
        discoveryId,
      );
      toast({
        title: "Device Onboarded",
        description: "New hardware successfully registered.",
      });
      setDiscoveredDevices((p) =>
        (Array.isArray(p) ? p : []).filter((d) => d.discoveryId !== discoveryId),
      );
      fetchData();
    } catch (e) {
      toast({
        title: "Onboarding Failed",
        description: "Could not commit device registration.",
        variant: "destructive",
      });
    }
  };

  const TABS = [
    {
      id: "devices" as Tab,
      label: "Devices",
      icon: <Monitor className="w-4 h-4" />,
      count: devices.length,
    },
    {
      id: "cctv" as Tab,
      label: "CCTV",
      icon: <Camera className="w-4 h-4" />,
      count: cameras.length,
    },
    {
      id: "sensors" as Tab,
      label: "Sensors",
      icon: <RadioTower className="w-4 h-4" />,
      count: sensors.length,
    },
  ];

  return (
    <div className="min-h-full bg-secondary/5">
      {/* Header */}
      <div className="px-6 py-3 border-b bg-background/40 backdrop-blur-md sticky top-0 z-40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <PageHeader
            title="Device Control"
            subtitle="Monitor branch hardware — Devices, CCTV, Sensors"
          />
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-2 bg-secondary/10 rounded-xl px-3 py-1.5 border border-border/40">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="border-none bg-transparent shadow-none h-auto p-0 text-[11px] font-black text-foreground min-w-[140px] focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border shadow-2xl">
                  {(Array.isArray(stores) ? stores : []).map((b) => (
                    <SelectItem
                      key={b.id}
                      value={b.id}
                      className="font-bold text-[11px]"
                    >
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-9 rounded-xl border-border text-muted-foreground font-black italic uppercase text-[9px] tracking-widest gap-2"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />{" "}
              SYNC
            </Button>
            <Button
              size="sm"
              onClick={() => setShowReg(true)}
              className="h-9 rounded-xl bg-secondary text-foreground font-black italic uppercase text-[9px] tracking-widest px-4 gap-2 shadow-lg"
            >
              <PlusCircle className="w-3.5 h-3.5" /> REGISTER
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              l: "Branch",
              v: branchName.split("–")[0].trim(),
              s: "Active scope",
              c: "text-foreground",
              icon: <Building2 className="w-5 h-5 text-muted-foreground" />,
            },
            {
              l: "Devices Online",
              v: `${onlineDevs} / ${devices.length}`,
              s: "Hardware nodes",
              c:
                onlineDevs === devices.length && devices.length > 0
                  ? "text-success"
                  : "text-warning",
              icon: <Wifi className="w-5 h-5 text-success" />,
            },
            {
              l: "Cameras Active",
              v: `${activeCams} / ${cameras.length}`,
              s: "Live or recording",
              c:
                activeCams === cameras.length && cameras.length > 0
                  ? "text-success"
                  : "text-warning",
              icon: <Camera className="w-5 h-5 text-primary" />,
            },
            {
              l: "Sensor Alerts",
              v: String(alertSens),
              s: alertSens > 0 ? "Needs attention" : "All clear",
              c: alertSens > 0 ? "text-destructive" : "text-success",
              icon:
                alertSens > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ),
            },
          ].map((k, i) => (
            <Card
              key={i}
              className="rounded-2xl border border-border bg-card shadow-2xl backdrop-blur-3xl"
            >
              <CardContent className="p-5 flex items-start gap-3">
                <div className="mt-0.5">{k.icon}</div>
                <div>
                  <div className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                    {k.l}
                  </div>
                  <div
                    className={`text-xl font-black italic tracking-tighter mt-0.5 ${k.c}`}
                  >
                    {k.v}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                    {k.s}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-secondary border border-border rounded-2xl p-1.5 shadow-2xl w-fit">
          {(Array.isArray(TABS) ? TABS : []).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black italic uppercase tracking-widest transition-all ${tab === t.id ? "bg-white/10 text-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              {t.icon}
              {t.label}
              <span
                className={`text-[9px] rounded-full px-2 py-0.5 font-black ${tab === t.id ? "bg-white/20 text-foreground" : "bg-white/10 text-muted-foreground"}`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Devices ── */}
        {tab === "devices" &&
          (devices.length === 0 ? (
            <Empty
              label="No devices registered for this branch."
              onAdd={() => setShowReg(true)}
              onScan={handleScan}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {(Array.isArray(devices) ? devices : []).map((dev) => (
                <button
                  key={dev.id}
                  onClick={() => setSelDevice(dev)}
                  className="text-left w-full"
                >
                  <Card className="rounded-3xl border border-border bg-card shadow-2xl hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] hover:border-primary/30 hover:-translate-y-0.5 transition-all cursor-pointer group h-full backdrop-blur-3xl">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-inner ${dev.status === "online" ? "bg-success/15 text-success" : dev.status === "maintenance" ? "bg-warning/15 text-warning" : "bg-secondary/10 text-muted-foreground"}`}
                        >
                          <DeviceIcon type={dev.type} cls="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            className={`text-[9px] font-black italic uppercase border ${dsc(dev.status)}`}
                          >
                            {dev.status === "online" ? (
                              <Wifi className="w-2.5 h-2.5 mr-1 inline" />
                            ) : dev.status === "offline" ? (
                              <WifiOff className="w-2.5 h-2.5 mr-1 inline" />
                            ) : null}
                            {dev.status}
                          </Badge>
                          <MoreVertical className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-black italic tracking-tighter text-foreground leading-tight">
                          {dev.name}
                        </div>
                        {dev.model && (
                          <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                            {dev.model}
                          </div>
                        )}
                      </div>
                      <Separator className="bg-secondary/5" />
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        {dev.connType && (
                          <span className="flex items-center gap-1">
                            <ConnIcon t={dev.connType} />
                            {connLabel[dev.connType]}
                          </span>
                        )}
                        {dev.ipAddress && (
                          <span className="font-mono">{dev.ipAddress}</span>
                        )}
                        {dev.comPort && (
                          <span className="font-mono">{dev.comPort}</span>
                        )}
                        {dev.assignment?.role && (
                          <span className="text-muted-foreground">
                            {dev.assignment.role}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
              <div className="flex flex-col gap-4 col-span-1 min-h-[160px]">
                <button
                  onClick={() => setShowReg(true)}
                  className="flex-1 rounded-3xl border-2 border-dashed border-border bg-card hover:border-primary/30 hover:bg-card hover:shadow-lg transition-all flex flex-col items-center justify-center py-4 gap-2 group text-foreground"
                >
                  <PlusCircle className="w-6 h-6 text-muted-foreground/60 group-hover:text-muted-foreground transition-all" />
                  <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground group-hover:text-muted-foreground">
                    Register Device
                  </div>
                </button>
                <button
                  onClick={handleScan}
                  className="flex-1 rounded-3xl border-2 border-dashed border-border bg-card hover:border-primary/30 hover:bg-card hover:shadow-lg transition-all flex flex-col items-center justify-center py-4 gap-2 group text-foreground"
                >
                  <RefreshCw className="w-6 h-6 text-muted-foreground/60 group-hover:text-primary transition-all" />
                  <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground group-hover:text-primary">
                    Scan Network
                  </div>
                </button>
              </div>
            </div>
          ))}

        {/* ── CCTV ── */}
        {tab === "cctv" &&
          (cameras.length === 0 ? (
            <Empty
              label="No cameras registered for this branch."
              onAdd={() => setShowCctvReg(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {(Array.isArray(cameras) ? cameras : []).map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => setSelCamForView(cam)}
                  className="text-left w-full focus:outline-none"
                >
                  <Card className="rounded-3xl border border-border bg-card shadow-2xl hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] hover:border-primary/30 hover:-translate-y-0.5 transition-all group overflow-hidden h-full backdrop-blur-3xl">
                    <div
                      className={`h-32 flex items-center justify-center relative ${cam.status === "live" || cam.status === "recording" ? "bg-secondary/60" : "bg-secondary/10"}`}
                    >
                      {cam.status === "live" || cam.status === "recording" ? (
                        <>
                          <Camera className="w-8 h-8 text-muted-foreground opacity-20" />
                          {cam.status === "recording" && (
                            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-destructive rounded-full px-2.5 py-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              <span className="text-[8px] font-black text-foreground uppercase">
                                REC
                              </span>
                            </div>
                          )}
                          {cam.status === "live" && (
                            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-success rounded-full px-2.5 py-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              <span className="text-[8px] font-black text-foreground uppercase">
                                Live
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <EyeOff className="w-7 h-7 opacity-30" />
                          <span className="text-[9px] font-black uppercase tracking-widest opacity-40">
                            Feed Unavailable
                          </span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-black italic tracking-tighter text-foreground">
                            {cam.name}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono uppercase">
                            {cam.provider}
                            {cam.model ? ` · ${cam.model}` : ""}
                          </div>
                        </div>
                        <Badge
                          className={`text-[9px] font-black italic uppercase border ${csc(cam.status)}`}
                        >
                          {cam.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        {cam.location && (
                          <span>
                            <Eye className="w-3 h-3 inline mr-1" />
                            {cam.location}
                          </span>
                        )}
                        {cam.resolutionMp && <span>{cam.resolutionMp}MP</span>}
                        {cam.hasNightVision && <span>Night Vision</span>}
                        {cam.hasPtz && <span>PTZ</span>}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-9 rounded-xl bg-secondary/5 hover:bg-secondary hover:text-foreground text-muted-foreground font-black italic uppercase text-[9px] tracking-widest transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Open setup directly if needed
                            setSelCamForView(cam);
                          }}
                        >
                          <Camera className="w-3.5 h-3.5 mr-1.5" /> View Feed
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
              <button
                onClick={() => setShowCctvReg(true)}
                className="rounded-3xl border-2 border-dashed border-border bg-card hover:border-primary/30 hover:bg-card hover:shadow-lg transition-all flex flex-col items-center justify-center py-10 gap-3 group min-h-[200px] text-foreground"
              >
                <PlusCircle className="w-9 h-9 text-muted-foreground/60 group-hover:text-muted-foreground group-hover:scale-110 transition-all" />
                <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground group-hover:text-muted-foreground">
                  Register Camera
                </div>
              </button>
            </div>
          ))}

        {/* ── Sensors ── */}
        {tab === "sensors" &&
          (sensors.length === 0 ? (
            <Empty
              label="No sensors registered for this branch."
              onAdd={() => setShowReg(true)}
              onScan={handleScan}
            />
          ) : (
            <div className="space-y-4">
              {alertSens > 0 && (
                <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-2xl px-5 py-3.5">
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                  <div>
                    <div className="text-[11px] font-black text-warning">
                      {alertSens} sensor{alertSens > 1 ? "s" : ""} require
                      attention
                    </div>
                    <div className="text-[10px] text-warning/70 font-medium">
                      Thresholds may have been exceeded — click a sensor for
                      details.
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {(Array.isArray(sensors) ? sensors : []).map((sensor) => (
                  <button
                    key={sensor.id}
                    onClick={() => setSelSensor(sensor)}
                    className="text-left w-full"
                  >
                    <Card className="rounded-3xl border border-border bg-card shadow-2xl hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] hover:border-primary/30 hover:-translate-y-0.5 transition-all cursor-pointer h-full backdrop-blur-3xl">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-inner ${sensor.status === "normal" ? "bg-success/15 text-success" : sensor.status === "warning" ? "bg-warning/15 text-warning" : sensor.status === "critical" ? "bg-destructive/15 text-destructive" : "bg-secondary/10 text-muted-foreground"}`}
                          >
                            <SIcon type={sensor.type} cls="w-5 h-5" />
                          </div>
                          <Badge
                            className={`text-[9px] font-black italic uppercase border ${ssc(sensor.status)}`}
                          >
                            {sensor.status === "warning" && (
                              <AlertTriangle className="w-2.5 h-2.5 mr-1 inline" />
                            )}
                            {sensor.status}
                          </Badge>
                        </div>
                        <div>
                          <div className="text-sm font-black italic tracking-tighter text-foreground leading-tight">
                            {sensor.name}
                          </div>
                          {sensor.model && (
                            <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                              {sensor.model}
                            </div>
                          )}
                        </div>
                        {sensor.currentValue !== undefined && (
                          <div
                            className={`rounded-2xl px-4 py-3 flex items-center justify-between ${sensor.status === "warning" ? "bg-warning/15" : sensor.status === "critical" ? "bg-destructive/15" : "bg-secondary/5"}`}
                          >
                            <span
                              className={`text-2xl font-black italic tracking-tighter ${sensor.status === "warning" ? "text-warning" : sensor.status === "critical" ? "text-destructive" : "text-success"}`}
                            >
                              {sensor.currentValue}
                              <span className="text-xs ml-0.5 opacity-60">
                                {sensor.unit}
                              </span>
                            </span>
                            {(sensor.thresholdMin !== undefined ||
                              sensor.thresholdMax !== undefined) && (
                              <div className="text-[10px] text-muted-foreground font-medium text-right">
                                {sensor.thresholdMin !== undefined && (
                                  <div>
                                    Min {sensor.thresholdMin}
                                    {sensor.unit}
                                  </div>
                                )}
                                {sensor.thresholdMax !== undefined && (
                                  <div>
                                    Max {sensor.thresholdMax}
                                    {sensor.unit}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                          {sensor.placement && <span>{sensor.placement}</span>}
                          {sensor.lastReading && (
                            <span>
                              <Clock className="w-3 h-3 inline mr-0.5" />
                              {new Date(sensor.lastReading).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                ))}
                <div className="flex flex-col gap-4 col-span-1 min-h-[160px]">
                  <button
                    onClick={() => setShowReg(true)}
                    className="flex-1 rounded-3xl border-2 border-dashed border-border bg-card hover:border-primary/30 hover:bg-card hover:shadow-lg transition-all flex flex-col items-center justify-center py-4 gap-2 group text-foreground"
                  >
                    <PlusCircle className="w-6 h-6 text-muted-foreground/60 group-hover:text-muted-foreground transition-all" />
                    <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground group-hover:text-muted-foreground">
                      Register Sensor
                    </div>
                  </button>
                  <button
                    onClick={handleScan}
                    className="flex-1 rounded-3xl border-2 border-dashed border-border bg-card hover:border-primary/30 hover:bg-card hover:shadow-lg transition-all flex flex-col items-center justify-center py-4 gap-2 group text-foreground"
                  >
                    <RefreshCw className="w-6 h-6 text-muted-foreground/60 group-hover:text-primary transition-all" />
                    <div className="text-[10px] font-black italic uppercase tracking-widest text-muted-foreground group-hover:text-primary">
                      Scan Network
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Modals */}
      <DeviceModal dev={selDevice} onClose={() => setSelDevice(null)} />
      <SensorModal sensor={selSensor} onClose={() => setSelSensor(null)} />
      <CCTVViewerModal
        camera={selCamForView}
        onClose={() => setSelCamForView(null)}
      />
      <DiscoveryModal
        open={showDiscovery}
        loading={isScanning}
        results={discoveredDevices}
        onClose={() => setShowDiscovery(false)}
        onCommit={handleCommit}
      />
      <CCTVConnectorModal
        open={showCctvReg}
        onClose={() => setShowCctvReg(false)}
        onSuccess={(cam) => {
          setCamMap((p) => ({
            ...p,
            [branch]: [...(p[branch] || []), cam],
          }));
          setShowCctvReg(false);
          toast({
            title: "CCTV Registered",
            description: `${cam.name} has been successfully connected.`,
          });
        }}
      />
      <RegisterModal
        open={showReg}
        tab={tab}
        onClose={() => setShowReg(false)}
        onSave={(f) => {
          if (!f) {
            handleScan();
          } else {
            handleRegister(f);
          }
        }}
      />
    </div>
  );
};

export default DeviceControlCenter;
