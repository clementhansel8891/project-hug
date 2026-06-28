/**
 * Property-Based Tests for StubDetector — Classification Completeness
 *
 * **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
 *
 * Property 1: Classification Completeness
 *   For any array of InteractiveElement objects passed to classify(),
 *   the output array:
 *     (a) has the same length as the input array, and
 *     (b) every element carries exactly one of the five valid classifications.
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { expect } from 'vitest';

import { classify, VALID_CLASSIFICATIONS } from '../stub-detector.js';
import type { InteractiveElement } from '../../types/audit-types.js';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a single arbitrary InteractiveElement.
 * Covers a range of handler body patterns to exercise all classification
 * branches in the implementation.
 */
const arbitraryInteractiveElement: fc.Arbitrary<InteractiveElement> = fc.record({
  id: fc.string({ minLength: 16, maxLength: 16 }),
  filePath: fc.stringMatching(/^src\/(pages|components)\/[a-zA-Z0-9/_-]+\.tsx$/),
  lineNumber: fc.integer({ min: 1, max: 10_000 }),
  elementType: fc.constantFrom(
    'button' as const,
    'link' as const,
    'form-submit' as const,
    'clickable' as const,
  ),
  /**
   * Handler name — either a realistic identifier or a short inline expression.
   * Keep it short so collisions are rare and tests stay legible.
   */
  handlerName: fc.oneof(
    fc.stringMatching(/^handle[A-Z][a-zA-Z]{0,15}$/),
    fc.constantFrom('() => {}', '() => toast("test")', 'handleSubmit'),
  ),
  /**
   * Handler body — mix of stub patterns, api patterns, and arbitrary strings
   * so that all classification branches can be exercised.
   */
  handlerBody: fc.oneof(
    // Empty / stub patterns
    fc.constant('() => {}'),
    fc.constant('function() {}'),
    fc.constant('() => { toast("Coming soon") }'),
    fc.constant('() => { console.log("clicked") }'),
    fc.constant('() => { alert("Not implemented") }'),
    fc.constant('() => { // TODO: implement\n}'),
    fc.constant('() => { // FIXME: connect API\n}'),
    // Partially working patterns
    fc.constant('() => { fetch("/api/data") }'),
    fc.constant('() => { axios.get("/api/items") }'),
    // Fully functional patterns
    fc.constant("() => { await fetch('/api/users').then(r => r.json()).then(setData) }"),
    fc.constant('() => { mutate(payload); onSuccess(() => refetch()) }'),
    // Arbitrary strings representing unknown handler bodies
    fc.string({ minLength: 0, maxLength: 200 }),
  ),
  parentComponent: fc.stringMatching(/^[A-Z][a-zA-Z]{0,29}$/),
  layer: fc.constantFrom('auth', 'core', 'retail', 'portal', 'unknown'),
  pagePath: fc.stringMatching(/^\/[a-z0-9/_-]{0,40}$/),
});

// ---------------------------------------------------------------------------
// Property 1: Classification Completeness
// ---------------------------------------------------------------------------

describe('StubDetector — Classification Completeness (Property 1)', () => {
  it(
    'every element receives exactly one valid classification and output length equals input length',
    () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryInteractiveElement, { minLength: 0, maxLength: 50 }),
          (elements) => {
            const result = classify(elements, []); // pass empty routes per task spec

            // (a) Length invariant
            expect(result.length).toBe(elements.length);

            // (b) Every classification is one of the five valid values
            for (const el of result) {
              expect(VALID_CLASSIFICATIONS).toContain(el.classification);
            }

            return true;
          },
        ),
        {
          numRuns: 200,
          seed: 42,
        },
      );
    },
  );

  it('returns an empty array when given an empty array', () => {
    const result = classify([], []);
    expect(result).toEqual([]);
  });

  it('output preserves all original element fields', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryInteractiveElement, { minLength: 1, maxLength: 20 }),
        (elements) => {
          const result = classify(elements, []);

          for (let i = 0; i < elements.length; i++) {
            const orig = elements[i];
            const classified = result[i];

            // All original fields must be preserved
            expect(classified.id).toBe(orig.id);
            expect(classified.filePath).toBe(orig.filePath);
            expect(classified.lineNumber).toBe(orig.lineNumber);
            expect(classified.elementType).toBe(orig.elementType);
            expect(classified.handlerName).toBe(orig.handlerName);
            expect(classified.handlerBody).toBe(orig.handlerBody);
            expect(classified.parentComponent).toBe(orig.parentComponent);
            expect(classified.layer).toBe(orig.layer);
            expect(classified.pagePath).toBe(orig.pagePath);
          }

          return true;
        },
      ),
      { numRuns: 100, seed: 42 },
    );
  });
});
