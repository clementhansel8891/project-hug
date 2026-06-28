import React from "react";
import { Building2, MapPin, Globe } from "lucide-react";
import { useRetail } from "../../context/RetailContext";

interface LocationSwitcherProps {
  currentLocationId?: string;
  onLocationChange: (locationId?: string) => void;
}

export const LocationSwitcher: React.FC<LocationSwitcherProps> = ({
  currentLocationId,
  onLocationChange,
}) => {
  const { stores } = useRetail();

  return (
    <div className="flex items-center gap-1.5 p-1 bg-secondary/50 backdrop-blur-md rounded-2xl border border-border/50 overflow-x-auto max-w-full no-scrollbar">
      <button
        onClick={() => onLocationChange(undefined)}
        className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all duration-300 whitespace-nowrap ${
          !currentLocationId
            ? "bg-card shadow-[0_4px_10px_rgba(0,0,0,0.05)] text-foreground border border-border"
            : "text-muted-foreground hover:text-muted-foreground border border-transparent"
        }`}
      >
        <Globe className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Global Root</span>
      </button>

      {(Array.isArray(stores) ? stores : []).map((store) => (
        <button
          key={store.id}
          onClick={() => onLocationChange(store.id)}
          className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all duration-300 whitespace-nowrap ${
            currentLocationId === store.id
              ? "bg-card shadow-[0_4px_10px_rgba(0,0,0,0.05)] text-foreground border border-border"
              : "text-muted-foreground hover:text-muted-foreground border border-transparent"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />{" "}
          <span className="hidden sm:inline">{store.name}</span>
        </button>
      ))}
    </div>
  );
};
