import * as React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { PageShell } from "@/core/ui/PageShell";
import { useSession } from "@/core/security/session";
import { cn } from "@/lib/utils";
import { 
  ChevronRight, 
  Menu,
  X,
  Monitor, 
  Target, 
  Settings,
  LucideIcon
} from "lucide-react";
import { SidebarIdentityCard } from "@/core/ui/SidebarIdentityCard";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

export type MenuItem = { label: string; to: string; icon: LucideIcon };
export type MenuSection = { title: string; items: MenuItem[] };

interface DepartmentWorkspaceLayoutProps {
  title: string;
  subtitle: string;
  headerIcon: LucideIcon;
  accentColor: string; // e.g., 'emerald', 'rose', 'amber', 'orange', 'blue', 'purple', 'indigo'
  engineName: string; // e.g., 'FINANCE ENGINE'
  pulseLabel: string; // e.g., 'Fiscal Pulse'
  pulseIcon: LucideIcon;
  sections: MenuSection[];
  routeLabels: Record<string, string>;
  basePath: string; // e.g., '/core/finance'
  headerActions?: React.ReactNode;
  children?: React.ReactNode;
}

export default function DepartmentWorkspaceLayout({
  title,
  subtitle,
  headerIcon: HeaderIcon,
  accentColor,
  engineName,
  pulseLabel,
  pulseIcon: PulseIcon,
  sections,
  routeLabels,
  basePath,
  headerActions,
  children,
}: DepartmentWorkspaceLayoutProps) {
  const session = useSession();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Close mobile nav on route change
  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    console.log(`[DepartmentWorkspaceLayout:${engineName}] Mounted`, {
      path: location.pathname,
      tenant_id: session.tenant_id,
      location_id: session.location_id,
      role: session.role,
      permissions: session.permissions?.length,
    });
  }, [engineName, location.pathname, session]);

  const segments = location.pathname.replace(basePath, "").split("/").filter(Boolean);
  const breadcrumbs = (Array.isArray(segments) ? segments : []).map((segment, index) => ({
    label: routeLabels[segment] ?? segment.replace(/-/g, " "),
    path: `${basePath}/${segments.slice(0, index + 1).join("/")}`,
  }));

  // Define accent color classes
  const colorMap: Record<string, string> = {
    emerald: "text-success bg-success shadow-emerald-600/20 border-l-emerald-600 border-success/20 hover:text-success from-emerald-500/5",
    rose: "text-destructive bg-destructive shadow-rose-600/20 border-l-rose-600 border-destructive/20 hover:text-destructive from-rose-500/5",
    amber: "text-warning bg-warning shadow-amber-600/20 border-l-amber-600 border-warning/20 hover:text-warning from-amber-500/5",
    orange: "text-destructive bg-destructive shadow-orange-600/20 border-l-orange-600 border-warning/20 hover:text-warning from-orange-500/5",
    blue: "text-primary bg-primary shadow-blue-600/20 border-l-blue-600 border-primary hover:text-primary from-blue-500/5",
    purple: "text-primary bg-primary shadow-purple-600/20 border-l-purple-600 border-primary/20 hover:text-primary from-purple-500/5",
    indigo: "text-primary bg-primary shadow-indigo-600/20 border-l-indigo-600 border-primary hover:text-primary from-indigo-500/5",
    slate: "text-muted-foreground bg-muted shadow-slate-600/20 border-l-slate-600 border-border/20 hover:text-muted-foreground from-slate-500/5",
  };

  const c = colorMap[accentColor] || colorMap.indigo;
  const [textC, bgC, shadowC, borderLC, borderC20, hoverTextC, fromC5] = c.split(" ");

  return (
    <div className="h-full bg-background font-sans overflow-hidden flex flex-col">
      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile nav drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 lg:hidden transition-transform duration-300 ease-in-out",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col bg-white/90 dark:bg-muted backdrop-blur-2xl border-r border-border/50 relative overflow-hidden">
          <div className={cn("absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b pointer-events-none opacity-20", fromC5)} />
          <div className="flex items-center justify-between p-4 border-b border-border/50 relative z-10">
            <span className="text-sm font-black uppercase tracking-widest text-muted-foreground">{title}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 relative z-10">
            <div className="p-4 space-y-8">
              <SidebarIdentityCard />
              {(Array.isArray(sections) ? sections : []).map((section) => (
                <div key={section.title} className="space-y-4">
                  <p className={cn("text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground pl-4 border-l-2", borderC20)}>
                    {section.title}
                  </p>
                  <div className="space-y-1.5">
                    {(Array.isArray(section.items) ? section.items : []).map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.to || (item.to === basePath && location.pathname === `${basePath}/`);
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={cn(
                            "group flex items-center gap-4 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all duration-300 relative overflow-hidden",
                            isActive
                              ? cn("bg-white dark:bg-muted shadow-md translate-x-2 border-l-4", textC, shadowC, borderLC)
                              : cn("text-muted-foreground hover:bg-muted0 dark:hover:bg-muted hover:translate-x-1", hoverTextC),
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="flex-1 truncate tracking-[0.1em]">{item.label}</span>
                          <ChevronRight className={cn("h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity", isActive ? "opacity-100" : "")} />
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      <PageShell
        header={
          <div className="space-y-4 px-4 md:px-10 py-4 md:py-8 border-b border-border bg-background/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-9 w-9 shrink-0"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to="/core" className={cn("text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground transition-all flex items-center gap-2", `hover:${textC}`)}>
                         <Monitor className="h-3 w-3" /> CORE_SYSTEM
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-muted-foreground" />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={basePath} className={cn("text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground transition-all", `hover:${textC}`)}>{engineName}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {(Array.isArray(breadcrumbs) ? breadcrumbs : []).map((item, index) => (
                    <React.Fragment key={item.path}>
                      <BreadcrumbSeparator className="text-muted-foreground" />
                      <BreadcrumbItem>
                        {index === breadcrumbs.length - 1 ? (
                          <BreadcrumbPage className={cn("text-[9px] font-black uppercase tracking-[0.2em] italic", textC)}>{item.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={item.path} className={cn("text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground transition-all", `hover:${textC}`)}>
                              {item.label}
                            </Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            
            <div className="flex items-center justify-between flex-wrap gap-4">
               <div className="flex items-center gap-4 md:gap-8">
                  <div className={cn("h-12 w-12 md:h-20 md:w-20 rounded-2xl md:rounded-[2.5rem] flex items-center justify-center shadow-2xl group hover:rotate-12 transition-all duration-500 border border-border", bgC, shadowC)}>
                     <HeaderIcon className="h-6 w-6 md:h-10 md:w-10 text-white" />
                  </div>
                  <div>
                     <h2 className="text-xl md:text-5xl font-black tracking-tighter text-foreground uppercase italic leading-none">{title}</h2>
                     <p className="text-[8px] md:text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] leading-relaxed italic mt-2 md:mt-4 flex items-center gap-2">
                        <Target className={cn("h-3 w-3 md:h-4 md:w-4", textC)} /> {subtitle}
                     </p>
                  </div>
               </div>
               
               <div className="flex items-center gap-2 md:gap-4">
                  {headerActions}
                  <div className="hidden sm:flex items-center gap-3 bg-background px-4 py-2.5 rounded-2xl border border-border shadow-sm">
                     <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", bgC)} />
                     <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Telemetry Active</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-10 w-10 md:h-14 md:w-14 rounded-2xl hover:bg-muted dark:hover:bg-muted transition-all">
                     <Settings className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                  </Button>
               </div>
            </div>
          </div>
        }
        left={
          <div className="h-full flex flex-col bg-card backdrop-blur-2xl border-r border-border relative overflow-hidden w-64 md:w-80">
            <div className={cn("absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b pointer-events-none opacity-20", fromC5)} />
            
            <ScrollArea className="flex-1 relative z-10">
              <div className="p-4 md:p-8 space-y-12">
                <SidebarIdentityCard />

                {(Array.isArray(sections) ? sections : []).map((section) => (
                  <div key={section.title} className="space-y-6">
                    <p className={cn("text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground pl-4 border-l-2", borderC20)}>
                      {section.title}
                    </p>
                    <div className="space-y-1.5">
                      {(Array.isArray(section.items) ? section.items : []).map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.to || (item.to === basePath && location.pathname === `${basePath}/`);
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className={cn(
                                "group flex items-center gap-4 rounded-2xl px-4 py-4 text-[10px] font-black uppercase tracking-widest transition-all duration-500 relative overflow-hidden",
                                isActive
                                  ? cn("bg-white dark:bg-muted shadow-2xl translate-x-4 border-l-4", textC, shadowC, borderLC)
                                  : cn("text-muted-foreground hover:bg-muted0 dark:hover:bg-muted hover:translate-x-2", hoverTextC),
                              )
                            }
                          >
                            <Icon className={cn("h-5 w-5 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6")} />
                            <span className="flex-1 truncate tracking-[0.1em]">{item.label}</span>
                            <ChevronRight className={cn("h-3 w-3 transition-all duration-500 opacity-0 group-hover:opacity-100", isActive ? "opacity-100" : "")} />
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="p-6 border-t border-border bg-card backdrop-blur-3xl relative z-10">
               <div className="flex items-center justify-between p-5 rounded-[1.5rem] bg-background shadow-xl border border-border group hover:shadow-2xl transition-all duration-500 cursor-pointer">
                  <div className="flex items-center gap-4">
                     <div className="relative">
                        <div className={cn("h-2.5 w-2.5 rounded-full animate-ping absolute inset-0 opacity-40", bgC)} />
                        <div className={cn("h-2.5 w-2.5 rounded-full relative z-10 shadow-lg", bgC)} />
                     </div>
                     <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground leading-none">{pulseLabel}</p>
                        <p className={cn("text-[8px] font-black uppercase tracking-[0.2em] animate-pulse italic leading-none", textC)}>Operational</p>
                     </div>
                  </div>
                  <PulseIcon className={cn("h-5 w-5 text-muted-foreground transition-colors", `group-hover:${textC}`)} />
               </div>
            </div>
          </div>
        }
      >
        <div className="p-0 h-full">
          <ErrorBoundary>
            {children || <Outlet />}
          </ErrorBoundary>
        </div>
      </PageShell>
    </div>
  );
}
