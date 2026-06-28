// ============================================================================
// MODULE LAYOUT
// ============================================================================
//
// Purpose:
// - Shell wrapper for the retail module (the only module using /m/ routing)
// - Retail has its own RetailRootLayout, so this is a minimal pass-through
//
// ============================================================================

import { Outlet, useParams, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";

export function ModuleLayout() {
  const { moduleId } = useParams();
  const location = useLocation();

  // Retail uses its own RetailRootLayout which handles all shell logic
  const isRetail = moduleId === 'retail';
  const isOperational = location.pathname.includes('/operational/');
  const hideHeader = isRetail || isOperational;
  const noPadding = isOperational || isRetail;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Hidden for retail (it has its own shell) */}
      {!hideHeader && (
        <header className="border-b px-6 py-3 font-semibold bg-background z-[40]">
          {moduleId}
        </header>
      )}

      {/* Module Content */}
      <main className={cn("flex-1", !noPadding && "p-6")}>
        <PageErrorBoundary
          key={location.pathname}
          routeLabel={moduleId ? `Module: ${moduleId}` : "Module"}
        >
          <Outlet />
        </PageErrorBoundary>
      </main>
    </div>
  );
}
