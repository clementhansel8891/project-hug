import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Compass, ArrowLeft } from "lucide-react";

import { GlassCard, GlassCardContent } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <GlassCard variant="morphism" className="w-full max-w-md rounded-3xl border border-border dark:border-white/5 shadow-2xl">
        <GlassCardContent className="flex flex-col items-center p-10 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-primary/10 text-primary">
            <Compass className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mb-2 text-4xl font-black tracking-tight text-foreground">404</h1>
          <p className="mb-8 text-sm font-medium text-muted-foreground">
            We couldn't find the page you were looking for.
          </p>
          <Button asChild size="lg" className="gap-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Return to Home
            </Link>
          </Button>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
};

export default NotFound;
