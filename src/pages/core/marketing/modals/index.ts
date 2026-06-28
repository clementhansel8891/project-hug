/**
 * Marketing Module Modal Forms
 *
 * All modal forms use:
 * - ModuleModal (shared generic modal with react-hook-form + Zod)
 * - useModuleMutation (TanStack Query mutation with cache invalidation)
 * - Zod schemas for client-side validation with field-level error display
 * - Toast notifications for success/error feedback
 * - Data preservation on error (modal stays open)
 *
 * 14 modals total covering:
 * - Campaign: Create, Update Status
 * - Lead: Capture
 * - Funnel: Create, Edit Step
 * - Nurture Workflow: Create
 * - Execution: Schedule
 * - Connected Account: Connect, Settings
 * - Creative Library: Upload Asset, Edit Tags
 * - Appointment: Create
 * - Omnichannel: Config
 */

export { CreateCampaignModal } from "./CreateCampaignModal";
export { UpdateCampaignStatusModal } from "./UpdateCampaignStatusModal";
export { CaptureLeadModal } from "./CaptureLeadModal";
export { CreateFunnelModal } from "./CreateFunnelModal";
export { EditFunnelStepModal } from "./EditFunnelStepModal";
export { CreateWorkflowModal } from "./CreateWorkflowModal";
export { ScheduleExecutionModal } from "./ScheduleExecutionModal";
export { ConnectAccountModal } from "./ConnectAccountModal";
export { AccountSettingsModal } from "./AccountSettingsModal";
export { UploadAssetModal } from "./UploadAssetModal";
export { EditAssetTagsModal } from "./EditAssetTagsModal";
export { CreateAppointmentModal } from "./CreateAppointmentModal";
export { OmnichannelConfigModal } from "./OmnichannelConfigModal";
