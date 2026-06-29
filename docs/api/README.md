# Zenvix API & Flow Documentation

This folder is the single source of truth for how the Zenvix backend behaves.
Use it to design tests without re-reading the source each time.

## Read in order

1. **[00_CONVENTIONS.md](./00_CONVENTIONS.md)** — base URLs, auth, headers,
   response envelopes, error format (RFC 7807), roles, pagination, idempotency.
2. **[01_API_REFERENCE.md](./01_API_REFERENCE.md)** — complete endpoint catalog
   grouped by module, with methods, paths, roles, and request bodies.
3. **[02_APP_FLOWS.md](./02_APP_FLOWS.md)** — cross-module data flows (POS sale,
   procurement→receiving, sales pipeline, payroll→ledger, approvals). Each flow
   is a blueprint for a functional E2E test.
4. **[03_INTERACTION_CATALOG.md](./03_INTERACTION_CATALOG.md)** — the master
   inventory of **every user interaction** (button/form → service → API →
   data written → where it surfaces → role). One row = one testable interaction.
   This is the backbone for exhaustive test generation.
5. **[04_RETAIL_INTERACTIONS.md](./04_RETAIL_INTERACTIONS.md)** — the full retail
   surface (Management + Operational shells, 30+ pages, 6 controllers). Retail is
   too large for one row-group in doc 03, so it has its own exhaustive catalog.
6. **[05_FULL_COVERAGE_MAP.md](./05_FULL_COVERAGE_MAP.md)** — the complete
   page-by-page map of the **entire app** (Core + Retail + Procurement + all
   modules), built from a full `src/pages/**` scan. Lists every route-level page,
   its wired interactions, and its modals.
7. **[06_GAPS_AND_STUBS.md](./06_GAPS_AND_STUBS.md)** — the test-scoping filter:
   every dead button, stub, orphaned modal, endpoint mismatch, and code bug found
   during the scan. Read before writing tests so you don't target non-functional
   controls — and so you verify the likely-bug endpoints.
8. **[07_ENDPOINT_VERIFICATION.md](./07_ENDPOINT_VERIFICATION.md)** — live-backend
   probe results that turn doc 06's "likely bugs" into **confirmed** findings: the
   missing-`/v1` worry is retracted (apiClient normalizes), and **15 routes 404
   even with `/v1`** — real bugs where UI controls are wired to non-existent
   endpoints.

## How this maps to tests

| Test type | Source | Purpose |
|-----------|--------|---------|
| Smoke (page render) | `tests/playwright/human-e2e.spec.ts` | every route loads, no crash |
| API surface | `e2e-live/*.sh` (Phases 1–5) | every endpoint returns correct status |
| Functional E2E | (to build) per flow in `02_APP_FLOWS.md` | business operations propagate across modules |
| Interaction coverage | (to build) per row in `03_INTERACTION_CATALOG.md` | every button/form works + RBAC + edge cases |

## Test accounts (production VPS)

| Role | Email | Notes |
|------|-------|-------|
| Owner/Admin | `hansel@bambusilver.com` / `Hansel2024!` | full access |
| SPG (retail) | `dewa@bambusilver.com` / `Dewa2024!` | operational only |

Tenant: `tnt-3rlhko` · Company: `b74e21b9-4e99-42fd-857b-36bf4dee7ed5`
(The `e2e-live` shell suite provisions its own fresh tenant per run.)

## Verified vs. documented caveats

- `POST /finance/journal-entries` is **not** wired on the backend (frontend
  calls it but server uses the ledger event engine). Use `/finance/coa` +
  `/finance/ledger` for verified finance tests.
- `warehouse/bins` POST has **no `name` field** — use `code`, `zone`, etc.
- `/it/monitoring/stats` may return **403** if the IT module isn't activated.
- Retail public storefront routes skip tenant headers (channel-credential auth).
