/**
 * Playwright `setup` project (Verification_Suite, Phase 16, task 16.2).
 *
 * Replaces the previous hardcoded-demo-credentials login. For the phase under verification this
 * project provisions a FRESH Synthetic_Organization on the Live_Environment by driving the real
 * self-service sign-up + onboarding flow (`provisionSyntheticOrg`, task 16.1), then persists the
 * resulting per-run Playwright storage state so the dependent spec projects authenticate as that
 * synthetic owner.
 *
 * Design references:
 *   .kiro/specs/frontend-stabilization/design.md → "Playwright project setup"
 *   Requirements 11.4 (provision a fresh Synthetic_Organization per phase),
 *                11.8 (data isolated to the synthetic tenant; records identifiable/cleanable).
 *
 * SECRETS HANDLING: no credentials are embedded here. `provisionSyntheticOrg` resolves the live
 * URLs by key name from env / `vps_reference.md` and generates the per-run owner password, so this
 * file never contains secret values. The only thing written to disk is the per-run storage state
 * (gitignored under `tests/playwright/.auth/`).
 *
 * STORAGE-STATE STRATEGY: `provisionSyntheticOrg` writes the per-run state to
 * `tests/playwright/.auth/<runId>.json` (kept for traceability). This setup also copies that state
 * to the canonical `tests/playwright/.auth/user.json` that the `chromium`/per-phase projects load
 * via `storageState` — the lower-risk option that needs no change to each project's `storageState`
 * path. The full `SyntheticOrg` fixture is written to `tests/playwright/.auth/<phase>.org.json` for
 * the phase specs to consume.
 */

import { test as setup } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { provisionSyntheticOrg, type ProvisionOptions } from "./provisionSyntheticOrg";

// ─── Paths ──────────────────────────────────────────────────────────────────

const AUTH_DIR = path.join("tests", "playwright", ".auth");
/** Canonical state path the spec projects load via `storageState` (kept stable on purpose). */
const CANONICAL_STATE = path.join(AUTH_DIR, "user.json");

// ─── Phase → required modules map ─────────────────────────────────────────────
//
// The module ids match the module manifests' MODULE_ID (`src/modules/<id>`). Auth and Core phases
// need no extra activation (Core ships with the base license); the industry/vertical phases
// activate exactly the module their pages are gated behind.

const PHASE_MODULES: Record<string, ProvisionOptions["modules"]> = {
  "phase1-auth": [],
  "phase2-core": [],
  "phase3-retail": ["retail"],
  "phase4-portal": [],
};

const DEFAULT_PHASE = "phase1-auth";

/** Resolve the phase under verification from env (PHASE), defaulting to the auth phase. */
function resolvePhase(): string {
  const raw = (process.env.PHASE || "").trim();
  if (!raw) return DEFAULT_PHASE;
  if (!(raw in PHASE_MODULES)) {
    // Unknown phase: still provision (no modules) so a new phase name isn't a hard failure,
    // but make the situation obvious in the run output.
    console.warn(
      `[auth.setup] PHASE="${raw}" is not in the known phase→modules map; provisioning with no ` +
        `module activation. Known phases: ${Object.keys(PHASE_MODULES).join(", ")}.`,
    );
  }
  return raw;
}

// ─── Setup test ───────────────────────────────────────────────────────────────

setup("provision synthetic organization", async ({ baseURL }) => {
  setup.setTimeout(180_000); // provisioning drives the real remote UI end-to-end

  const phase = resolvePhase();
  const modules = PHASE_MODULES[phase] ?? [];

  console.log(`[auth.setup] Provisioning Synthetic_Organization for phase "${phase}".`);
  console.log(`[auth.setup] Modules to activate: [${modules.join(", ") || "none"}].`);

  // Drive the real self-service flow. URLs/credentials are resolved inside the harness by key name
  // (never embedded). Pass the Playwright baseURL so the harness and config stay consistent.
  const org = await provisionSyntheticOrg(
    { phase, modules },
    { baseURL: baseURL ?? undefined, storageDir: AUTH_DIR },
  );

  // Per-run state already written by the harness at <AUTH_DIR>/<runId>.json.
  const perRunState = path.join(AUTH_DIR, `${org.runId}.json`);
  if (!fs.existsSync(perRunState)) {
    throw new Error(
      `[auth.setup] Expected per-run storage state at ${perRunState} but it was not written.`,
    );
  }

  // Point the canonical storageState path the spec projects consume at this run's state.
  fs.copyFileSync(perRunState, CANONICAL_STATE);
  console.log(`[auth.setup] Copied per-run state → ${CANONICAL_STATE}`);

  // Emit the SyntheticOrg fixture for the phase specs (tenant scope, activated modules, etc.).
  const orgRecordPath = path.join(AUTH_DIR, `${phase}.org.json`);
  fs.writeFileSync(orgRecordPath, JSON.stringify(org, null, 2), "utf8");
  console.log(`[auth.setup] Wrote SyntheticOrg fixture → ${orgRecordPath}`);

  console.log(
    `[auth.setup] Ready: phase=${phase}, label=${org.label}, tenant=${org.tenantId}, ` +
      `modules=[${org.activatedModules.join(", ") || "none"}]. Data is isolated to this synthetic ` +
      `tenant (Requirement 11.8).`,
  );
});
