/**
 * workflow-names.ts
 *
 * Canonical list of every audit workflow name.
 * Matches the `workflow` field in `WorkflowStepResult` and is used by the
 * property-based test to assert full workflow coverage.
 */

export const WORKFLOW_NAMES = [
  'retail-pos',
  'inventory',
  'procurement',
  'hr',
  'finance',
  'sales',
  'marketing',
  'it-service',
  'security',
  'audit-trail',
  'compliance',
  'settings',
  'license',
  'core-dashboard',
  'logistics',
  'payment',
  'warehouse',
  'tools',
  'portal',
  'comms',
  'audit',
] as const;

export type WorkflowName = (typeof WORKFLOW_NAMES)[number];
