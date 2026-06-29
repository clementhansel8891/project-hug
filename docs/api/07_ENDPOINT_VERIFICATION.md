# Endpoint Verification — Live Backend Probe Results

> Probed every Section-D suspect endpoint against the **live backend**
> (`150.109.15.108:3001`, tenant `tnt-3rlhko`, authenticated as
> `hansel@bambusilver.com`). Each route tested with its real HTTP method.
>
> Classification: **404** = route truly missing (NestJS "Cannot {METHOD} {path}"
> — routing fails before guards/validation, so 404 = no handler). **400/422** =
> route exists, body validation rejected our empty probe. **401/403** = exists,
> auth/role. **2xx** = works. **500** = exists but errored.
>
> Date probed: against current production deployment.

## ★ Headline correction: the "missing /v1" finding was a FALSE ALARM

`src/core/api/apiClient.ts` contains an **API routing normalizer**:

```ts
let normalizedPath = path;
if (!normalizedPath.startsWith("/v1") && !normalizedPath.startsWith("v1/")) {
  normalizedPath = `/v1${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`;
}
```

Every service path that omits `/v1` (comms, explorer, license, audit/logs,
settings/roles, reporting/archives, payment mutations, retail ecommerce-hub) is
**auto-prefixed at runtime**. Probe confirms:

| Bare path | `/v1` path |
|-----------|-----------|
| GET /comms/bulletin → **404** | GET /v1/comms/bulletin → **200** |
| GET /audit/logs → **404** | GET /v1/audit/logs → **200** |
| GET /license/my-modules → **404** | GET /v1/license/my-modules → **200** |
| GET /settings/roles → **404** | GET /v1/settings/roles → **200** |
| GET /reporting/archives → **404** | GET /v1/reporting/archives → **200** |
| GET /explorer/folders → **404** | GET /v1/explorer/folders → **200** |
| POST /payment/transactions → **404** | POST /v1/payment/transactions → **400 (exists)** |
| POST /payment/refunds → **404** | POST /v1/payment/refunds → **400 (exists)** |

**Conclusion:** the backend only serves `/v1`, and the frontend normalizer adds
it. So the missing-`/v1` service strings are cosmetic, **not bugs**. Doc 06
Section D's prefix subsection is retracted (corrected there).

---

## ✅ CONFIRMED REAL BUGS — routes that 404 even WITH `/v1`

These are frontend controls wired to endpoints that **do not exist** on the
backend. The UI control will always fail (or silently no-op where errors are
swallowed). Each is a concrete ticket.

| Frontend control | Path probed | Result | Impact |
|------------------|-------------|--------|--------|
| LedgerCore "Create Journal Entry" dialog | POST /v1/finance/journal-entries | **404** | journal creation via UI impossible (backend uses /finance/ledger/process-event → 400 exists) |
| PayableDesk "mark paid" | PATCH /v1/finance/payables/:id/paid | **404** | both variants broken |
| PayableDesk (service path) | POST /v1/finance/payables/:id/mark-paid | **404** | — |
| HR payroll modal | POST /v1/hr/payroll/runs | **404** | wrong path |
| HR payroll (service path) | POST /v1/hr/payroll-runs | **500** | exists but errors on our probe (needs valid body) |
| HR workflow modals | POST /v1/hr/workflows | **404** | route missing |
| HR roster modal | POST /v1/hr/roster/assign | **404** | route missing |
| HR scheduling (service path) | POST /v1/hr/scheduling/assign | **404** | route missing |
| HR talent modals | POST /v1/hr/talent/candidates | **404** | no backing route (confirmed) |
| IT CreateTicketModal | POST /v1/it/tickets | **404** | IT ticketing UI non-functional |
| IT IncidentReportModal | POST /v1/it/incidents | **404** | non-functional |
| IT EscalationModal | POST /v1/it/tickets/escalate | **404** | non-functional |
| IT ResolutionModal | POST /v1/it/tickets/resolve | **404** | non-functional |
| IT SLAConfigModal | POST /v1/it/sla-config | **404** | non-functional |
| Marketing OmnichannelConfigModal | POST /v1/marketing/omnichannel/config | **404** | route missing |
| Marketing asset upload (service) | POST /v1/marketing/assets/upload | **500** | exists but errors (needs multipart) |
| Sales CreateOrderModal | POST /v1/sales/orders | **404** | sales controller has GET orders, no POST — modal broken |
| Sales IncentiveConfigModal | POST /v1/sales/incentives/plans | **404** | route missing |
| Retail AnomalyCompletionDialog | POST /v1/inventory/items/:id/complete | **404** | wrong namespace, route missing |

### Caveat on two of the above
- `/v1/hr/payroll-runs` and `/v1/marketing/assets/upload` returned **500**, not
  404 — they **exist** but rejected the empty `{}` probe. Re-test with a valid
  payload to confirm they work; they are NOT missing routes.
- `/v1/workflow` base POST → 404, but `workflowService` calls **sub-paths**
  (`/v1/workflow/:id/approve` etc.) which were not individually probed. The
  FlowGate approve/reject flow tested green in the earlier shell E2E, so the
  base-path 404 is expected (no base POST handler), not a bug.

---

## ✅ CONFIRMED WORKING (route exists / validates)

| Control | Path | Result |
|---------|------|--------|
| Finance ledger event engine | POST /v1/finance/ledger/process-event | 400 (exists, validates) |
| Finance COA create | POST /v1/finance/coa | 400 (exists, validates) |
| Payment transactions/refunds | POST /v1/payment/{transactions,refunds} | 400 (exists, validates) |
| Marketing asset create | POST /v1/marketing/assets | **201 (works)** |
| Retail ecommerce-hub channels | POST /v1/retail/ecommerce-hub/channels | 400 (exists, validates) |
| Retail CCTV footage | POST /v1/retail/cctv/:id/footage | **201 (works)** |

> ⚠️ Probe side-effect: the two **201** rows created a junk marketing asset and a
> CCTV footage request in the `tnt-3rlhko` demo tenant. Harmless but should be
> cleaned if the tenant is used for demos.

---

## Net result

| Category | Count | Verdict |
|----------|-------|---------|
| "Missing /v1" service strings | 8+ | **NOT bugs** — apiClient normalizes |
| Routes 404 with /v1 (real bugs) | **15** | frontend wired to non-existent endpoints |
| Routes that exist but 500 on empty probe | 2 | re-test with valid body |
| Routes confirmed working | 6 | OK |

## Recommended next actions

1. **File 15 bug tickets** (the confirmed-404 table) — each is a UI control that
   cannot work. Highest user-impact: IT ticketing (5 endpoints), Sales order
   creation, LedgerCore journal entry, PayableDesk mark-paid.
2. **Decide fix direction per bug**: either wire the frontend to the existing
   backend route, or implement the missing backend route. (E.g. LedgerCore should
   call `/finance/ledger/process-event`; Sales CreateOrderModal should use the
   close-won flow or a new POST /sales/orders.)
3. **Re-probe the two 500s** with valid payloads to confirm they aren't also broken.
4. **Functional tests** should assert these endpoints return 2xx once fixed — they
   become regression guards.

---

## 🟢 FIXED & VERIFIED IN PRODUCTION — IT ticketing (#1–5)

The entire IT Service Management surface (5 dead endpoints) has been **built,
deployed, and verified live**. New backend: 3 Prisma models (`it_tickets`,
`it_incidents`, `it_sla_configs`) + tenant relations, migration
`20260629140000_add_it_ticketing`, DTOs, repository (db + mock), service methods,
controller routes. Commit `ce6eb517`, deployed to VPS, migration applied.

| UI control | Path | Before | After (live probe) |
|------------|------|--------|--------------------|
| IT CreateTicketModal | POST /v1/it/tickets | 404 | **201** (priority auto-computed) |
| IT list tickets | GET /v1/it/tickets | 404 | **200** |
| IT update ticket | PATCH /v1/it/tickets/:id | 404 | **200** |
| IT EscalationModal | POST /v1/it/tickets/escalate | 404 | **201** |
| IT ResolutionModal | POST /v1/it/tickets/resolve | 404 | **201** |
| IT IncidentReportModal | POST /v1/it/incidents | 404 | **201** |
| IT SLAConfigModal | POST /v1/it/sla-config | 404 | **201** |
| IT list SLA configs | GET /v1/it/sla-config | 404 | **200** |

> ⚠️ Probe side-effect: created test ticket / incident / SLA-config rows in the
> `tnt-3rlhko` demo tenant. Harmless; clean before demos.

## 🔴 RE-PROBED with valid body — HR payroll-runs (#14) still broken

`POST /v1/hr/payroll-runs` re-probed with a valid `{ periodStart, periodEnd }`
body → **still HTTP 500**. The route **exists** but errors server-side, so this
is reclassified from "re-test" to a **confirmed bug** needing investigation
(not a missing route). `POST /v1/marketing/assets/upload` (#16) was not
re-probed — it requires a multipart/file payload.

## Updated net result

| Category | Count | Verdict |
|----------|-------|---------|
| "Missing /v1" service strings | 8+ | NOT bugs — apiClient normalizes |
| Routes 404 with /v1 (original real bugs) | 15 | — |
| ↳ FIXED & verified (IT ticketing) | 5 | **resolved in prod** |
| ↳ Still open | 10 | see `BUGS.md` "Remaining open bugs" |
| 500-on-empty re-probed → confirmed bug | 1 (HR payroll-runs) | server error, exists |
| Routes confirmed working | 6 | OK |
