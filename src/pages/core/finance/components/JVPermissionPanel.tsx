import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { financeService } from "@/core/services/finance/financeService";
import { useSession } from "@/core/security/session";
import { useNotifications } from "@/contexts/NotificationContext";
import { Shield, Save, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const JV_MODULES = [
  { key: "expenses", label: "Expenses", desc: "Log and approve shared costs" },
  { key: "procurement", label: "Procurement", desc: "Purchase orders and suppliers" },
  { key: "inventory", label: "Inventory", desc: "Stock management and movements" },
  { key: "pos", label: "POS", desc: "Point of sale operations" },
  { key: "sales", label: "Sales", desc: "Leads, opportunities, quotes" },
  { key: "finance_read", label: "Finance (Read)", desc: "View journal entries and reports" },
  { key: "finance_write", label: "Finance (Write)", desc: "Create journal entries" },
];

const ACCESS_LEVELS = [
  { value: "none", label: "No Access", color: "text-muted-foreground" },
  { value: "read", label: "Read Only", color: "text-blue-600" },
  { value: "write", label: "Read & Write", color: "text-success" },
  { value: "manage", label: "Full Access", color: "text-primary" },
];

interface JVPermissionPanelProps {
  profileId: string;
  profiles: any[];
}

export function JVPermissionPanel({ profileId, profiles }: JVPermissionPanelProps) {
  const session = useSession();
  const { addNotification } = useNotifications();
  const [participants, setParticipants] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profileId && session) {
      loadParticipants();
    }
  }, [profileId, session]);

  const loadParticipants = async () => {
    try {
      const profile = await financeService.getJVProfileDetail(session, profileId);
      if (profile?.participants) {
        setParticipants(profile.participants);
        // Load permissions for each participant
        const permsMap: Record<string, Record<string, string>> = {};
        for (const p of profile.participants) {
          try {
            const perms = await financeService.getJVPermissions(session, p.id);
            permsMap[p.id] = perms;
          } catch {
            permsMap[p.id] = {};
          }
        }
        setPermissions(permsMap);
      }
    } catch (e) {
      console.error("Failed to load participants", e);
    }
  };

  const updatePermission = (participantId: string, module: string, level: string) => {
    setPermissions(prev => ({
      ...prev,
      [participantId]: {
        ...(prev[participantId] || {}),
        [module]: level,
      },
    }));
    setDirty(true);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const [participantId, perms] of Object.entries(permissions)) {
        const permArray = Object.entries(perms).map(([module, access_level]) => ({
          module,
          access_level,
        }));
        await financeService.setJVBulkPermissions(session, {
          participant_id: participantId,
          permissions: permArray,
        });
      }
      addNotification({
        type: "success",
        title: "Permissions Saved",
        message: "Partner access levels updated successfully.",
      });
      setDirty(false);
    } catch (e) {
      addNotification({
        type: "error",
        title: "Save Failed",
        message: "Could not update permissions.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (participants.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Users className="h-12 w-12 mx-auto opacity-20 mb-3" />
        <p className="italic">No participants in this JV profile yet.</p>
        <p className="text-xs mt-1">Invite a partner to configure access permissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Module Access Control
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure what each JV partner can access within your workspace.
          </p>
        </div>
        {dirty && (
          <Button onClick={saveAll} disabled={saving} size="sm" className="gap-2">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      {participants.map((p) => (
        <div key={p.id} className="border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-primary">
                Tenant: {p.participant_tenant_id.substring(0, 8)}...
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px]">{p.role}</Badge>
                <span className="text-[10px] text-muted-foreground">
                  Rev: {Number(p.revenue_share_pct)}% • Profit: {Number(p.profit_share_pct)}%
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            {JV_MODULES.map(mod => {
              const currentLevel = permissions[p.id]?.[mod.key] || "none";
              return (
                <div key={mod.key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{mod.label}</p>
                    <p className="text-[10px] text-muted-foreground">{mod.desc}</p>
                  </div>
                  <Select
                    value={currentLevel}
                    onValueChange={(v) => updatePermission(p.id, mod.key, v)}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_LEVELS.map(level => (
                        <SelectItem key={level.value} value={level.value}>
                          <span className={cn("font-medium", level.color)}>{level.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
