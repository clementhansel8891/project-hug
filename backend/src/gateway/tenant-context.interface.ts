import { Request } from "express";

/**
 * Tenant Context Interface
 * Represents the multi-tenant context extracted from request headers.
 * Supports the hierarchical structure: Tenant > Company > Branch > Ecommerce.
 */
export interface TenantContext {
  /**
   * SaaS Tenant ID (Root level)
   */
  tenant_id: string;

  /**
   * Company ID (Legal Entity level)
   */
  company_id: string;

  /**
   * Branch ID (Operational level)
   */
  branch_id?: string;

  /**
   * Ecommerce ID (Digital channel level)
   */
  ecommerce_id?: string;

  /**
   * Location ID (Physical location, often maps to Branch)
   */
  location_id?: string;

  /**
   * User ID (from x-actor-id)
   */
  user_id?: string;

  /**
   * User Role (from x-user-role)
   */
  role?: string;
  
  /**
   * JV Mirror Mode flag (legacy — kept for backward compat)
   */
  is_jv_read_only?: boolean;

  /**
   * JV Context flag — true when user is operating under a JV participation
   */
  is_jv_context?: boolean;

  /**
   * JV Participant record ID (from finance_jv_participants)
   */
  jv_participant_id?: string;

  /**
   * JV Participant Role: "OPERATOR" or "NON_OPERATOR"
   */
  jv_role?: string;

  /**
   * JV Profile ID being accessed
   */
  jv_profile_id?: string;

  /**
   * The partner's home tenant ID (their own company)
   */
  jv_home_tenant_id?: string;
}

/**
 * Extended Express Request with Tenant Context
 */
export interface RequestWithTenant extends Request {
  tenantContext: TenantContext;
}
