/**
 * Communications Module Zod Schemas
 *
 * Validates all comms domain entities:
 * - Bulletin: title, body, category
 * - Mail: recipients, subject, body
 * - Chat: group name, type
 * - Channel: name, code, color
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Bulletin Schema
// ---------------------------------------------------------------------------

export const createBulletinSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title cannot exceed 200 characters"),
  body: z.string().min(1, "Body is required").max(5000, "Body cannot exceed 5000 characters"),
  category: z.string().min(1, "Category is required"),
});

export type CreateBulletinInput = z.infer<typeof createBulletinSchema>;

// ---------------------------------------------------------------------------
// Mail Compose Schema
// ---------------------------------------------------------------------------

export const composeMailSchema = z.object({
  to: z.string().min(1, "At least one recipient is required"),
  subject: z.string().min(1, "Subject is required").max(300, "Subject cannot exceed 300 characters"),
  body: z.string().max(50000).optional().or(z.literal("")),
  status: z.enum(["sent", "draft"]).default("sent"),
});

export type ComposeMailInput = z.infer<typeof composeMailSchema>;

// ---------------------------------------------------------------------------
// Chat Group Schema
// ---------------------------------------------------------------------------

export const createChatGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(100, "Name cannot exceed 100 characters"),
  type: z.enum(["PUBLIC", "PRIVATE"], { required_error: "Type is required" }),
  description: z.string().max(500).optional().or(z.literal("")),
});

export type CreateChatGroupInput = z.infer<typeof createChatGroupSchema>;

// ---------------------------------------------------------------------------
// Channel Config Schema
// ---------------------------------------------------------------------------

export const channelConfigSchema = z.object({
  name: z.string().min(1, "Channel name is required").max(100, "Name cannot exceed 100 characters"),
  code: z.string().min(1, "Code is required").max(50, "Code cannot exceed 50 characters"),
  color: z.string().min(4, "Color is required").max(9).default("#6366f1"),
});

export type ChannelConfigInput = z.infer<typeof channelConfigSchema>;
