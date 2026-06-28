# Requirements Document

## Introduction

The Zenvix platform contains 182 modal dialogs that are currently non-functional stubs — they render Dialog/Sheet/Popover shells with no form fields, no validation, no submit handlers, and no API integration. This feature converts all 182 stub modals into fully functional, production-ready interactive components that submit data to existing backend API endpoints, handle errors gracefully, and invalidate relevant caches on success. The work is organized into six priority tiers (Retail Operations, Finance, HR, Procurement, Shared Components, and Other Modules).

## Glossary

- **Stub_Modal**: A modal dialog component (Dialog, Sheet, AlertDialog, or Popover) that renders an empty shell with no form fields, no submit handler, no validation, and no API integration
- **Modal_Component**: A fully wired modal dialog that includes form fields, Zod validation, a submit handler calling a backend API endpoint, loading/error states, toast notifications, and cache invalidation
- **Form_Schema**: A Zod validation schema defining the shape and constraints of form data for a specific modal
- **Submit_Handler**: An async function that sends validated form data to the backend API using the apiRequest utility and TanStack Query useMutation
- **Cache_Invalidation**: The process of calling queryClient.invalidateQueries after a successful mutation to refresh stale data in the UI
- **Toast_Notification**: A brief on-screen message informing the user of success or failure after form submission
- **API_Endpoint**: A backend NestJS route that accepts requests for creating, reading, updating, or deleting resources
- **Tenant_Context**: The multi-tenant session context that includes tenant_id, automatically included in all API requests via the session object
- **Wiring_Pattern**: The standard implementation pattern for converting a stub modal consisting of React Hook Form registration, Zod schema, useMutation hook, error handling, and cache invalidation

## Requirements

### Requirement 1: Form Field Generation

**User Story:** As a platform user, I want each modal to present the appropriate form fields for the operation, so that I can provide the necessary data to complete the action.

#### Acceptance Criteria

1. WHEN a stub modal is opened, THE Modal_Component SHALL render form fields appropriate to the operation context (e.g., text inputs, selects, date pickers, number inputs)
2. THE Modal_Component SHALL register all form fields with React Hook Form using the useForm hook
3. THE Modal_Component SHALL display field labels that clearly describe the expected input
4. WHEN a field has a default value derivable from context (e.g., current date, selected item ID), THE Modal_Component SHALL pre-populate the field with that value
5. THE Modal_Component SHALL maintain the existing glassmorphism aesthetic and Shadcn UI component patterns used across the platform

### Requirement 2: Form Validation

**User Story:** As a platform user, I want form inputs to be validated before submission, so that I receive immediate feedback on data entry errors without waiting for a server response.

#### Acceptance Criteria

1. THE Form_Schema SHALL define validation rules for each form field using Zod
2. WHEN a user submits a form with invalid data, THE Modal_Component SHALL display inline validation error messages adjacent to the offending fields
3. THE Form_Schema SHALL enforce required fields, type constraints, minimum/maximum lengths, and format patterns as appropriate to the operation
4. WHEN a user corrects an invalid field, THE Modal_Component SHALL clear the corresponding error message upon re-validation
5. THE Modal_Component SHALL prevent form submission until all validation rules pass

### Requirement 3: API Submission

**User Story:** As a platform user, I want to submit form data to the backend, so that my actions are persisted and take effect in the system.

#### Acceptance Criteria

1. WHEN a user submits a valid form, THE Submit_Handler SHALL send the validated data to the corresponding API_Endpoint using the apiRequest utility
2. THE Submit_Handler SHALL include the Tenant_Context (tenant_id) in every API request via the session object
3. THE Submit_Handler SHALL use TanStack Query useMutation to manage the mutation lifecycle
4. WHEN a modal performs a create operation, THE Submit_Handler SHALL use the HTTP POST method
5. WHEN a modal performs an update operation, THE Submit_Handler SHALL use the HTTP PATCH or PUT method as appropriate to the endpoint
6. WHEN a modal performs a delete or decommission operation, THE Submit_Handler SHALL use the HTTP DELETE method

### Requirement 4: Loading State Management

**User Story:** As a platform user, I want visual feedback during form submission, so that I know the system is processing my request.

#### Acceptance Criteria

1. WHILE a mutation is in progress, THE Modal_Component SHALL display a loading indicator on the submit button
2. WHILE a mutation is in progress, THE Modal_Component SHALL disable the submit button to prevent duplicate submissions
3. WHILE a mutation is in progress, THE Modal_Component SHALL disable the cancel/close button to prevent premature dismissal
4. WHILE a mutation is in progress, THE Modal_Component SHALL keep all form fields in a read-only or disabled state

### Requirement 5: Error Handling

**User Story:** As a platform user, I want clear error messages when an operation fails, so that I can understand what went wrong and take corrective action.

#### Acceptance Criteria

1. IF the API returns an error response, THEN THE Modal_Component SHALL display a destructive toast notification containing the error message
2. IF a network error occurs during submission, THEN THE Modal_Component SHALL display a toast notification indicating a connectivity issue
3. IF the API returns a validation error (HTTP 400/422), THEN THE Modal_Component SHALL map server-side field errors to the corresponding form fields when the error response includes field-level detail
4. IF an error occurs, THEN THE Modal_Component SHALL retain the user-entered form data so the user can correct and retry without re-entering all fields
5. IF an error occurs, THEN THE Modal_Component SHALL re-enable the submit button after the error is displayed

### Requirement 6: Success Handling and Cache Invalidation

**User Story:** As a platform user, I want the interface to update immediately after a successful operation, so that I see current data without manually refreshing.

#### Acceptance Criteria

1. WHEN a mutation succeeds, THE Modal_Component SHALL display a success toast notification describing the completed action
2. WHEN a mutation succeeds, THE Modal_Component SHALL call queryClient.invalidateQueries with the appropriate query keys to refresh related data
3. WHEN a mutation succeeds, THE Modal_Component SHALL close the modal dialog automatically
4. WHEN a mutation succeeds, THE Modal_Component SHALL reset the form state to prevent stale data on next open

### Requirement 7: Cancel and Close Behavior

**User Story:** As a platform user, I want to cancel or close a modal without side effects, so that incomplete or accidental actions do not persist.

#### Acceptance Criteria

1. WHEN a user clicks the cancel button, THE Modal_Component SHALL close the dialog without submitting data
2. WHEN a user clicks the close (X) button or clicks outside the modal overlay, THE Modal_Component SHALL close the dialog without submitting data
3. WHEN a modal is closed without submission, THE Modal_Component SHALL reset form state and clear any validation errors
4. IF a user has entered data and attempts to close the modal, THEN THE Modal_Component SHALL close immediately without a confirmation prompt for simple forms (fewer than 4 fields)

### Requirement 8: Accessibility Compliance

**User Story:** As a platform user relying on assistive technology, I want modals to be fully accessible, so that I can complete all operations regardless of input method.

#### Acceptance Criteria

1. THE Modal_Component SHALL set an aria-labelledby attribute referencing the modal title
2. THE Modal_Component SHALL trap keyboard focus within the modal while it is open
3. WHEN a modal opens, THE Modal_Component SHALL move focus to the first interactive element
4. WHEN a user presses the Escape key, THE Modal_Component SHALL close the modal
5. THE Modal_Component SHALL associate error messages with their corresponding fields using aria-describedby
6. THE Modal_Component SHALL provide aria-live regions for toast notifications so screen readers announce them

### Requirement 9: Tier-Based Implementation Coverage

**User Story:** As a product owner, I want all 182 stub modals converted to functional modals organized by priority tier, so that the most critical workflows are addressed first.

#### Acceptance Criteria

1. THE Wiring_Pattern SHALL be applied to all 45 Tier 1 modals (Retail Operations) including POS payment, shift management, store registration, staff assignments, device control, channel management, CCTV, pricing/promo, inventory visibility, and order details
2. THE Wiring_Pattern SHALL be applied to all 42 Tier 2 modals (Finance) including asset management, ledger operations, treasury, money desk, payment flow, shared finance dialogs, policy manager, payables, receivables, invoice capture, and document management
3. THE Wiring_Pattern SHALL be applied to all 27 Tier 3 modals (HR) including talent flow, people core, org map, flow gate, roster grid, cases, scheduling, skill track, vault space, lex board, growth cycle, and pay cycle
4. THE Wiring_Pattern SHALL be applied to all 11 Tier 4 modals (Procurement) including supplier desk, purchase request desk, PO release, contract desk, and supplier portal
5. THE Wiring_Pattern SHALL be applied to all 14 Tier 5 modals (Shared Components) including import dialog, export settings, category manager, module modal, notification center, label printing, stock opname summary, unknown barcode, unresolved barcodes, watermark config, command palette, and sidebar
6. THE Wiring_Pattern SHALL be applied to all 43 Tier 6 modals (Other Modules) including inventory, sales, marketing, comms, IT, portal, auth, settings, tools, payment, logs, audit, and admin modals

### Requirement 10: Consistent Implementation Pattern

**User Story:** As a developer maintaining the platform, I want all modals to follow a consistent implementation pattern, so that the codebase remains predictable and maintainable.

#### Acceptance Criteria

1. THE Modal_Component SHALL use React Hook Form with a Zod resolver for all form state management
2. THE Modal_Component SHALL use TanStack Query useMutation for all API mutations
3. THE Modal_Component SHALL use the apiRequest utility function for all HTTP requests
4. THE Modal_Component SHALL use the useSession hook to obtain the Tenant_Context for API calls
5. THE Modal_Component SHALL use the Shadcn UI toast system (useToast hook) for all user notifications
6. THE Modal_Component SHALL co-locate the Zod schema definition with or adjacent to the modal component file
