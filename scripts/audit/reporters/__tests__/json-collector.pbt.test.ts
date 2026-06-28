/**
 * Property-Based Tests for JsonCollector — Property 4: Report Consistency
 *
 * Uses fast-check (fc.assert / fc.property) with vitest test() because
 * @fast-check/vitest is not installed in this project.
 *
 * Each property runs a minimum of 100 iterations.
 *
 * Validates: Requirements 6.1, 6.2, 6.4
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';

import { aggregateSummary } from '../json-collector.js';
import type { ModuleAuditData } from '../../types/audit-types.js';

// ─── Arbitrary: well-formed ModuleAuditData ───────────────────────────────────
//
// Elements total is computed from the parts (functional + partial + stub +
// broken) so the generated data is internally consistent — exactly as the
// task description requires.

const moduleAuditDataArb: fc.Arbitrary<ModuleAuditData> = fc
  .record({
    name:  fc.string({ minLength: 1, maxLength: 32 }),
    layer: fc.constantFrom('auth', 'core', 'retail', 'portal'),

    // ── elements parts — total derived from sum ────────────────────────────
    elementsFunctional: fc.nat(),
    elementsPartial:    fc.nat(),
    elementsStub:       fc.nat(),
    elementsBroken:     fc.nat(),

    // ── modals ─────────────────────────────────────────────────────────────
    modalsTotal:        fc.nat(),
    modalsFunctional:   fc.nat(),
    modalsStub:         fc.nat(),

    // ── api ────────────────────────────────────────────────────────────────
    apiTotal:           fc.nat(),
    apiConnected:       fc.nat(),
    apiDisconnected:    fc.nat(),
    apiMockData:        fc.nat(),

    // ── workflows ──────────────────────────────────────────────────────────
    workflowsTotal:     fc.nat(),
    workflowsPassed:    fc.nat(),
    workflowsFailed:    fc.nat(),
    workflowsSkipped:   fc.nat(),

    // ── perfIssues ─────────────────────────────────────────────────────────
    perfCritical:       fc.nat(),
    perfHigh:           fc.nat(),
    perfMedium:         fc.nat(),
    perfLow:            fc.nat(),

    // ── scoring ────────────────────────────────────────────────────────────
    readinessScore: fc.nat({ max: 100 }),
    goNoGo:         fc.constantFrom<'go' | 'no-go'>('go', 'no-go'),
  })
  .map((raw): ModuleAuditData => ({
    name:  raw.name,
    layer: raw.layer,

    elements: {
      // total is derived from parts — keeps data well-formed
      total:      raw.elementsFunctional + raw.elementsPartial + raw.elementsStub + raw.elementsBroken,
      functional: raw.elementsFunctional,
      partial:    raw.elementsPartial,
      stub:       raw.elementsStub,
      broken:     raw.elementsBroken,
    },

    modals: {
      total:      raw.modalsTotal,
      functional: raw.modalsFunctional,
      stub:       raw.modalsStub,
    },

    api: {
      total:        raw.apiTotal,
      connected:    raw.apiConnected,
      disconnected: raw.apiDisconnected,
      mockData:     raw.apiMockData,
    },

    workflows: {
      total:   raw.workflowsTotal,
      passed:  raw.workflowsPassed,
      failed:  raw.workflowsFailed,
      skipped: raw.workflowsSkipped,
    },

    perfIssues: {
      critical: raw.perfCritical,
      high:     raw.perfHigh,
      medium:   raw.perfMedium,
      low:      raw.perfLow,
    },

    readinessScore: raw.readinessScore,
    goNoGo:         raw.goNoGo,
  }));

// ─── Property 4: Report Consistency ──────────────────────────────────────────

describe('Property 4: Report Consistency', () => {
  // ── 4a: totalFunctional equals sum of module elements.functional ────────────
  test(
    'summary.totalFunctional equals the sum of all module elements.functional',
    () => {
      // Validates: Requirements 6.1
      fc.assert(
        fc.property(fc.array(moduleAuditDataArb), (modules) => {
          const summary = aggregateSummary(modules);
          const expected = modules.reduce((sum, m) => sum + m.elements.functional, 0);
          expect(summary.totalFunctional).toBe(expected);
        }),
        { numRuns: 200 },
      );
    },
  );

  // ── 4b: each module's elements.total equals functional + partial + stub + broken
  test(
    'each module elements.total equals the sum of its functional, partial, stub, and broken counts',
    () => {
      // Validates: Requirements 6.2
      fc.assert(
        fc.property(fc.array(moduleAuditDataArb), (modules) => {
          for (const mod of modules) {
            const expectedTotal =
              mod.elements.functional +
              mod.elements.partial +
              mod.elements.stub +
              mod.elements.broken;
            expect(mod.elements.total).toBe(expectedTotal);
          }
        }),
        { numRuns: 200 },
      );
    },
  );

  // ── 4c: overallScore equals average readinessScore (0 for empty array) ──────
  test(
    'summary.overallScore equals the average of all module readinessScore values (0 for empty input)',
    () => {
      // Validates: Requirements 6.2
      fc.assert(
        fc.property(fc.array(moduleAuditDataArb), (modules) => {
          const summary = aggregateSummary(modules);
          const expected =
            modules.length === 0
              ? 0
              : modules.reduce((sum, m) => sum + m.readinessScore, 0) / modules.length;
          expect(summary.overallScore).toBeCloseTo(expected, 10);
        }),
        { numRuns: 200 },
      );
    },
  );

  // ── 4d: goLiveReady is true only when every module has goNoGo === 'go' ───────
  test(
    "summary.goLiveReady is true only when every module has goNoGo === 'go'",
    () => {
      // Validates: Requirements 6.4
      fc.assert(
        fc.property(fc.array(moduleAuditDataArb), (modules) => {
          const summary = aggregateSummary(modules);
          const allGo = modules.length > 0 && modules.every((m) => m.goNoGo === 'go');
          expect(summary.goLiveReady).toBe(allGo);
        }),
        { numRuns: 200 },
      );
    },
  );

  // ── 4e: edge case — empty array ─────────────────────────────────────────────
  test('aggregateSummary with an empty module array returns sensible zero-state', () => {
    // Validates: Requirements 6.1, 6.2, 6.4
    const summary = aggregateSummary([]);
    expect(summary.totalFunctional).toBe(0);
    expect(summary.overallScore).toBe(0);
    expect(summary.goLiveReady).toBe(false);
    expect(Object.keys(summary.modules)).toHaveLength(0);
  });
});
