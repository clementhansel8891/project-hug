import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Building2, User, Fingerprint, Briefcase } from "lucide-react";

export const SidebarIdentityCard: React.FC = () => {
  const { user, session } = useAuth();

  if (!user || !session) return null;

  const currentCompany = user.user_companies?.find(uc => uc.tenant_id === session.tenant_id)?.company?.name || session.tenant_id;

  return (
    <div className="p-6 rounded-3xl bg-primary text-white shadow-2xl shadow-indigo-900/20 relative overflow-hidden group mb-6">
      {/* Dynamic Background Pattern */}
      <div className="absolute top-0 right-0 h-32 w-32 bg-muted rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-1000" />
      <div className="absolute bottom-0 left-0 h-24 w-24 bg-primary rounded-full -ml-12 -mb-12 blur-xl" />

      <div className="relative z-10 space-y-5">
        {/* Verification Header */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-primary rounded-xl flex items-center justify-center shadow-lg border border-border">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 italic">Node Verified</p>
        </div>

        {/* User Identity */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-black tracking-tighter truncate uppercase italic">
              {user.first_name} {user.last_name}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-bold text-primary uppercase tracking-widest">
            <Fingerprint className="h-3 w-3" />
            <span>ID: {session.user_id.slice(0, 12)}...</span>
          </div>
        </div>

        {/* Contextual Details */}
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center gap-3">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            <div className="space-y-0.5">
              <p className="text-[8px] font-black uppercase tracking-widest text-primary leading-none">Functional Role</p>
              <p className="text-[10px] font-black uppercase tracking-tight">{session.role} CORE</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <User className="h-3.5 w-3.5 text-primary" />
            <div className="space-y-0.5">
              <p className="text-[8px] font-black uppercase tracking-widest text-primary leading-none">Assignment</p>
              <p className="text-[10px] font-black uppercase tracking-tight">{session.department_id || "Unassigned"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <div className="space-y-0.5">
              <p className="text-[8px] font-black uppercase tracking-widest text-primary leading-none">Organization</p>
              <p className="text-[10px] font-black uppercase tracking-tight truncate max-w-[140px]">{currentCompany}</p>
            </div>
          </div>
        </div>

        {/* Global Access Badge */}
        <Badge className="w-full justify-center bg-white/10 hover:bg-white/20 border-border text-[9px] font-black py-1.5 rounded-xl text-white uppercase tracking-[0.2em] shadow-inner transition-colors">
          Security Level A-1
        </Badge>
      </div>
    </div>
  );
};
