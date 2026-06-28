/**
 * Zod schemas for Portal module modals.
 * Provides client-side validation for portal settings, page creation, and widget configuration.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Portal Settings Schema
// ---------------------------------------------------------------------------

export const portalSettingsSchema = z.object({
  portalName: z.string().min(1, "Portal name is required").max(100),
  description: z.string().max(500).optional().default(""),
  theme: z.enum(["light", "dark", "auto"], {
    required_error: "Theme is required",
  }),
  language: z.enum(["en", "id", "es", "fr", "de"], {
    required_error: "Language is required",
  }),
  isPublic: z.boolean().default(false),
});

export type PortalSettingsInput = z.infer<typeof portalSettingsSchema>;

// ---------------------------------------------------------------------------
// Page Create Schema
// ---------------------------------------------------------------------------

export const pageCreateSchema = z.object({
  title: z.string().min(1, "Page title is required").max(200),
  slug: z
    .string()
    .min(1, "URL slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
  layout: z.enum(["full-width", "sidebar", "centered", "dashboard"], {
    required_error: "Layout is required",
  }),
  parentPageId: z.string().optional().default(""),
  isPublished: z.boolean().default(false),
});

export type PageCreateInput = z.infer<typeof pageCreateSchema>;

// ---------------------------------------------------------------------------
// Widget Config Schema
// ---------------------------------------------------------------------------

export const widgetConfigSchema = z.object({
  widgetType: z.enum(["chart", "table", "metric", "feed", "calendar", "custom"], {
    required_error: "Widget type is required",
  }),
  title: z.string().min(1, "Widget title is required").max(100),
  dataSource: z.string().min(1, "Data source is required"),
  refreshInterval: z.coerce.number().min(0, "Refresh interval must be 0 or greater").default(30),
  width: z.enum(["1", "2", "3", "4"], { required_error: "Width is required" }),
});

export type WidgetConfigInput = z.infer<typeof widgetConfigSchema>;
