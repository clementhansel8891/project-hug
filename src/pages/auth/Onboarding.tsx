import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { COUNTRIES, getCountry } from "@/lib/countries";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    country?: string;
    state?: string;
  };
}

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    industry: "retail",
    country: "US",
    address: "",
    latitude: 0,
    longitude: 0,
    google_place_id: "",
    formatted_address: "",
    geofence_radius: 200,
  });
  const selectedCountry = getCountry(formData.country);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { provisionCompany } = useAuth();
  const navigate = useNavigate();

  // Nominatim geocoder state
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<NominatimResult[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationSelected, setLocationSelected] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search Nominatim (free, no API key needed)
  const searchLocation = async (query: string) => {
    if (query.length < 3) { setLocationResults([]); setShowDropdown(false); return; }
    setLocationLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data: NominatimResult[] = await res.json();
      setLocationResults(data);
      setShowDropdown(data.length > 0);
    } catch {
      setLocationResults([]);
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => {
    if (locationSelected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocation(locationQuery), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [locationQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectLocation = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setFormData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lon,
      formatted_address: result.display_name,
      address: prev.address || result.display_name,
    }));
    setLocationQuery(result.display_name);
    setLocationSelected(true);
    setShowDropdown(false);
    setLocationResults([]);
  };

  const handleProvision = async () => {
    setError("");
    setLoading(true);

    const result = await provisionCompany(formData);
    if (result.success) {
      navigate("/core/dashboard");
    } else {
      setError(
        result.error || "Failed to provision company. Please try again.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[120px] animate-pulse pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4">
        <h2 className="text-center text-4xl font-black italic tracking-tighter text-foreground uppercase leading-none">
          Initialize Workspace
        </h2>
        <p className="mt-4 text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
          Provisioning a dedicated cloud environment tailored to your operation structure.
        </p>
      </div>

      <div className="mt-12 sm:mx-auto sm:w-full sm:max-w-xl z-10 px-4">
        <GlassCard variant="morphism" className="rounded-[2.5rem] shadow-2xl border border-border overflow-hidden p-1 transition-all duration-500">
          <div className="bg-background/40 backdrop-blur-md rounded-[2.1rem] py-10 px-6 sm:px-12">
          {/* Progress Indicator */}
          <div className="mb-10">
            <div className="overflow-hidden h-1.5 rounded-full bg-muted shadow-inner">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700 ease-out shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                style={{ width: `${(step / 2) * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-2 text-[10px] font-black uppercase tracking-[0.2em] mt-3 text-center">
              <span className={step >= 1 ? "text-primary" : "text-muted-foreground opacity-50"}>
                Identity
              </span>
              <span className={step >= 2 ? "text-primary" : "text-muted-foreground opacity-50"}>
                Provisioning
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-destructive/10 border-l-4 border-destructive text-destructive text-xs font-bold uppercase tracking-widest rounded-r-xl flex items-center animate-in fade-in zoom-in duration-300">
              <svg
                className="w-5 h-5 mr-3 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="space-y-2">
                <label htmlFor="onboarding-company-name" className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">
                  Company Name
                </label>
                <div className="relative">
                  <input
                    id="onboarding-company-name"
                    type="text"
                    required
                    className="block w-full px-5 py-4 rounded-2xl border border-border bg-background/50 backdrop-blur-sm shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-300 font-bold"
                    placeholder="e.g. Estela Gea Corp"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="onboarding-address" className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">
                  Office / HQ Address
                </label>
                <div className="relative">
                  <textarea
                    id="onboarding-address"
                    required
                    rows={3}
                    className="block w-full px-5 py-4 rounded-2xl border border-border bg-background/50 backdrop-blur-sm shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-300 font-bold resize-none"
                    placeholder="Enter full physical address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Geospatial Geofence Section */}
              <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10 space-y-6 shadow-inner">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Geospatial Anchoring
                  </label>
                  <span className="text-[9px] font-black px-3 py-1 bg-primary text-primary-foreground rounded-full uppercase tracking-widest shadow-lg shadow-primary/20">
                    HQ Geofence
                  </span>
                </div>

                {/* Location Search — powered by Nominatim (OpenStreetMap, free) */}
                <div ref={searchRef} className="relative space-y-2">
                  <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1 opacity-70">
                    Search Location
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      className="block w-full pl-12 pr-12 py-4 rounded-2xl border border-border bg-background/80 backdrop-blur-sm shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-300 font-bold"
                      placeholder="Search area, address…"
                      value={locationQuery}
                      onChange={(e) => {
                        setLocationSelected(false);
                        setLocationQuery(e.target.value);
                      }}
                      autoComplete="off"
                    />
                    {/* Search icon */}
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {/* Loading spinner / clear */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {locationLoading ? (
                        <svg className="animate-spin w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : locationQuery ? (
                        <button type="button" onClick={() => { setLocationQuery(""); setFormData(p => ({ ...p, latitude: 0, longitude: 0 })); setLocationSelected(false); }}>
                          <svg className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Dropdown results */}
                  {showDropdown && locationResults.length > 0 && (
                    <div className="absolute z-50 mt-3 w-full glass-morphism rounded-2xl shadow-2xl border border-border dark:border-border overflow-hidden animate-in fade-in zoom-in duration-200">
                      {(Array.isArray(locationResults) ? locationResults : []).map((r) => (
                        <button
                          key={r.place_id}
                          type="button"
                          className="w-full px-5 py-4 text-left hover:bg-primary/10 transition-colors border-b border-border/50 last:border-0"
                          onClick={() => handleSelectLocation(r)}
                        >
                          <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span className="text-xs font-bold text-foreground leading-relaxed line-clamp-2 uppercase tracking-tight">{r.display_name}</span>
                          </div>
                        </button>
                      ))}
                      <div className="px-5 py-2 bg-muted/30 border-t border-border/50 flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Public Geospatial Index</span>
                        <span className="text-[9px] font-black uppercase text-primary tracking-widest opacity-50">OSM Powered</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Coordinates display (read-only after selection, editable fallback) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1 opacity-70">Latitude</label>
                    <input
                      type="number" step="any"
                      className={`block w-full px-4 py-3 rounded-xl border text-sm transition-all duration-300 font-bold ${locationSelected ? "bg-primary/10 border-primary/20 text-primary" : "bg-background/50 border-border text-foreground"}`}
                      placeholder="0.0000"
                      value={formData.latitude || ""}
                      onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1 opacity-70">Longitude</label>
                    <input
                      type="number" step="any"
                      className={`block w-full px-4 py-3 rounded-xl border text-sm transition-all duration-300 font-bold ${locationSelected ? "bg-primary/10 border-primary/20 text-primary" : "bg-background/50 border-border text-foreground"}`}
                      placeholder="0.0000"
                      value={formData.longitude || ""}
                      onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Confirmation badge after selection */}
                {locationSelected && formData.latitude !== 0 && (
                  <div className="flex items-center gap-3 px-5 py-3 bg-success/10 border border-success/20 rounded-2xl animate-in zoom-in duration-300 shadow-lg shadow-success/5">
                    <svg className="w-5 h-5 text-success flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[10px] text-success font-black uppercase tracking-widest">
                      Pinned: {formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}
                    </span>
                  </div>
                )}

                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1 flex justify-between">
                    <span>Geofence Radius</span>
                    <span className="text-primary font-black italic">{formData.geofence_radius}m</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary shadow-inner"
                    value={formData.geofence_radius}
                    onChange={(e) => setFormData({ ...formData, geofence_radius: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">
                  Industry
                </label>
                <div className="relative">
                  <select
                    className="block w-full px-5 py-4 rounded-2xl border border-border bg-background/50 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-300 font-bold appearance-none cursor-pointer"
                    value={formData.industry}
                    onChange={(e) =>
                      setFormData({ ...formData, industry: e.target.value })
                    }
                  >
                    <option value="retail">Retail & Merchandising</option>
                    <option value="services">Professional Services</option>
                    <option value="tech">Technology / SaaS</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="healthcare">Healthcare & Medical</option>
                    <option value="logistics">Logistics & Supply Chain</option>
                    <option value="education">Education & Training</option>
                    <option value="finance">Financial Services</option>
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                    <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">
                  Operation Region
                </label>
                <div className="relative">
                  <select
                    className="block w-full px-5 py-4 rounded-2xl border border-border bg-background/50 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-300 font-bold appearance-none cursor-pointer"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                  >
                    {(Array.isArray(COUNTRIES) ? COUNTRIES : []).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                    <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Live Currency Preview */}
                {selectedCountry && (
                  <div className="mt-4 inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-primary/5 border border-primary/10 shadow-sm">
                    <span className="text-sm font-black text-foreground">
                      {selectedCountry.flag} {selectedCountry.name}
                    </span>
                    <span className="text-muted-foreground/30">•</span>
                    <span className="text-sm font-black italic text-primary uppercase tracking-wider">
                      {selectedCountry.currency}
                    </span>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                      — {selectedCountry.symbol}
                    </span>
                  </div>
                )}

                <p className="mt-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50 leading-relaxed ml-1">
                  Initial compliance configuration derived from regional selection.
                </p>
              </div>

              <div className="pt-6">
                <Button
                  type="button"
                  size="lg"
                  disabled={!formData.name || !formData.address}
                  onClick={() => setStep(2)}
                  className="w-full py-5 rounded-2xl shadow-2xl shadow-primary/20 hover:shadow-primary/30 tracking-[0.15em]"
                >
                  <span>Initialization Protocol</span>
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-10 text-center animate-in fade-in slide-in-from-right-8 duration-500 py-4">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-[2rem] bg-primary/10 text-primary shadow-xl shadow-primary/10 mb-8 group transition-transform duration-500 hover:scale-110">
                <svg
                  className="h-10 w-10 group-hover:rotate-12 transition-transform duration-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black italic tracking-tighter text-foreground uppercase leading-tight">
                  Finalizing Parameters
                </h3>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">
                  Verify your partition configuration before deployment.
                </p>
              </div>

              <div className="bg-muted/30 rounded-[2rem] p-8 text-left text-xs space-y-4 border border-border/50 shadow-inner">
                <div className="grid grid-cols-3 gap-y-4 items-center">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">ID Entity</div>
                  <div className="col-span-2 font-black text-foreground uppercase tracking-tight">
                    {formData.name}
                  </div>

                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Industry</div>
                  <div className="col-span-2 font-black text-primary uppercase tracking-wider italic">
                    {formData.industry}
                  </div>

                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Geo Anchor</div>
                  <div className="col-span-2 font-black text-foreground uppercase tracking-tight truncate">
                    {formatNumber(formData.latitude, { maximumFractionDigits: 5 })},{" "}
                    {formatNumber(formData.longitude, { maximumFractionDigits: 5 })}
                  </div>

                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Compliance</div>
                  <div className="col-span-2 font-black text-foreground uppercase tracking-tight">
                    {selectedCountry?.flag} {selectedCountry?.name}
                  </div>
                </div>
              </div>

              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50 leading-relaxed max-w-sm mx-auto">
                Initialization creates your isolated tenant partition and wires up the initial executive organization structure.
              </p>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="w-1/3 py-5 rounded-2xl"
                >
                  Modify
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={handleProvision}
                  disabled={loading}
                  className="w-2/3 py-5 rounded-2xl shadow-2xl shadow-primary/20 hover:shadow-primary/30 tracking-[0.15em]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Deploying...</span>
                    </>
                  ) : (
                    <>
                      <span>Provision Cloud</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
        </GlassCard>
      </div>
    </div>
  );
}
