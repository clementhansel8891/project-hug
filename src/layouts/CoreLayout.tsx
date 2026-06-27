import { useState, useEffect } from "react";
import type { ElementType } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationCenter } from "@/components/shared/NotificationCenter";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";
import { getSettings } from "@/lib/local-storage";
import { getAllModuleContracts } from "@/core/runtime/moduleRegistry";
import { OfflineIndicator } from "@/components/shared/OfflineIndicator";
import { JVWorkspaceSwitcher } from "@/core/ui/JVWorkspaceSwitcher";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Puzzle,
  BarChart3,
  Link2,
  Settings,
  Shield,
  Wallet,
  CreditCard,
  Package,
  ShoppingCart,
  ShieldCheck,
  Users2,
  Inbox,
  Wrench,
  FolderOpen,
  Menu,
  X,
  Moon,
  Sun,
  LogOut,
  Megaphone,
  Mail,
  MessageSquare,
  FileText,
  ChevronLeft,
  ChevronRight,
  Warehouse,
} from "lucide-react";

type NavItem = {
  path: string;
  icon: ElementType;
  label: string;
  end?: boolean;
  badgeKey?: 'notifications' | 'chat' | 'mail';
};
type NavSection = { title: string; items: NavItem[] };

const baseNavSections: NavSection[] = [
  {
    title: "WorkSuite",
    items: [
      { path: "/core", icon: LayoutDashboard, label: "Dashboard", end: true },
      { path: "/core/tools", icon: Wrench, label: "WorkTools" },
      { path: "/core/bulletin", icon: Megaphone, label: "Bulletin" },
      { path: "/core/mail", icon: Mail, label: "Mail", badgeKey: 'mail' },
      { path: "/core/chat", icon: MessageSquare, label: "Chat", badgeKey: 'chat' },
      { path: "/core/portal", icon: LayoutDashboard, label: "Staff Portal" },
    ],
  },
  {
    title: "Management",
    items: [
      { path: "/core/finance", icon: Wallet, label: "Finance" },
      { path: "/core/procurement", icon: ShoppingCart, label: "Procurement" },
      { path: "/core/inventory", icon: Package, label: "Inventory" },
      { path: "/core/warehouse", icon: Warehouse, label: "Warehouse" },
      { path: "/core/hr", icon: Users2, label: "HR" },
      { path: "/core/it", icon: ShieldCheck, label: "IT" },
    ],
  },
  {
    title: "Commerce & Growth",
    items: [
      { path: "/core/sales", icon: BarChart3, label: "Sales" },
      { path: "/core/marketing", icon: Link2, label: "Marketing" },
    ],
  },
  {
    title: "Backbone",
    items: [
      { path: "/retail", icon: ShoppingCart, label: "Module Retail" },
      { path: "/core/license", icon: Puzzle, label: "Module Hub" },
      { path: "/core/reports", icon: BarChart3, label: "Reports" },
      { path: "/core/audit", icon: ShieldCheck, label: "Audit Logs" },
      { path: "/core/logs", icon: FileText, label: "System Logs" },
      { path: "/core/security", icon: ShieldCheck, label: "Security" },
      { path: "/core/settings", icon: Settings, label: "Settings" },
    ],
  },
];

export function CoreLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved === "true";
  });
  const [userExplicitCollapse, setUserExplicitCollapse] = useState(false);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(isCollapsed));
  }, [isCollapsed]);

  // Dynamic Industry Modules
  const { state: appState, toggleTheme } = useApp();
  const { logout } = useAuth();
  const { unreadCounts } = useNotifications();
  const location = useLocation();

  // Auto-collapse main sidebar when inside a department workspace (has its own secondary nav)
  const DEPT_WORKSPACE_PREFIXES = ['/core/finance', '/core/hr', '/core/procurement', '/core/inventory', '/core/warehouse', '/core/it', '/core/sales', '/core/marketing', '/core/payment'];
  const isInDepartmentWorkspace = DEPT_WORKSPACE_PREFIXES.some(prefix => location.pathname.startsWith(prefix) && location.pathname !== prefix);

  useEffect(() => {
    if (isInDepartmentWorkspace && !userExplicitCollapse) {
      setIsCollapsed(true);
    }
  }, [isInDepartmentWorkspace, userExplicitCollapse]);
  const { settings } = appState;
  const activatedIds = settings.activatedModuleIds || [];
  const allContracts = getAllModuleContracts();
  const activatedModules = (Array.isArray(allContracts) ? allContracts : []).filter(c => activatedIds.includes(c.id))
    .map(c => ({
      path: `/m/${c.id}/${c.getPages(c.getDefaultConfig())[0]?.id || ''}`,
      icon: c.id === 'retail' ? ShoppingCart : Puzzle,
      label: c.name
    }));

  const navSections = [
    ...baseNavSections.slice(0, 3), // WorkSuite, Management, Commerce
    ...(activatedModules.length > 0 ? [{
      title: "Activated Modules",
      items: activatedModules
    }] : []),
    baseNavSections[3] // Backbone
  ];

  const toggleSidebar = () => {
    setUserExplicitCollapse(true);
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out border-r border-sidebar-border shadow-xl",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="flex flex-col h-full relative">
          {/* Collapse Toggle Button (Desktop) */}
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-primary text-primary-foreground rounded-full items-center justify-center border border-sidebar-border shadow-md hover:scale-110 transition-transform z-50"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Logo */}
          <div className={cn(
            "flex items-center justify-between p-4 border-b border-sidebar-border overflow-hidden transition-all duration-300",
            isCollapsed ? "justify-center" : "px-4"
          )}>
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner">
                <LayoutDashboard
                  size={20}
                  className="text-primary"
                />
              </div>
              {!isCollapsed && (
                <span className="font-bold text-lg whitespace-nowrap animate-in fade-in slide-in-from-left-2">
                  {settings?.businessName || "OpsCore"}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => setSidebarOpen(false)}
              >
                <X size={20} />
              </Button>
            )}
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="px-3 space-y-6">
              {(Array.isArray(navSections) ? navSections : []).map((section) => (
                <div key={section.title} className="space-y-2">
                  {!isCollapsed ? (
                    <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 animate-in fade-in">
                      {section.title}
                    </p>
                  ) : (
                    <div className="h-px bg-sidebar-border mx-2" />
                  )}
                  <div className="space-y-1">
                    {(Array.isArray(section.items) ? section.items : []).map(({ path, icon: Icon, label, end, badgeKey }) => (
                      <NavLink
                        key={path}
                        to={path}
                        end={end}
                        className={({ isActive }) =>
                          cn(
                            "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative",
                            isActive || (path !== '/core' && location.pathname.startsWith(path))
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground hover:translate-x-1",
                            isCollapsed && "justify-center px-0 hover:translate-x-0"
                          )
                        }
                        onClick={() => setSidebarOpen(false)}
                        title={isCollapsed ? label : undefined}
                      >
                        <Icon size={isCollapsed ? 22 : 18} className={cn(
                          "transition-transform",
                          !isCollapsed && "group-hover:scale-110"
                        )} />
                        {!isCollapsed && (
                          <span className="flex-1 whitespace-nowrap animate-in fade-in slide-in-from-left-1">{label}</span>
                        )}
                        
                        {/* Tooltip for collapsed mode */}
                        {isCollapsed && (
                          <div className="absolute left-full ml-4 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-md whitespace-nowrap">
                            {label}
                          </div>
                        )}

                        {badgeKey && unreadCounts && unreadCounts[badgeKey] > 0 && (
                          <span className={cn(
                            "bg-destructive text-[10px] font-black text-destructive-foreground rounded-full flex items-center justify-center shadow-lg shadow-destructive/20 animate-in zoom-in",
                            isCollapsed ? "absolute top-1 right-1 h-4 w-4" : "h-5 min-w-[20px] px-1"
                          )}>
                            {isCollapsed ? '' : (unreadCounts[badgeKey] > 9 ? '9+' : unreadCounts[badgeKey])}
                          </span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-sidebar-border space-y-4 bg-sidebar/50">
            {!isCollapsed && <OfflineIndicator showText className="text-sidebar-foreground/70" />}

            <div className={cn(
              "flex items-center gap-2",
              isCollapsed ? "flex-col" : "justify-between"
            )}>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-sidebar-foreground/70 hover:bg-sidebar-accent h-9 w-9 rounded-lg"
                  onClick={toggleTheme}
                >
                  {settings.theme === "dark" ? (
                    <Sun size={18} />
                  ) : (
                    <Moon size={18} />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-sidebar-foreground/70 hover:bg-sidebar-accent h-9 w-9 rounded-lg"
                  onClick={logout}
                >
                  <LogOut size={18} />
                </Button>
              </div>
            </div>

            {appState.currentUser && !isCollapsed && (
              <div className="pt-2 animate-in fade-in slide-in-from-bottom-2">
                <p className="text-sm font-semibold text-sidebar-foreground truncate">
                  {appState.currentUser.name}
                </p>
                <p className="text-[10px] text-muted-foreground/80 uppercase tracking-tighter font-bold">
                  {appState.currentUser.role}
                </p>
              </div>
            )}
            {appState.currentUser && isCollapsed && (
              <div className="flex justify-center pt-1 group relative">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                  {appState.currentUser.name.charAt(0)}
                </div>
                <div className="absolute left-full ml-4 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-md whitespace-nowrap">
                  {appState.currentUser.name} ({appState.currentUser.role})
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 relative bg-background overflow-hidden transition-all duration-300 ease-in-out">
        {/* Header */}
        <header className="glass-header flex items-center justify-between px-4 md:px-6 h-16 sticky top-0 z-30 transition-all">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden hover:bg-accent"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <JVWorkspaceSwitcher />
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <NotificationCenter />
            <div className="h-6 w-px bg-border hidden sm:block" />
            <OfflineIndicator showText={false} className="hidden sm:flex" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden transition-all">
          <div className="mx-auto w-full h-full">
            <PageErrorBoundary key={location.pathname} routeLabel="Core">
              <Outlet />
            </PageErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
