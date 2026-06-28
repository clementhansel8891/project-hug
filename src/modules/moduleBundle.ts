import { retailModule } from "./retail";
import { registerModule } from "@/core/runtime/moduleRegistry";

/**
 * Module Bundle
 * 
 * Registers the Retail module into the core runtime.
 * Retail uses its own dual-shell layout (Management + Operational)
 * and is always active for all tenants.
 */
export function registerIndustryModules(): void {
  registerModule(retailModule);
}
