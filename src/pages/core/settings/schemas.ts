/**
 * Zod schemas for Settings module modals.
 * Provides client-side validation for general settings and notification preferences.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// General Settings Schema
// ---------------------------------------------------------------------------

export const generalSettingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(200),
  timezone: z.string().min(1, "Timezone is required"),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"], {
    required_error: "Date format is required",
  }),
  currency: z.enum(["USD", "IDR", "EUR", "GBP", "SGD"], {
    required_error: "Currency is required",
  }),
  fiscalYearStart: z.enum(["01", "04", "07", "10"], {
    required_error: "Fiscal year start month is required",
  }),
});

export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>;

// ---------------------------------------------------------------------------
// Notification Preferences Schema
// ---------------------------------------------------------------------------

export const notificationPreferencesSchema = z.object({
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  digestFrequency: z.enum(["realtime", "hourly", "daily", "weekly"], {
    required_error: "Digest frequency is required",
  }),
  quietHoursStart: z.string().optional().default("22:00"),
  quietHoursEnd: z.string().optional().default("07:00"),
});

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
