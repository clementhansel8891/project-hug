import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface InventoryGlassHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  actions?: React.ReactNode;
  stats?: {
    label: string;
    value: string | number;
    trend?: number;
    color?: string;
  }[];
  children?: React.ReactNode;
}

export const InventoryGlassHeader: React.FC<InventoryGlassHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  actions,
  stats,
  children,
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative p-6 mb-8 rounded-[2.5rem] bg-muted backdrop-blur-3xl border border-border shadow-2xl overflow-hidden group"
    >
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-primary rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-success rounded-full blur-[100px]" />

      <div className="relative z-10 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          {/* Title Section */}
          <div className="flex items-center gap-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 shadow-xl border border-border text-white group-hover:scale-105 transition-transform duration-500">
              <Icon className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic leading-none">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground mt-2 uppercase">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Stats Row */}
          {stats && stats.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 bg-muted p-4 rounded-2xl border border-border backdrop-blur-md shadow-inner">
              {stats.map((stat, i) => (
                <div key={i} className="flex flex-col gap-0.5 px-4 border-r border-border last:border-none">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    {stat.label}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black italic text-white leading-none">
                      {stat.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {actions && (
            <div className="flex items-center gap-4">
              {actions}
            </div>
          )}
        </div>

        {children && (
          <div className="pt-4 border-t border-border">
            {children}
          </div>
        )}
      </div>
    </motion.div>
  );
};
