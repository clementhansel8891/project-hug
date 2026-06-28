import React, { useState } from 'react';
import { Menu, Maximize2, Minimize2, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OperationalLauncherOverlay } from '../components/OperationalLauncherOverlay';
import { useLocation } from 'react-router-dom';

export const RetailOperationalShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const location = useLocation();

  const isGateway = location.pathname.endsWith('/operational/gateway');

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col relative overflow-hidden">
      {/* 6.1 Launcher Button - Minimal entry point */}
      {!isGateway && (
        <div className="absolute top-4 left-4 z-50 flex gap-2">
          <Button 
            variant="secondary" 
            size="sm" 
            className="h-10 px-4 rounded-xl font-black italic tracking-widest uppercase gap-2 shadow-lg border border-border bg-secondary/40 hover:bg-muted/10 text-white group backdrop-blur-xl"
            onClick={() => setIsLauncherOpen(true)}
          >
            <Menu className="w-4 h-4 text-primary group-hover:rotate-90 transition-transform" />
            Apps
          </Button>

          <Button 
            variant="secondary" 
            size="icon" 
            className="h-10 w-10 rounded-xl shadow-lg border border-border bg-secondary/40 hover:bg-muted/10 text-white flex items-center justify-center transition-all backdrop-blur-xl"
            onClick={() => window.location.href = "/"}
            title="Return to Core Home"
          >
            <Home className="w-4 h-4 text-primary" />
          </Button>

          <Button 
            variant="secondary" 
            size="icon" 
            className="h-10 w-10 rounded-xl shadow-lg border border-border bg-secondary/40 hover:bg-muted/10 text-white flex items-center justify-center transition-all backdrop-blur-xl"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-primary" /> : <Maximize2 className="w-4 h-4 text-primary" />}
          </Button>
        </div>
      )}

      {/* Main content - 4.1 Zero-clutter execution mode */}
      <main className="flex-1 overflow-auto pt-16">
        {children}
      </main>

      {/* Launcher Overlay */}
      <OperationalLauncherOverlay 
        isOpen={isLauncherOpen} 
        onClose={() => setIsLauncherOpen(false)} 
      />
    </div>
  );
};
