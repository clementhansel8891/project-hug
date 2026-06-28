# Design Document

## Overview

This design converts 182 stub modal dialogs into fully functional components by applying a consistent wiring pattern: React Hook Form + Zod validation + TanStack Query useMutation + apiRequest + toast notifications + cache invalidation. The work is organized into six priority tiers, with each modal being independently implementable. The existing backend API endpoints are already in place; this is a frontend-only effort.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Modal Component                               │
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐     │
│  │  Zod Schema  │───▶│  useForm()   │───▶│  Form Fields (UI)  │     │
│  │  (validation)│    │  + resolver  │    │  Shadcn components │     │
│  └──────────────┘    └──────────────┘    └────────────────────┘     │
│                             │                                         │
│                             ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   useMutation()                                │   │
│  │  mutationFn: apiRequest(endpoint, method, session, data)      │   │
│  │  onSuccess: toast + invalidateQueries + close modal           │   │
│  │  onError: toast (destructive) + map field errors              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
   ┌──────────┐                     ┌──────────────────┐
   │ Backend  │                     │ QueryClient      │
   │ API      │                     │ (cache refresh)  │
   └──────────┘                     └──────────────────┘
```

### Component Structure

Each wired modal follows this file organization:

```
src/pages/{module}/{area}/components/
├── {ModalName}.tsx          ← Modal component with form + mutation
├── {ModalName}.schema.ts    ← Zod schema (or co-located in same file for simple schemas)
```

For modules that already have a centralized schemas file (like procurement), schemas are added there.

## Components and Interfaces

### 1. Zod Schema Layer

Each modal gets a Zod schema defining its form shape. Schemas are co-located with the modal component or in a shared module schemas file when multiple modals share types.

**Pattern:**
```typescript
// {ModalName}.schema.ts
import { z } from "zod";

export const myModalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  category: z.enum(["A", "B", "C"], { required_error: "Category is required" }),
});

export type MyModalFormValues = z.infer<typeof myModalSchema>;
```

### 2. Modal Component (Wired)

Each stub modal is transformed by adding:
- `useForm` with `zodResolver`
- `useMutation` with the appropriate service call
- Form field bindings via `register()` or Controller
- Error display from `formState.errors`
- Loading/disabled states from `mutation.isPending`

**Pattern:**
```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/core/security/session";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/core/api/apiClient";
import { myModalSchema, type MyModalFormValues } from "./MyModal.schema";

export const MyModal: React.FC<Props> = ({ isOpen, onClose, context }) => {
  const session = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<MyModalFormValues>({
    resolver: zodResolver(myModalSchema),
    defaultValues: { /* from context */ },
  });

  const mutation = useMutation({
    mutationFn: (data: MyModalFormValues) =>
      apiRequest("/v1/module/endpoint", "POST", session, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Operation completed." });
      queryClient.invalidateQueries({ queryKey: ["module", "resource"] });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      // Map field-level errors if available
      if (error.fieldErrors) {
        Object.entries(error.fieldErrors).forEach(([field, msg]) => {
          form.setError(field as any, { message: msg as string });
        });
      }
    },
  });

  const onSubmit = form.handleSubmit((data) => mutation.mutate(data));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !mutation.isPending) { form.reset(); onClose(); } }}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          {/* Fields with form.register() or Controller */}
          {/* Submit button disabled={mutation.isPending} */}
        </form>
      </DialogContent>
    </Dialog>
  );
};
```

### 3. Query Key Registry

Each module maintains a query key registry (similar to `PROCUREMENT_KEYS`) so that cache invalidation targets the correct data:

```typescript
// src/modules/{module}/queryKeys.ts
export const MODULE_KEYS = {
  resource: ["module", "resource"] as const,
  detail: (id: string) => ["module", "resource", id] as const,
};
```

### 4. Service Layer Integration

Most modals call existing service functions (e.g., `retailService.createStore`). Where a service function doesn't exist, the modal calls `apiRequest` directly with the verified endpoint path.

## Data Models

### Form Values Types

Each modal schema generates a TypeScript type via `z.infer`:

```typescript
// Generated from Zod schema — one per modal
export type CreateStoreFormValues = z.infer<typeof createStoreSchema>;
export type CashPaymentFormValues = z.infer<typeof cashPaymentSchema>;
export type EditShiftFormValues = z.infer<typeof editShiftSchema>;
// ... (182 total, one per modal)
```

### Query Key Structure

Query keys follow the established `[module, resource]` pattern:

```typescript
// Retail
["retail", "stores"]
["retail", "shifts"]
["retail", "channels"]
["retail", "devices"]
["retail", "inventory"]

// Finance
["finance", "assets"]
["finance", "ledger-entries"]
["finance", "treasury-sources"]
["finance", "payables"]
["finance", "receivables"]

// HR
["hr", "employees"]
["hr", "roster"]
["hr", "org-structure"]
["hr", "talent"]

// Procurement (existing)
["procurement", "suppliers"]
["procurement", "requisitions"]
["procurement", "contracts"]

// Shared
["shared", "categories"]
["shared", "notifications"]
```

### Mutation Response Shape

All API responses follow the existing platform convention:

```typescript
// Success response — the created/updated resource
interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

// Error response — from backend
interface ApiErrorResponse {
  message: string;
  statusCode: number;
  fieldErrors?: Record<string, string>;  // Optional field-level errors for 422
}
```

## Data Flow

```
User fills form
    │
    ▼
form.handleSubmit() — triggers Zod validation
    │
    ├── INVALID → formState.errors displayed inline
    │
    └── VALID → mutation.mutate(data)
                    │
                    ├── isPending=true → UI locked (buttons disabled, spinner shown)
                    │
                    ▼
              apiRequest(endpoint, method, session, data)
                    │
                    ├── SUCCESS (2xx)
                    │     ├── toast({ title: "Success", ... })
                    │     ├── queryClient.invalidateQueries(keys)
                    │     ├── form.reset()
                    │     └── onClose()
                    │
                    └── ERROR (4xx/5xx/network)
                          ├── toast({ variant: "destructive", ... })
                          ├── Map field errors (if 422 with field details)
                          └── isPending=false → UI unlocked
```

## Implementation Strategy

### Phase 1: Tier 1 — Retail Operations (45 modals)

These modals block POS and store management. Implementation order:
1. POS payment modals (CashPaymentModal, ElectronicPaymentModal, CashierPOS payment dialog)
2. Shift management (Shifts.tsx x3, EditShiftModal, ShiftGovernanceModal)
3. Store registration (CreateStoreDialog, RegisterStoreDialog)
4. Inventory management (InventoryMovementDialog, InventoryStockEditDialog, ProductDetailEditDialog, AnomalyCompletionDialog, ReportFilterDialog)
5. Staff & Device modals (RoleModificationModal, StaffDetailsModal, DeviceModal, DiscoveryModal, RegisterModal, SensorModal)
6. Channel modals (ChannelDetailDialog, CreateChannelDialog, ManageConnectorDialog, RegisterEcommerceBranchDialog, ChannelProfilePanel)
7. CCTV modals (CCTVConnectorModal, CCTVViewerModal)
8. Remaining retail modals (OrderDetailModal, ItemDetailModal, TransferTrackingModal, CreatePromoModal, AuditTrailModal, InventoryVisibility x2, RetailCustomerActivity, Inventory.tsx x5, ScheduleGrid)

### Phase 2: Tier 2 — Finance (42 modals)

Group by sub-module: Assets (9), LedgerCore (5), TreasuryMap (4), MoneyDesk (4), PayFlow (3), shared dialogs (3), then remaining singles.

### Phase 3: Tier 3 — HR (27 modals)

Group by sub-module: TalentFlow (4), PeopleCore (4), OrgMap (3), FlowGate (3), RosterGrid (3), then remaining.

### Phase 4: Tier 4 — Procurement (11 modals)

Already has well-defined schemas and hooks. Wire SupplierDesk (5), PurchaseRequestDesk (3), PoReleaseDesk (1), ContractDesk (1), SupplierPortalDesk (1).

### Phase 5: Tier 5 — Shared Components (14 modals)

These are reusable across modules: ImportDialog, ExportSettingsDialog, CategoryManager, etc.

### Phase 6: Tier 6 — Other Modules (43 modals)

Inventory (14), Sales (7), Marketing (4), Comms (4), IT (3), Portal (3), then miscellaneous.

## Error Handling

| Error Type | Handling |
|-----------|----------|
| Zod validation failure | Inline field error messages via `formState.errors` |
| HTTP 400/422 with field errors | Map to form fields via `form.setError()` + destructive toast |
| HTTP 400/422 without field detail | Destructive toast with server message |
| HTTP 401/403 | Destructive toast "Session expired" or "Insufficient permissions" |
| HTTP 500 | Destructive toast "An unexpected error occurred" |
| Network failure | Destructive toast "Unable to connect. Please check your connection." |

## Correctness Properties

### Property 1: Schema Validation Consistency (Requirement 2, AC 2.1, 2.3)

**Validates: Requirements 2.1, 2.3**

For all Zod schemas defined for modals:
- Given a valid input conforming to the schema shape, `schema.safeParse(input).success` SHALL be `true`
- Given an input missing a required field, `schema.safeParse(input).success` SHALL be `false`
- Given an input with a field violating type/length/format constraints, `schema.safeParse(input).success` SHALL be `false`

This is a property-based test: generate random valid/invalid inputs and verify schema behavior is deterministic and correct.

### Property 2: Tenant Context Inclusion (Requirement 3, AC 3.2)

**Validates: Requirements 3.2**

For all modal submit handlers:
- Every API call made by a mutation function SHALL include the session object (which carries `tenant_id`)
- No API request SHALL be made without a valid session context

This is verifiable via code inspection and integration tests with intercepted requests.

### Property 3: Mutation State Consistency (Requirement 4, AC 4.1–4.4)

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

For all wired modals:
- WHILE `mutation.isPending === true`, the submit button SHALL be disabled
- WHILE `mutation.isPending === true`, form fields SHALL be non-interactive
- WHEN `mutation.isPending` transitions from `true` to `false`, all interactive elements SHALL be re-enabled

### Property 4: Cache Invalidation Completeness (Requirement 6, AC 6.2)

**Validates: Requirements 6.2**

For all successful mutations:
- `queryClient.invalidateQueries` SHALL be called with query keys that match the resource type affected by the mutation
- The invalidated keys SHALL correspond to the list query that displays the mutated resource

### Property 5: Form Reset on Modal Lifecycle (Requirements 6–7, AC 6.4, 7.3)

**Validates: Requirements 6.4, 7.3**

For all wired modals:
- WHEN the modal closes (success or cancel), `form.reset()` SHALL be called
- WHEN the modal is re-opened after a previous submission, form fields SHALL contain only default values (not stale data from the previous submission)

This is testable as an idempotence property: close → reopen → form state equals initial defaults.

### Property 6: Error Preservation (Requirement 5, AC 5.4)

**Validates: Requirements 5.4, 5.5**

For all wired modals:
- IF a mutation fails with an error, THEN the form field values at the time of submission SHALL be preserved
- The user SHALL NOT need to re-enter data after an error

## Accessibility Approach

All modals use Shadcn UI Dialog/Sheet components which provide:
- Focus trapping (built-in via Radix UI)
- Escape key to close (built-in)
- aria-labelledby via DialogTitle (built-in)
- Overlay click to close (built-in)

Additional requirements per modal:
- Form fields get explicit `id` and `aria-describedby` linking to error messages
- Submit/cancel buttons get descriptive `aria-label` attributes
- Toast notifications use `aria-live="polite"` region (provided by Shadcn toast)

## Testing Strategy

| Layer | Scope | Tool |
|-------|-------|------|
| Schema validation | Property-based tests for all Zod schemas | Vitest + fast-check |
| Component rendering | Verify form fields render with correct attributes | Vitest + Testing Library |
| Mutation flow | Mock API, verify correct endpoint/method/payload | Vitest + MSW |
| Loading states | Verify disabled states during pending mutation | Testing Library |
| Error handling | Mock error responses, verify toast + field errors | Testing Library |
| Accessibility | Verify aria attributes, focus management | Testing Library + axe |
| Coverage audit | Script to verify all 182 modal files have useForm + useMutation | Custom lint rule or script |
