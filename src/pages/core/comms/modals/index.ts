/**
 * Communications Module Modal Forms
 *
 * All modal forms use:
 * - ModuleModal (shared generic modal with react-hook-form + Zod)
 * - useModuleMutation (TanStack Query mutation with cache invalidation)
 * - Zod schemas for client-side validation with field-level error display
 *
 * 4 modals covering:
 * 1. BulletinCreateModal — publish new post to the bulletin board
 * 2. MailComposeModal — compose and send secure mail
 * 3. ChatCreateModal — create new chat group/channel
 * 4. ChannelConfigModal — configure bulletin channel/category
 */

export { BulletinCreateModal } from "./BulletinCreateModal";
export { MailComposeModal } from "./MailComposeModal";
export { ChatCreateModal } from "./ChatCreateModal";
export { ChannelConfigModal } from "./ChannelConfigModal";
