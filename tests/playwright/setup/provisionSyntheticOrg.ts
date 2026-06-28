/**
 * Synthetic_Organization provisioning harness (Verification_Suite, Phase 16).
 *
 * Creates a FRESH organization on the Live_Environment for each verification run by driving the
 * REAL self-service sign-up + onboarding flow, exactly as a brand-new customer would:
 *
 *   Register  →  (auto-login)  →  Onboarding wizard (provisionCompany)  →  module activation
 *
 * Design references:
 *   .kiro/specs/frontend-stabilization/design.md  →  "Synthetic_Organization provisioning harness"
 *   Requirements 11.4, 11.5, 11.6, 11.8, 12.5, 12.6
 *
 * SECRETS HANDLING (Requirement: never embed secret values):
 *   - The live web URL and Backend_API URL are read at RUN TIME, BY KEY NAME, from environment
 *     variables first and, as a documented fallback, from the repo reference file
 *     `vps_reference.md` (parsed for the `FRONTEND_URL` / `VITE_API_URL` keys).
 *   - The synthetic owner password is generated per-run (namespaced) so no real credential is ever
 *     needed; it can be overridden by the `SYNTH_OWNER_PASSWORD` env var (read by key name).
 *   - Credential VALUES are never written into this file and never logged. Only key names and the
 *     (non-secret, public) URLs are logged.
 *
 * Each created record/email is namespaced with a unique `runId` so synthetic data is identifiable
 * and cleanable, and every run uses its own tenant so data is isolated by construction
 * (Requirement 11.8).
 */

import { chromium, request, type Browser, type Page, type APIRequestContext } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { type Role } from "../../../src/core/security/roles";

// ─── Public types ───────────────────────────────────────────────────────────

/**
 * Verification-only fixture describing a freshly provisioned Synthetic_Organization.
 * Shape mirrors `design.md` → "Synthetic_Organization model".
 */
export interface SyntheticOrg {
  runId: string; // unique per verification run, used for namespacing
  label: string; // e.g. "synthtest-<phase>-<runId>" — identifiable / cleanable
  tenantId: string;
  companyId: string;
  branchId: string;
  locationId: string;
  owner: { email: string; password: string; userId: string; token: string };
  extraUsers?: Array<{ role: Role; email: string; password: string; token: string }>;
  activatedModules: string[]; // module ids needed by the phase under test
  createdAt: string;
}

export interface ProvisionOptions {
  phase: string; // phase under verification (e.g. "phase1-auth")
  modules: string[]; // module ids/codes to activate for the phase
  extraRoles?: Role[]; // additional role users to create under the same tenant
}

/**
 * Optional runtime injected by the Playwright setup project (task 16.2). When omitted the harness
 * launches its own headless browser and resolves config from env / the reference file, so it can
 * also be run standalone.
 */
export interface ProvisionRuntime {
  browser?: Browser; // reuse an existing browser instead of launching one
  baseURL?: string; // Web_App base URL (Live_Environment)
  apiBaseURL?: string; // Backend_API base URL (Live_Environment)
  storageDir?: string; // directory for per-run storage state (default tests/playwright/.auth)
}

// ─── Config resolution (by key name, never embedding values) ─────────────────

const REPO_ROOT = path.resolve(__dirname, "../../..");
const DEFAULT_STORAGE_DIR = path.join(REPO_ROOT, "tests", "playwright", ".auth");

/** Deterministic onboarding location — avoids Nominatim/geocoder flakiness (design step 2). */
const FIXED_LOCATION = {
  latitude: -6.200000,
  longitude: 106.816666,
  address: "Jl. Sudirman Kav. 1, Jakarta Pusat, DKI Jakarta, Indonesia",
  industry: "retail",
  country: "ID",
} as const;

/**
 * Read a single `KEY=value` from `vps_reference.md` without echoing the value. Returns undefined
 * if the file or key is absent. Used only as a documented fallback for the non-secret URLs.
 */
function readKeyFromReferenceFile(key: string): string | undefined {
  try {
    const refPath = path.join(REPO_ROOT, "vps_reference.md");
    if (!fs.existsSync(refPath)) return undefined;
    const content = fs.readFileSync(refPath, "utf8");
    // Match lines like `KEY=value` (optionally inside a fenced ```env block).
    const re = new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\n\\r]+)"?\\s*$`, "m");
    const m = content.match(re);
    return m ? m[1].trim() : undefined;
  } catch {
    return undefined;
  }
}

function resolveConfig(runtime: ProvisionRuntime) {
  // Web_App base URL — env keys first, then the reference file's FRONTEND_URL.
  const baseURL =
    runtime.baseURL ||
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.FRONTEND_URL ||
    readKeyFromReferenceFile("FRONTEND_URL");

  // Backend_API base URL — env key first, then the reference file's VITE_API_URL.
  const apiBaseURL =
    runtime.apiBaseURL ||
    process.env.VITE_API_URL ||
    process.env.VITE_API_BASE_URL ||
    readKeyFromReferenceFile("VITE_API_URL");

  if (!baseURL) {
    throw new Error(
      "[provisionSyntheticOrg] Web_App base URL not found. Set PLAYWRIGHT_BASE_URL or FRONTEND_URL, " +
        "or ensure vps_reference.md defines FRONTEND_URL.",
    );
  }
  if (!apiBaseURL) {
    throw new Error(
      "[provisionSyntheticOrg] Backend_API base URL not found. Set VITE_API_URL, " +
        "or ensure vps_reference.md defines VITE_API_URL.",
    );
  }

  return {
    baseURL: baseURL.replace(/\/$/, ""),
    apiBaseURL: apiBaseURL.replace(/\/$/, ""),
    storageDir: runtime.storageDir || DEFAULT_STORAGE_DIR,
  };
}

// ─── Small utilities ─────────────────────────────────────────────────────────

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`[provisionSyntheticOrg] ${msg}`);
}

function makeRunId(phase: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  // sanitize phase for use in identifiers / emails
  const safePhase = phase.replace(/[^a-z0-9]/gi, "").toLowerCase() || "phase";
  return `synthtest-${safePhase}-${ts}-${rand}`;
}

/** Generate a strong per-run password. Overridable by SYNTH_OWNER_PASSWORD (read by key name). */
function makePassword(runId: string): string {
  const fromEnv = process.env.SYNTH_OWNER_PASSWORD;
  if (fromEnv && fromEnv.length >= 8) return fromEnv;
  // Deterministic-ish, satisfies the Register minLength={8} rule, includes mixed classes.
  return `Synth!${runId.slice(-6)}aA9`;
}

interface LiveSession {
  token: string;
  tenant_id: string;
  company_id: string;
  location_id: string;
  branch_id?: string;
  user_id: string;
  role: string;
}

/** Read the live session the app persisted into localStorage after onboarding. */
async function readLiveSession(page: Page): Promise<LiveSession> {
  const raw = await page.evaluate(() => {
    const session = window.localStorage.getItem("ZENVIX_SESSION");
    const token = window.localStorage.getItem("ZENVIX_TOKEN");
    return { session, token };
  });

  let parsed: any = {};
  if (raw.session) {
    try {
      parsed = JSON.parse(raw.session);
    } catch {
      /* ignore malformed session */
    }
  }

  return {
    token: parsed.token || raw.token || "",
    tenant_id: parsed.tenant_id || "",
    company_id: parsed.company_id || "",
    location_id: parsed.location_id || "",
    branch_id: parsed.branch_id || undefined,
    user_id: parsed.user_id || "",
    role: parsed.role || "",
  };
}

/** Build Backend_API headers from a live session (mirrors apiClient header attachment). */
function apiHeaders(session: LiveSession): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (session.token) h["Authorization"] = `Bearer ${session.token}`;
  if (session.tenant_id) h["x-tenant-id"] = session.tenant_id;
  if (session.location_id) h["x-location-id"] = session.location_id;
  if (session.branch_id) h["x-branch-id"] = session.branch_id;
  if (session.company_id) h["x-company-id"] = session.company_id;
  if (session.user_id) h["x-actor-id"] = session.user_id;
  if (session.role) h["x-user-role"] = session.role;
  return h;
}

// ─── Flow steps (drive the REAL UI) ──────────────────────────────────────────

/** Step: self-service registration via the real /auth/register Form. */
async function driveRegister(
  page: Page,
  baseURL: string,
  owner: { email: string; password: string; firstName: string; lastName: string },
) {
  log(`Driving self-service Register for owner ${owner.email} ...`);
  await page.goto(`${baseURL}/auth/register`, { waitUntil: "domcontentloaded" });

  await page.fill('input[name="first_name"]', owner.firstName);
  await page.fill('input[name="last_name"]', owner.lastName);
  await page.fill('input[name="email"]', owner.email);
  await page.fill('input[name="password"]', owner.password);

  await page.click('button[type="submit"]');

  // Register.tsx auto-logs in then navigates to /core/dashboard; a brand-new user with no company
  // is redirected by the App guard to /auth/onboarding. Accept either as a successful landing.
  await page.waitForURL(
    (url) =>
      url.pathname.includes("/auth/onboarding") ||
      url.pathname.includes("/core") ||
      !url.pathname.includes("/auth/register"),
    { timeout: 60000 },
  );
  log(`Register complete; landed on ${page.url()}`);
}

/**
 * Step: drive the real Onboarding wizard (provisionCompany). Uses a FIXED deterministic location
 * (fills the lat/long inputs directly) instead of the live Nominatim geocoder dropdown, to keep
 * the run flake-free per design.
 */
async function driveOnboarding(page: Page, baseURL: string, companyName: string, industry: string) {
  log(`Driving Onboarding wizard for company "${companyName}" ...`);
  await page.goto(`${baseURL}/auth/onboarding`, { waitUntil: "domcontentloaded" });

  // ── Step 1: identity + geofence ──
  await page.getByPlaceholder("e.g. Zenvix Corp").fill(companyName);
  await page.getByPlaceholder("Enter full physical address").fill(FIXED_LOCATION.address);

  // Deterministic location: write lat/long directly into the two number inputs (skip geocoder).
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill(String(FIXED_LOCATION.latitude));
  await numberInputs.nth(1).fill(String(FIXED_LOCATION.longitude));

  // Industry (first <select>) — pick the phase-appropriate industry where supplied.
  const selects = page.locator("select");
  try {
    await selects.nth(0).selectOption(industry);
  } catch {
    log(`Industry option "${industry}" not selectable; keeping default.`);
  }

  // Advance to step 2 (button enabled once name + address are present).
  await page.getByRole("button", { name: /Initialization Protocol/i }).click();

  // ── Step 2: confirm + provision ──
  await page.getByRole("button", { name: /Provision Cloud/i }).click();

  // provisionCompany success navigates to /core/dashboard.
  await page.waitForURL((url) => url.pathname.includes("/core/dashboard"), { timeout: 90000 });
  log(`Onboarding complete; org provisioned and landed on ${page.url()}`);
}

/**
 * Step: activate the phase's required modules.
 *
 * Preferred path is the Module Hub UI at /core/license; that route is loaded to exercise it. The
 * actual activation is then performed via the documented, authenticated Backend_API toggle the Hub
 * itself calls (`POST /v1/license/toggle/<code>` with `{ enabled: true }`), authenticated as the
 * synthetic owner. Each step performed is logged (Requirement 11.6).
 */
async function activateModules(
  page: Page,
  api: APIRequestContext,
  baseURL: string,
  modules: string[],
): Promise<string[]> {
  const activated: string[] = [];
  if (modules.length === 0) return activated;

  // Exercise the real Module Hub Page (also serves as Phase 2 verification of /core/license).
  try {
    await page.goto(`${baseURL}/core/license`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    log("Loaded Module Hub UI at /core/license.");
  } catch {
    log("Module Hub UI did not load; proceeding with documented backend activation.");
  }

  for (const code of modules) {
    log(
      `BOOTSTRAP STEP: activating module "${code}" via authenticated ` +
        `POST /v1/license/toggle/${code} { enabled: true } as the synthetic owner.`,
    );
    try {
      const res = await api.post(`/v1/license/toggle/${code}`, { data: { enabled: true } });
      if (res.ok()) {
        activated.push(code);
        log(`  ✔ module "${code}" activated (HTTP ${res.status()}).`);
      } else {
        log(`  ⚠ module "${code}" toggle returned HTTP ${res.status()} — left inactive.`);
      }
    } catch (e: any) {
      log(`  ⚠ module "${code}" activation failed: ${e?.message ?? e}`);
    }
  }
  return activated;
}

/**
 * Step: create extra role users under the SAME tenant, namespaced with the runId. Best-effort:
 * registers the user via self-service, then has the owner issue a tenant invitation for the role
 * (documented privileged step). Captures a token where login succeeds. Failures are logged, not
 * fatal, since extraRoles is optional.
 */
async function createExtraUsers(
  api: APIRequestContext,
  ownerApi: APIRequestContext,
  runId: string,
  extraRoles: Role[],
): Promise<SyntheticOrg["extraUsers"]> {
  if (!extraRoles || extraRoles.length === 0) return undefined;

  const created: NonNullable<SyntheticOrg["extraUsers"]> = [];
  for (const role of extraRoles) {
    const email = `synthtest+${runId}-${role.toLowerCase()}@zenvix.test`;
    const password = `Synth!${runId.slice(-6)}${role.slice(0, 2)}9`;
    log(`Creating extra ${role} user ${email} under the synthetic tenant ...`);

    let token = "";
    try {
      await api.post(`/v1/auth/register`, {
        data: {
          first_name: "Synth",
          last_name: role,
          email,
          password,
        },
      });

      // Documented privileged step: owner invites the new user into the tenant with the role.
      log(`  BOOTSTRAP STEP: owner issuing tenant invitation for ${email} (role ${role}).`);
      await ownerApi
        .post(`/v1/admin/invitations`, {
          data: { email, role, justification: `synthetic ${role} for ${runId}` },
        })
        .catch((e: any) => log(`  ⚠ invitation step failed: ${e?.message ?? e}`));

      // Attempt to capture a token for the new user (may have no company until invite accepted).
      const loginRes = await api
        .post(`/v1/auth/login`, { data: { email, password } })
        .catch(() => null);
      if (loginRes && loginRes.ok()) {
        const body = await loginRes.json().catch(() => ({}));
        token = body?.token || body?.data?.token || "";
      }
    } catch (e: any) {
      log(`  ⚠ extra ${role} user creation incomplete: ${e?.message ?? e}`);
    }

    created.push({ role, email, password, token });
  }
  return created;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Provision a fresh Synthetic_Organization on the Live_Environment for the phase under test.
 *
 * @param opts     phase, the module ids to activate, and any extra role users to create
 * @param runtime  optional injected browser/URLs (used by the Playwright setup project, task 16.2)
 */
export async function provisionSyntheticOrg(
  opts: ProvisionOptions,
  runtime: ProvisionRuntime = {},
): Promise<SyntheticOrg> {
  const { phase, modules, extraRoles } = opts;
  const cfg = resolveConfig(runtime);

  log(`Provisioning Synthetic_Organization for phase "${phase}".`);
  log(`Web_App base URL (from FRONTEND_URL/PLAYWRIGHT_BASE_URL): ${cfg.baseURL}`);
  log(`Backend_API base URL (from VITE_API_URL): ${cfg.apiBaseURL}`);
  log(
    `Owner password source: ${
      process.env.SYNTH_OWNER_PASSWORD ? "env SYNTH_OWNER_PASSWORD" : "generated per-run"
    } (value never logged).`,
  );

  // 1. Run identity — everything created is namespaced with this runId (Requirement 11.8).
  const runId = makeRunId(phase);
  const label = runId; // already "synthtest-<phase>-<ts>-<rand>"
  const ownerEmail = `synthtest+${runId}@zenvix.test`;
  const ownerPassword = makePassword(runId);
  const companyName = `Synth Org ${runId}`;
  log(`runId = ${runId}`);

  // Choose an industry hint from the requested modules where obvious, else the fixed default.
  const industry = FIXED_LOCATION.industry;

  // Own the browser lifecycle only if we launched it.
  const ownsBrowser = !runtime.browser;
  const browser = runtime.browser ?? (await chromium.launch());
  const context = await browser.newContext({ baseURL: cfg.baseURL });
  const page = await context.newPage();

  let apiCtx: APIRequestContext | undefined;
  let ownerApiCtx: APIRequestContext | undefined;

  try {
    // 2. Self-service sign-up + onboarding (preferred path; IS the Phase 1 verification).
    await driveRegister(page, cfg.baseURL, {
      email: ownerEmail,
      password: ownerPassword,
      firstName: "Synth",
      lastName: "Owner",
    });
    await driveOnboarding(page, cfg.baseURL, companyName, industry);

    // Read the live session the app persisted (token + tenant scope).
    const live = await readLiveSession(page);
    if (!live.token || !live.tenant_id) {
      throw new Error(
        "[provisionSyntheticOrg] Onboarding finished but no usable session was found in localStorage.",
      );
    }
    log(`Provisioned tenant ${live.tenant_id} (company ${live.company_id}).`);

    // Authenticated Backend_API contexts: anonymous-capable (for new-user register/login) and owner.
    apiCtx = await request.newContext({ baseURL: cfg.apiBaseURL });
    ownerApiCtx = await request.newContext({
      baseURL: cfg.apiBaseURL,
      extraHTTPHeaders: apiHeaders(live),
    });

    // 3. Module activation for the phase.
    const activatedModules = await activateModules(page, ownerApiCtx, cfg.baseURL, modules);

    // 4. Extra role users (optional), namespaced under the same tenant.
    const extraUsers = await createExtraUsers(apiCtx, ownerApiCtx, runId, extraRoles ?? []);

    // 5. Persist per-run Playwright storage state.
    if (!fs.existsSync(cfg.storageDir)) fs.mkdirSync(cfg.storageDir, { recursive: true });
    const statePath = path.join(cfg.storageDir, `${runId}.json`);
    await context.storageState({ path: statePath });
    log(`Saved per-run storage state to ${statePath}`);

    const org: SyntheticOrg = {
      runId,
      label,
      tenantId: live.tenant_id,
      companyId: live.company_id,
      branchId: live.branch_id || "",
      locationId: live.location_id || "",
      owner: {
        email: ownerEmail,
        password: ownerPassword,
        userId: live.user_id,
        token: live.token,
      },
      extraUsers,
      activatedModules,
      createdAt: new Date().toISOString(),
    };

    log(
      `Synthetic_Organization ready: tenant=${org.tenantId}, modules=[${org.activatedModules.join(
        ", ",
      )}], extraUsers=${org.extraUsers?.length ?? 0}.`,
    );
    return org;
  } finally {
    await apiCtx?.dispose().catch(() => undefined);
    await ownerApiCtx?.dispose().catch(() => undefined);
    await context.close().catch(() => undefined);
    if (ownsBrowser) await browser.close().catch(() => undefined);
  }
}

export default provisionSyntheticOrg;
