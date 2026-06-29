import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSession } from "@/core/security/session";

interface DeviceAwareGuardProps {
  children: React.ReactNode;
  supportedDevices?: string[];
  moduleName?: string;
}

/**
 * DeviceAwareGuard [HARD LOCK]
 * 
 * Enforces that the current hardware/device_mode is authorized 
 * to view the requested route.
 */
export const DeviceAwareGuard: React.FC<DeviceAwareGuardProps> = ({ 
  children, 
  supportedDevices,
  moduleName 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();

  // In DEV_MOCK_MODE, we detect device_mode from localStorage or session
  // Default to 'desktop' which aligns with ModulePageDefinition.supportedDeviceTypes
  const deviceMode = (localStorage.getItem("estelagea.device_mode") as any) || "desktop";

  useEffect(() => {
    // If no specific restrictions, allow
    if (!supportedDevices || supportedDevices.length === 0) return;

    // Check if current device is in the supported list
    const isSupported = supportedDevices.includes(deviceMode);

    if (!isSupported) {
      console.warn(`[DeviceGuard] Access Denied: Device ${deviceMode} not authorized for ${location.pathname}. Supported: ${supportedDevices.join(', ')}`);
      
      // Determine safe redirect
      // If we are already at a management page, don't redirect to management dashboard to avoid loops
      if (location.pathname.includes('/management/')) return;

      if (deviceMode === "kiosk") {
        navigate("/m/retail/operational/kiosk");
      } else if (location.pathname.includes('/operational/')) {
        navigate("/m/retail/operational/gateway");
      } else {
        navigate("/m/retail/management/dashboard");
      }
    }
  }, [deviceMode, supportedDevices, navigate, location.pathname]);

  return <>{children}</>;
};
