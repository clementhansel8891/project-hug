/**
 * Shared TypeScript interfaces and constants for the production-readiness audit system.
 * @module audit-types
 */

// ---------------------------------------------------------------------------
// Classification union type
// ---------------------------------------------------------------------------

export type Classification =
  | 'fully_functional'
  | 'partially_working'
  | 'stub'
  | 'broken'
  | 'needs_dynamic_verification';

// ---------------------------------------------------------------------------
// Static Analysis interfaces
// ---------------------------------------------------------------------------

/** An interactive element found by the element scanner. */
export interface InteractiveElement {
  /** Unique hash of file:line:handler */
  id: string;
  /** Relative path from project root */
  filePath: string;
  lineNumber: number;
  elementType: 'button' | 'link' | 'form-submit' | 'clickable';
  /** e.g. "handleDelete", "() => toast(...)" */
  handlerName: string;
  /** Full handler source text */
  handlerBody: string;
  /** Enclosing component name */
  parentComponent: string;
  layer: string;
  /** Page route if determinable */
  pagePath: string;
}

/** An interactive element with a stub-detector classification applied. */
export interface ClassifiedElement extends InteractiveElement {
  classification: Classification;
}

/** A modal / dialog instance found by the modal scanner. */
export interface ModalInstance {
  id: string;
  filePath: string;
  lineNumber: number;
  modalType: 'Dialog' | 'AlertDialog' | 'Sheet' | 'Drawer' | 'Popover';
  /** The element that opens this modal */
  triggerElement: string;
  /** Contains form fields */
  hasForm: boolean;
  /** Submit button has a handler */
  hasSubmitHandler: boolean;
  submitClassification: Classification;
  /** Uses zod / react-hook-form validation */
  hasValidation: boolean;
  /** Close / cancel properly handled */
  hasCancelHandler: boolean;
  parentPage: string;
  layer: string;
}

/** A frontend → backend API call mapping entry. */
export interface ApiMapping {
  frontendFile: string;
  frontendLine: number;
  httpMethod: string;
  endpoint: string;
  /** Matched controller file, or null if unmatched */
  backendMatch: string | null;
  classification: 'connected' | 'disconnected' | 'mock_data';
  /** Nearby TODO / FIXME comments */
  todoComments: string[];
  businessCriticality: 'critical' | 'high' | 'medium' | 'low';
}

/** A performance concern identified by the perf analyzer. */
export interface PerfIssue {
  type: 'n_plus_1' | 'missing_pagination' | 'no_error_boundary' | 'no_cache' | 'socket_config';
  filePath: string;
  lineNumber: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

// ---------------------------------------------------------------------------
// E2E Workflow interfaces
// ---------------------------------------------------------------------------

/** Pass / fail result for a single workflow step. */
export interface WorkflowStepResult {
  /** e.g. 'retail-pos' */
  workflow: string;
  step: number;
  /** Human-readable step name */
  description: string;
  status: 'pass' | 'fail' | 'skip' | 'stub_detected';
  /** Populated when status is 'fail' */
  errorMessage?: string;
  /** Exact UI element or API that failed */
  failurePoint?: string;
  /** What needs fixing */
  remediationNote?: string;
  /** Duration in milliseconds */
  duration: number;
}

// ---------------------------------------------------------------------------
// Report / scoring interfaces
// ---------------------------------------------------------------------------

/** Top-level audit summary stored in audit-results/final/summary.json. */
export interface AuditSummary {
  timestamp: string;
  version: string;
  modules: Record<string, ModuleAuditData>;
  /** Sum of `elements.functional` across all modules. */
  totalFunctional: number;
  overallScore: number;
  goLiveReady: boolean;
  blockers: Blocker[];
}

/** Per-module rolled-up audit data. */
export interface ModuleAuditData {
  name: string;
  layer: string;
  elements: {
    total: number;
    functional: number;
    partial: number;
    stub: number;
    broken: number;
  };
  modals: {
    total: number;
    functional: number;
    stub: number;
  };
  api: {
    total: number;
    connected: number;
    disconnected: number;
    mockData: number;
  };
  workflows: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  perfIssues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  readinessScore: number;
  goNoGo: 'go' | 'no-go';
}

/** A single actionable blocker produced by the scoring engine. */
export interface Blocker {
  id: string;
  priority: 'P0' | 'P1' | 'P2';
  module: string;
  description: string;
  type: 'stub' | 'broken' | 'disconnected_api' | 'perf' | 'workflow_fail';
  filePath: string;
  estimatedEffort: 'hours' | 'days' | 'weeks';
  remediation: string;
}

// ---------------------------------------------------------------------------
// Route registry interfaces
// ---------------------------------------------------------------------------

/** A single NestJS backend route parsed from controller decorators. */
export interface BackendRoute {
  method: string;
  path: string;
  controllerFile: string;
}

/** Configuration entry for a single application module. */
export interface ModuleConfig {
  layer: string;
  pagePaths: string[];
}

// ---------------------------------------------------------------------------
// Module Registry — maps all 24 application modules to their source paths
// Paths are prefix-matched against actual file paths found in the codebase.
// ---------------------------------------------------------------------------

export const MODULE_REGISTRY: Record<string, ModuleConfig> = {
  auth:        { layer: 'auth',     pagePaths: ['src/pages/auth/'] },
  dashboard:   { layer: 'core',     pagePaths: ['src/pages/core/Dashboard.tsx', 'src/components/dashboard/'] },
  finance:     { layer: 'core',     pagePaths: ['src/pages/core/finance/', 'src/pages/core/Finance.tsx'] },
  hr:          { layer: 'core',     pagePaths: ['src/pages/core/HR/', 'src/pages/core/hr/'] },
  inventory:   { layer: 'core',     pagePaths: ['src/pages/core/inventory/', 'src/pages/core/InventoryModule.tsx'] },
  it:          { layer: 'core',     pagePaths: ['src/pages/core/it/'] },
  license:     { layer: 'core',     pagePaths: ['src/pages/core/license/'] },
  logistics:   { layer: 'core',     pagePaths: ['src/pages/core/logistics/'] },
  logs:        { layer: 'core',     pagePaths: ['src/pages/core/logs/'] },
  marketing:   { layer: 'core',     pagePaths: ['src/pages/core/marketing/'] },
  payment:     { layer: 'core',     pagePaths: ['src/pages/core/payment/'] },
  procurement: { layer: 'core',     pagePaths: ['src/pages/core/procurement/', 'src/pages/core/ProcurementEntry.tsx'] },
  retail:      { layer: 'retail',   pagePaths: ['src/pages/core/retail/', 'src/pages/retail/', 'src/modules/retail/', 'src/components/pos-cafe/'] },
  sales:       { layer: 'core',     pagePaths: ['src/pages/core/sales/'] },
  security:    { layer: 'core',     pagePaths: ['src/pages/core/Security.tsx', 'src/pages/core/security/'] },
  settings:    { layer: 'core',     pagePaths: ['src/pages/core/settings/', 'src/pages/core/Settings.tsx'] },
  warehouse:   { layer: 'core',     pagePaths: ['src/pages/core/warehouse/'] },
  compliance:  { layer: 'core',     pagePaths: ['src/pages/core/compliance/'] },
  audit:       { layer: 'core',     pagePaths: ['src/pages/core/audit/'] },
  comms:       { layer: 'core',     pagePaths: ['src/pages/core/comms/'] },
  tools:       { layer: 'core',     pagePaths: ['src/pages/core/tools/'] },
  portal:      { layer: 'portal',   pagePaths: ['src/pages/portal/'] },
};
