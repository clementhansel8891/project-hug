import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/core/ui/PageHeader";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { DataTableShell } from "@/core/tools/DataTableShell";
import { FilterBar } from "@/core/tools/FilterBar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Laptop } from "lucide-react";
import { FeedbackAlert } from "@/core/tools/FeedbackAlert";
import { useSession } from "@/core/security/session";
import { itSettingsService, type ITDevice } from "@/core/services/it/itSettingsService";
import { formatDateTime } from "@/lib/format";
import { RegisterDeviceModal } from "./modals/RegisterDeviceModal";
import { cn } from "@/lib/utils";

export default function DeviceDesk() {
  const session = useSession();
  const [search, setSearch] = useState("");
  const [devices, setDevices] = useState<ITDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<ITDevice | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const fetchDevices = async () => {
      setLoading(true);
      try {
        const data = await itSettingsService.getDevices(session.tenant_id, session);
        // Hierarchical filtering: 
        // - Super Admin sees all
        // - Owner sees all in tenant
        // - Branch IT sees only their location
        const filteredData = (Array.isArray(data) ? data : []).filter(d => {
          if (session.role === 'SUPERADMIN') return true;
          if (session.role === 'OWNER') return d.tenantId === session.tenant_id;
          return d.locationId === session.location_id;
        });
        setDevices(filteredData);
      } catch (err) {
        setErrorMessage("Failed to fetch devices.");
      } finally {
        setLoading(false);
      }
    };
    fetchDevices();
  }, [session, version]);

  const clearStatus = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const filtered = (Array.isArray(devices) ? devices : []).filter((dev) =>
    search ? dev.id.toLowerCase().includes(search.toLowerCase()) || dev.deviceName.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-6">
      <FeedbackAlert message={statusMessage} error={errorMessage} onClear={clearStatus} />
      <PageHeader
        title="Device Matrix"
        subtitle="Hierarchical asset mapping and connectivity orchestration."
        primaryAction={<Button onClick={() => setCreateOpen(true)}>Assign Device</Button>}
        secondaryActions={
          <Input
            placeholder="Search matrix..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[220px]"
          />
        }
      />

      <WorkspacePanel title="Infrastructure Inventory" description="Physical/logical asset mapping with hierarchical scope.">
        <FilterBar searchValue={search} onSearchChange={setSearch} />
        <DataTableShell total={filtered.length} page={1} pageSize={10}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Device Identity</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Location</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">Scanning frequency...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground italic">No assets mapped in this scope.</td></tr>
              ) : (
                (Array.isArray(filtered) ? filtered : []).map((dev) => (
                   <tr
                    key={dev.id}
                    className="border-t cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedDevice(dev)}
                  >
                    <td className="p-3 font-medium">
                       <div className="flex flex-col">
                          <span>{dev.deviceName}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{dev.id}</span>
                       </div>
                    </td>
                    <td className="p-3">
                       <Badge variant="outline" className="text-[9px] uppercase tracking-widest">{dev.deviceType}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{dev.locationId || "UNASSIGNED"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                         <span className={cn("h-1.5 w-1.5 rounded-full", dev.status === 'active' || dev.status === 'online' ? "bg-success" : "bg-destructive")} />
                         <span className="text-xs uppercase font-bold">{dev.status}</span>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground text-[10px] italic">{formatDateTime(dev.lastSeen)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DataTableShell>
      </WorkspacePanel>

      <RegisterDeviceModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultLocationId={session.location_id}
        existingDevices={devices}
        onSuccess={() => {
          setStatusMessage("Infrastructure node registered successfully.");
          setVersion((prev) => prev + 1);
        }}
      />

      <Dialog open={!!selectedDevice} onOpenChange={() => setSelectedDevice(null)}>
        <DialogContent className="max-w-md bg-background p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-8 text-white relative">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <Laptop className="h-24 w-24" />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-foreground/80 mb-2">Device Management</p>
             <h3 className="text-3xl font-black tracking-tighter uppercase italic">{selectedDevice?.deviceName}</h3>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 text-[10px] font-black uppercase tracking-widest gap-y-4">
              <div className="space-y-1">
                 <span className="text-muted-foreground">Node Identity</span>
                 <p className="text-xs font-mono font-bold">{selectedDevice?.id}</p>
              </div>
              <div className="space-y-1">
                 <span className="text-muted-foreground">Classification</span>
                 <p className="text-xs font-bold">{selectedDevice?.deviceType}</p>
              </div>
              <div className="space-y-1">
                 <span className="text-muted-foreground">Assigned Domain</span>
                 <p className="text-xs font-bold text-primary">{selectedDevice?.locationId || "UNASSIGNED"}</p>
              </div>
              <div className="space-y-1">
                 <span className="text-muted-foreground">Current Vector</span>
                 <p className="text-xs font-bold">{selectedDevice?.status}</p>
              </div>
            </div>
            
            <div className="p-4 rounded-2xl bg-card border border-border text-[9px] text-muted-foreground italic leading-relaxed">
              Managed via LAN-first physical mapping. Last seen: {selectedDevice ? formatDateTime(selectedDevice.lastSeen) : "N/A"}. Security policies active.
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="outline"
                className="w-full rounded-xl font-black text-[10px] uppercase tracking-widest py-6 border-muted dark:border-muted"
                onClick={async () => {
                  try {
                    if (selectedDevice) {
                      await itSettingsService.updateDeviceStatus(session.tenant_id, session, selectedDevice.id, "audited");
                      setStatusMessage(`Audit signal sent for device ${selectedDevice.deviceName}.`);
                      setVersion((prev) => prev + 1);
                      setSelectedDevice(null);
                    }
                  } catch (err) {
                    setErrorMessage("Failed to trigger audit.");
                  }
                }}
              >
                Trigger Deep Audit
              </Button>
              <Button
                variant="destructive"
                className="w-full rounded-xl font-black text-[10px] uppercase tracking-widest py-6 shadow-xl shadow-destructive/20"
                onClick={async () => {
                  try {
                    if (selectedDevice) {
                      await itSettingsService.updateDeviceStatus(session.tenant_id, session, selectedDevice.id, "wiped");
                      setStatusMessage(`Wipe command queued for ${selectedDevice.deviceName}. Security policy enforced.`);
                      setVersion((prev) => prev + 1);
                      setSelectedDevice(null);
                    }
                  } catch (err) {
                    setErrorMessage("Remote wipe failed.");
                  }
                }}
              >
                Execute Remote Wipe
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
