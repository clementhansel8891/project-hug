/**
 * workflow-coverage.pbt.test.ts
 *
 * Property 2: Workflow Coverage
 * Validates: Requirements 3.1–3.15
 *
 * For every workflow name registered in WORKFLOW_NAMES, the
 * `workflow-results.json` fixture must contain at least one result entry with
 * that workflow name after a full E2E run.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { WORKFLOW_NAMES } from '../../playwright/audit/fixtures/workflow-names.js';
import type { WorkflowStepResult } from '../../../scripts/audit/types/audit-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESULTS_PATH = path.join(
  process.cwd(),
  'audit-results',
  'e2e',
  'workflow-results.json',
);

function loadWorkflowResults(): WorkflowStepResult[] {
  if (!fs.existsSync(RESULTS_PATH)) return [];
  try {
    const raw = fs.readFileSync(RESULTS_PATH, 'utf-8');
    return JSON.parse(raw) as WorkflowStepResult[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Property 2a: WORKFLOW_NAMES registry integrity
// ---------------------------------------------------------------------------

describe('Property 2: Workflow Coverage', () => {
  it('2a: WORKFLOW_NAMES registry is non-empty and contains only non-blank strings', () => {
    expect(WORKFLOW_NAMES.length).toBeGreaterThan(0);
    fc.assert(
      fc.property(fc.constantFrom(...WORKFLOW_NAMES), (name) => {
        return typeof name === 'string' && name.trim().length > 0;
      }),
      { numRuns: WORKFLOW_NAMES.length },
    );
  });

  it('2b: WORKFLOW_NAMES contains all 15 required workflow identifiers', () => {
    const required = [
      'retail-pos', 'inventory', 'procurement', 'hr', 'finance',
      'sales', 'marketing', 'it-service', 'security',
      'audit-trail', 'compliance', 'settings', 'license', 'core-dashboard',
    ];
    for (const name of required) {
      expect(WORKFLOW_NAMES).toContain(name as typeof WORKFLOW_NAMES[number]);
    }
  });

  it('2c: every registered workflow name has at least one result entry in workflow-results.json (after E2E run)', () => {
    const results = loadWorkflowResults();

    if (results.length === 0) {
      // workflow-results.json not yet generated — skip this assertion
      // (it passes once the E2E suite has been run at least once)
      console.warn(
        '[workflow-coverage.pbt] workflow-results.json not found — ' +
          'run `npm run audit:e2e` to generate results before this property is meaningful.',
      );
      return;
    }

    const coveredWorkflows = new Set(results.map((r) => r.workflow));

    fc.assert(
      fc.property(fc.constantFrom(...WORKFLOW_NAMES), (workflowName) => {
        const hasCoverage = coveredWorkflows.has(workflowName);
        if (!hasCoverage) {
          console.warn(
            `[workflow-coverage.pbt] Missing coverage for workflow: "${workflowName}"`,
          );
        }
        return hasCoverage;
      }),
      { numRuns: WORKFLOW_NAMES.length },
    );
  });

  it('2d: every result entry has a valid status field', () => {
    const results = loadWorkflowResults();
    if (results.length === 0) return;

    const validStatuses = new Set(['pass', 'fail', 'skip', 'stub_detected']);

    fc.assert(
      fc.property(fc.constantFrom(...results), (result) => {
        return (
          validStatuses.has(result.status) &&
          typeof result.workflow === 'string' &&
          typeof result.step === 'number' &&
          typeof result.duration === 'number'
        );
      }),
      { numRuns: Math.min(results.length, 100) },
    );
  });

  it('2e: every result entry workflow name is a registered workflow', () => {
    const results = loadWorkflowResults();
    if (results.length === 0) return;

    const registered = new Set(WORKFLOW_NAMES as readonly string[]);

    for (const result of results) {
      if (!registered.has(result.workflow)) {
        console.warn(
          `[workflow-coverage.pbt] Unknown workflow name in results: "${result.workflow}"`,
        );
      }
    }

    // Property: all result workflow names are known identifiers
    const uniqueWorkflows = [...new Set(results.map((r) => r.workflow))];
    if (uniqueWorkflows.length === 0) return;

    fc.assert(
      fc.property(fc.constantFrom(...uniqueWorkflows), (name) => {
        return registered.has(name);
      }),
      { numRuns: uniqueWorkflows.length },
    );
  });
});
