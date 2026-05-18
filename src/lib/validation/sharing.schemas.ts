import { z } from 'zod';

/** Toggle individual insight categories */
export const sharingCategoriesSchema = z.object({
  emotional_tendencies: z.boolean().optional(),
  behavioral_patterns: z.boolean().optional(),
  energy_levels: z.boolean().optional(),
  communication_guidance: z.boolean().optional(),
});

/** Toggle notification types */
export const sharingNotificationsSchema = z.object({
  daily_summaries: z.boolean().optional(),
  phase_alerts: z.boolean().optional(),
  partner_reminders: z.boolean().optional(),
  email_notifications_enabled: z.boolean().optional(),
});

export type SharingCategoriesInput = z.infer<typeof sharingCategoriesSchema>;
export type SharingNotificationsInput = z.infer<typeof sharingNotificationsSchema>;
