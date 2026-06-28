// ============================================================================
// MODULE CONTRACT (LOCKED)
// ============================================================================
//
// SYSTEM-LEVEL API — DO NOT MODIFY CASUALLY
//
// This file defines the ONLY allowed contract between:
// - Core
// - Platform
// - Industry Modules
//
// Violations here WILL cause systemic breakage.
//
// ============================================================================

import type { DeviceType, LayoutProfile } from "@/core/types";
import type { ContributionType } from "@/core/contributions/types";

import type React from "react";

/* ============================================================================ */
/* CORE IDENTIFIERS                                                             */
/* ============================================================================ */

/**
 * Every module MUST belong to exactly one category.
 */
export type ModuleCategory = "core" | "industry";

/**
 * Canonical module identifier.
 * Must be globally unique.
 */
export type ModuleId = string;

/**
 * Tenant identifier (organization-level).
 */
export type TenantId = string;

/* ============================================================================ */
/* PERMISSIONS (CANONICAL)                                                      */
/* ============================================================================ */

/**
 * Canonical permission action set.
 */
export type PermissionAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "manage";

/**
 * Canonical permission model.
 *
 * IMPORTANT:
 * - This is the ONLY permission shape allowed system-wide
 * - Enforcement is owned by Core
 */
export interface Permission {
  resource: string;
  actions: PermissionAction[];
}

/* ============================================================================ */
/* PAGE DEFINITION (CANONICAL)                                                  */
/* ============================================================================ */

/**
 * Canonical page declaration shared across the platform.
 *
 * RULES:
 * - Declarative only
 * - No data access
 * - No authorization enforcement
 */
export interface PageDefinition {
  id: string;
  moduleId: ModuleId;
  title: string;

  /**
   * Canonical absolute route.
   *
   * IMPORTANT:
   * Routes MUST live under:
   *   /m/<moduleId>/...
   *
   * Example:
   *   /m/retail/workspace
   *   /m/retail/sales
   */
  route: string;

  /**
   * Icon identifier for navigation UI.
   * Interpretation is owned by the UI layer.
   */
  icon?: string;

  /**
   * Permissions required to access this page.
   */
  requiredPermissions?: Permission[];

  /**
   * Navigation grouping (cashier, ops, admin, etc).
   */
  menuGroup?: string;
}

/* ============================================================================ */
/* MODULE CONFIGURATION                                                         */
/* ============================================================================ */

export type ModuleConfig = Record<string, unknown>;

export interface ModuleConfigValidationResult {
  valid: boolean;
  errors: string[];
}

export type ReadonlyModuleConfig = Readonly<ModuleConfig>;

/* ============================================================================ */
/* PAGE CONTEXT                                                                 */
/* ============================================================================ */

export interface ModulePageContext {
  moduleConfig: ReadonlyModuleConfig;
  deviceType: DeviceType;
  layoutProfile: LayoutProfile;
}

/* ============================================================================ */
/* MODULE PAGE DECLARATION (CANONICAL)                                          */
/* ============================================================================ */

/**
 * Module-owned page declaration.
 *
 * This is the ONLY allowed page contract.
 *
 * Core will use this for:
 * - Navigation generation
 * - Routing enforcement
 * - Device compatibility filtering
 */
export interface ModulePageDefinition extends PageDefinition {
  /**
   * React component bound to this page.
   *
   * Enables Phase 3:
   * - No hardcoded routes in App.tsx
   * - Modules fully own their page mapping
   */
  component: React.ComponentType;

  /**
   * Optional device restriction.
   * Example: kiosk-only screens.
   */
  supportedDeviceTypes?: DeviceType[];

  /**
   * Optional runtime visibility.
   *
   * Static:
   *   hidden: true
   *
   * Dynamic:
   *   hidden: (ctx) => ctx.moduleConfig.featureX === false
   */
  hidden?: boolean | ((ctx: ModulePageContext) => boolean);
}

/* ============================================================================ */
/* MODULE OUTPUT EVENTS                                                         */
/* ============================================================================ */

export interface ModuleOutputEvent<TPayload = unknown> {
  tenantId: TenantId;
  moduleId: ModuleId;
  type: string;
  payload: TPayload;
  occurredAt: string;
}

/* ============================================================================ */
/* MODULE CONTRACT (PRIMARY INTERFACE — SINGLE SOURCE OF TRUTH)                 */
/* ============================================================================ */

export interface ModuleContract {
  // --------------------------------------------------------------------------
  // Identity
  // --------------------------------------------------------------------------

  id: ModuleId;
  name: string;
  description: string;
  version: string;
  category: ModuleCategory;

  // --------------------------------------------------------------------------
  // Runtime Requirements
  // --------------------------------------------------------------------------

  requiredCoreServices: string[];
  requiredPermissions: Permission[];

  /**
   * Device support declared at module-level.
   */
  supportedDeviceTypes: DeviceType[];

  /**
   * Optional preferred layout profile.
   */
  preferredLayoutProfile?: LayoutProfile;

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  getDefaultConfig(): ModuleConfig;

  validateConfig(config: ModuleConfig): ModuleConfigValidationResult;

  // --------------------------------------------------------------------------
  // Pages (MANDATORY — SINGLE SOURCE OF TRUTH)
  // --------------------------------------------------------------------------

  /**
   * Canonical page resolver.
   *
   * RULES:
   * - ALWAYS required
   * - Static modules return constant arrays
   * - Dynamic modules may filter pages based on config
   *
   * Core derives:
   * - Navigation
   * - Routes
   * - Enforcement
   */
  getPages(config: ReadonlyModuleConfig): ReadonlyArray<ModulePageDefinition>;

  // --------------------------------------------------------------------------
  // Contributions (OPTIONAL)
  // --------------------------------------------------------------------------

  /**
   * Contribution types this module may emit.
   * Declarative only.
   */
  contributions?: ContributionType[];

  // --------------------------------------------------------------------------
  // Lifecycle Hooks (OPTIONAL)
  // --------------------------------------------------------------------------

  onActivate?(tenantId: TenantId, config: ModuleConfig): Promise<void>;

  onDeactivate?(tenantId: TenantId): Promise<void>;

  onConfigChange?(
    tenantId: TenantId,
    oldConfig: ModuleConfig,
    newConfig: ModuleConfig,
  ): Promise<void>;
}

/* ============================================================================ */
/* DATA SCOPING & ISOLATION                                                     */
/* ============================================================================ */

export interface ScopedData<T> {
  tenantId: TenantId;
  moduleId: ModuleId;
  siteId?: string;
  data: T;
}

export function scopeData<T>(
  tenantId: TenantId,
  moduleId: ModuleId,
  data: T,
  siteId?: string,
): ScopedData<T> {
  return { tenantId, moduleId, siteId, data };
}

export function filterByScope<
  T extends {
    tenantId: TenantId;
    moduleId?: ModuleId;
    siteId?: string;
  },
>(
  items: readonly T[],
  tenantId: TenantId,
  moduleId?: ModuleId,
  siteId?: string,
): T[] {
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (item.tenantId !== tenantId) return false;
    if (moduleId && item.moduleId !== moduleId) return false;
    if (siteId && item.siteId !== siteId) return false;
    return true;
  });
}
