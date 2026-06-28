/**
 * Sales Module Modal Forms
 *
 * All modal forms use:
 * - ModuleModal (shared generic modal with react-hook-form + Zod)
 * - useModuleMutation (TanStack Query mutation with cache invalidation)
 * - Zod schemas for client-side validation with field-level error display
 *
 * 9 modals covering:
 * 1. CreateLeadModal — register new prospect
 * 2. ConvertLeadModal — lead-to-opportunity conversion (carries over company, contact, value)
 * 3. CreateQuotationModal — generate proposal from opportunity
 * 4. CreateOrderModal — create order from opportunity
 * 5. CreateTimelineEventModal — log interaction
 * 6. CreateSalesTaskModal — create follow-up task
 * 7. CloseOpportunityModal — close deal as WON/LOST
 * 8. QuoteActionModal — submit/approve/reject/send quotation
 * 9. IncentiveConfigModal — create new incentive plan
 */

export { CreateLeadModal } from "./CreateLeadModal";
export { ConvertLeadModal } from "./ConvertLeadModal";
export { CreateQuotationModal } from "./CreateQuotationModal";
export { CreateOrderModal } from "./CreateOrderModal";
export { CreateTimelineEventModal } from "./CreateTimelineEventModal";
export { CreateSalesTaskModal } from "./CreateSalesTaskModal";
export { CloseOpportunityModal } from "./CloseOpportunityModal";
export { QuoteActionModal } from "./QuoteActionModal";
export { IncentiveConfigModal } from "./IncentiveConfigModal";
