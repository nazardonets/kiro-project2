import { z } from 'zod';

import { NotificationFrequency, DeliveryTime } from '@/lib/types';

export const notificationPreferencesSchema = z.object({
  frequency: z.nativeEnum(NotificationFrequency),
  delivery_time: z.nativeEnum(DeliveryTime),
  reminders_enabled: z.boolean(),
  reminder_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Reminder time must be in HH:MM format'),
  timezone: z.string().min(1, 'Timezone is required'),
});

export const updateNotificationPreferencesSchema = notificationPreferencesSchema.partial();

export const toggleRemindersSchema = z.object({
  reminders_enabled: z.boolean(),
  reminder_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Reminder time must be in HH:MM format')
    .optional(),
});

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;
export type ToggleRemindersInput = z.infer<typeof toggleRemindersSchema>;
