/**
 * Bug Condition Exploration Test — UI Theme Color Consistency
 * Spec: .kiro/specs/ui-theme-color-consistency
 *
 * Property 1: Bug Condition — Colors Specified Outside the Global Theme.
 *
 * METHODOLOGY (bugfix / bug-condition):
 *   This test encodes the EXPECTED (post-fix) behavior described in design.md
 *   "Correctness Properties → Property 1". On the current (failed-attempt) code it
 *   is EXPECTED TO FAIL — every failure is a counterexample that proves the bug
 *   exists and confirms the hypothesized root cause. After the fix is applied
 *   (tasks 4.x) this exact same test should PASS without modification (task 4.5).
 *
 *   DO NOT "fix" this test or the production code to make it pass right now.
 *   A FAILING run here is the SUCCESS condition for task 1.
 *
 * Scoped PBT approach (per tasks.md): because the symptom is static-class + visual
 * correctness, the property is scoped to the concrete affected files enumerated in
 * the design's "Fix Implementation" section, asserting `isBugCondition(file) === false`
 * for every color-bearing source after the fix.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import fc from "fast-check";

import { GlobalKpiRow } from "@/pages/retail/management/command-center/GlobalKpiRow";
import type { GlobalKpis } from "@/core/types/retail/analytics";

const REPO_ROOT = process.cwd();

/**
 * Files changed by the failed mechanical attempt (design.md → Fix Implementation,
 * Step 0). These are the scoped domain for the property.
 */
const AFFECTED_FILES: string[] = [
  "src/pages/core/inventory/InventoryAdjustments.tsx",
  "src/pages/retail/management/DeveloperConsole.tsx",
  "src/pages/retail/management/DeviceControlCenter.tsx",
  "src/pages/retail/management/EcommerceAnalytics.tsx",
  "src/pages/retail/management/command-center/GlobalKpiRow.tsx",
  "src/pages/retail/management/command-center/InfrastructureHealth.tsx",
  "src/pages/retail/operational/OperationalGateway.tsx",
  "src/pages/retail/operational/RefundReturnDesk.tsx",
  "src/pages/retail/operational/SelfServiceKiosk.tsx",
  "src/pages/retail/operational/ShiftCloseTerminal.tsx",
  "src/pages/retail/operational/pos/Cashier.tsx",
];

/** Files that the design specifically calls out for the invalid double-opacity bug. */
const INVALID_CLASS_FILES: string[] = [
  "src/pages/retail/operational/OperationalGateway.tsx",
  "src/pages/retail/operational/SelfServiceKiosk.tsx",
  "src/pages/retail/operational/ShiftCloseTerminal.tsx",
  "src/pages/retail/management/command-center/GlobalKpiRow.tsx",
];

// ── Bug-condition detectors (static, operate on raw source text) ────────────────

/** e.g. `bg-primary/50`, `bg-muted/40`, `bg-secondary/5`, `bg-primary/20` */
const INVALID_DOUBLE_OPACITY = /\b(?:bg|text|border|ring|from|to|via)-[a-z]+(?:-\d+)?\/\d+\/\d+/g;

/** Raw Tailwind palette utilities that bypass the theme tokens. */
const RAW_PALETTE =
  /\b(?:text|bg|border|ring|from|to|via|fill|stroke|shadow)-(?:red|amber|emerald|green|sky|indigo|blue|rose|violet|slate|orange|yellow|lime|teal|cyan|fuchsia|pink|purple)-\d{2,3}/g;

/** Inline hex literals assigned to a color-bearing property (style / data fields). */
const INLINE_HEX =
  /(?:color|backgroundColor|borderColor|stroke|fill|stopColor)\s*:\s*["']#[0-9a-fA-F]{3,8}["']/g;

function readAffected(rel: string): string {
  return fs.readFileSync(path.resolve(REPO_ROOT, rel), "utf8");
}

function findMatches(source: string, re: RegExp): string[] {
  return Array.from(source.matchAll(new RegExp(re.source, re.flags))).map((m) => m[0]);
}

/**
 * isBugCondition for a source file: true when the file contains ANY color specified
 * outside the global theme (invalid class, raw palette class, or inline hex).
 * A correct (post-fix) file has isBugCondition === false.
 */
function fileBugSignals(rel: string): {
  invalidClasses: string[];
  rawPalette: string[];
  inlineHex: string[];
} {
  const src = readAffected(rel);
  return {
    invalidClasses: findMatches(src, INVALID_DOUBLE_OPACITY),
    rawPalette: findMatches(src, RAW_PALETTE),
    inlineHex: findMatches(src, INLINE_HEX),
  };
}

function isBugCondition(rel: string): boolean {
  const s = fileBugSignals(rel);
  return s.invalidClasses.length > 0 || s.rawPalette.length > 0 || s.inlineHex.length > 0;
}

// ── Render fixture for GlobalKpiRow ─────────────────────────────────────────────

const kpisFixture: GlobalKpis = {
  totalRevenueToday: 125_000_000,
  revenueVsTarget: 92,
  orderCount: 1432,
  avgTicketSize: 87_300,
  grossMarginPercentage: 34,
  activeDevices: 18,
  openShifts: 6,
  criticalAlertsCount: 3,
  // sparklineData intentionally omitted so the recharts sparkline branch is skipped
  // in jsdom; the cards (accents + icons) still render fully.
};

/** Read each card's accent `bg-*` utility (applied to the icon container). */
function readCardAccents(container: HTMLElement): string[] {
  const grid = container.querySelector("div.grid");
  const cards = Array.from(grid?.children ?? []);
  return cards.map((card) => {
    const iconBox = card.querySelector('[class*="w-9"]');
    const cls = iconBox?.getAttribute("class") ?? "";
    const bg = cls.split(/\s+/).find((c) => c.startsWith("bg-"));
    return bg ?? "<none>";
  });
}

describe("Property 1: Bug Condition — colors specified outside the global theme", () => {
  // ── Scoped property-based test ────────────────────────────────────────────────
  // Validates: Requirements 1.1, 1.2, 1.4
  it("PBT: every affected file resolves all colors to the global theme (no bug condition)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...AFFECTED_FILES), (rel) => {
        // Expected (post-fix) behavior: the file carries NO color specified outside
        // the theme. On the failed-attempt code this is violated -> counterexample.
        expect(isBugCondition(rel), `bug condition present in ${rel}: ${JSON.stringify(fileBugSignals(rel))}`).toBe(false);
      }),
      { numRuns: AFFECTED_FILES.length * 4, verbose: true },
    );
  });

  // ── Static scan 1: invalid / malformed double-opacity classes ────────────────
  // Validates: Requirements 1.4, 1.8
  it("Invalid-class scan: no malformed double-opacity Tailwind classes remain", () => {
    const offenders: Record<string, string[]> = {};
    for (const rel of INVALID_CLASS_FILES) {
      const matches = findMatches(readAffected(rel), INVALID_DOUBLE_OPACITY);
      if (matches.length) offenders[rel] = matches;
    }
    expect(offenders, `malformed double-opacity classes found: ${JSON.stringify(offenders, null, 2)}`).toEqual({});
  });

  // ── Static scan 2: raw Tailwind palette classes ──────────────────────────────
  // Validates: Requirements 1.1, 1.3
  it("Raw-palette scan: no raw Tailwind palette classes remain in affected files", () => {
    const offenders: Record<string, string[]> = {};
    for (const rel of AFFECTED_FILES) {
      const matches = findMatches(readAffected(rel), RAW_PALETTE);
      if (matches.length) offenders[rel] = Array.from(new Set(matches));
    }
    expect(offenders, `raw palette classes found: ${JSON.stringify(offenders, null, 2)}`).toEqual({});
  });

  // ── Static scan 3: inline hex colors ─────────────────────────────────────────
  // Validates: Requirements 1.2, 1.6
  it("Inline-hex scan: no inline hex color literals remain in affected files", () => {
    const offenders: Record<string, string[]> = {};
    for (const rel of AFFECTED_FILES) {
      const matches = findMatches(readAffected(rel), INLINE_HEX);
      if (matches.length) offenders[rel] = matches;
    }
    expect(offenders, `inline hex colors found: ${JSON.stringify(offenders, null, 2)}`).toEqual({});
  });

  // ── Render check 4: lost distinguishability ──────────────────────────────────
  // Validates: Requirement 1.5
  it("Distinguishability: adjacent KPI cards must not share the same accent token", () => {
    const { container } = render(<GlobalKpiRow kpis={kpisFixture} />);
    const accents = readCardAccents(container);

    // Document the distribution for the failure report.
    const distinct = new Set(accents);
    const duplicates = accents.filter((a, i) => accents.indexOf(a) !== i);

    // Expected (post-fix) behavior: a multi-item decorative group stays
    // distinguishable, so no two adjacent cards collapse onto the same accent.
    for (let i = 1; i < accents.length; i++) {
      expect(
        accents[i],
        `adjacent KPI cards ${i - 1} & ${i} share accent "${accents[i]}". ` +
          `accents=${JSON.stringify(accents)} distinct=${distinct.size}/${accents.length} duplicates=${JSON.stringify(duplicates)}`,
      ).not.toBe(accents[i - 1]);
    }
  });

  // ── Render check 5 (edge case): token / hex mismatch ─────────────────────────
  // Validates: Requirements 1.2, 1.6
  it("Token/hex pairing: KPI icon colors must derive from a token, not an inline hex/rgb", () => {
    const { container } = render(<GlobalKpiRow kpis={kpisFixture} />);
    const iconBoxes = Array.from(container.querySelectorAll('[class*="w-9"]'));
    const mismatches: string[] = [];

    iconBoxes.forEach((box, idx) => {
      const accentClass = (box.getAttribute("class") ?? "")
        .split(/\s+/)
        .find((c) => c.startsWith("bg-"));
      const svg = box.querySelector("svg");
      const style = svg?.getAttribute("style") ?? "";
      // A token-sourced icon color either references a CSS variable or is set via a
      // class; a raw inline hex/rgb is a token/hex mismatch (design example:
      // accent "bg-success/20" paired with inline hex "#10b981").
      if (/color:\s*(?:#|rgb)/i.test(style)) {
        mismatches.push(`card ${idx} accent="${accentClass}" icon style="${style}"`);
      }
    });

    expect(mismatches, `token/hex mismatches found: ${JSON.stringify(mismatches, null, 2)}`).toEqual([]);
  });
});
