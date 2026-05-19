'use client';

import { useCallback, useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SharingCategories {
  emotional_tendencies: boolean;
  behavioral_patterns: boolean;
  energy_levels: boolean;
  communication_guidance: boolean;
}

interface SharingNotifications {
  daily_summaries: boolean;
  phase_alerts: boolean;
  partner_reminders: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_CONFIG = [
  {
    key: 'emotional_tendencies' as const,
    label: 'Emotional Tendencies',
    description: 'Share emotional state insights and tendencies with your partner.',
  },
  {
    key: 'behavioral_patterns' as const,
    label: 'Behavioral Patterns',
    description: 'Share behavioral tendencies and social preferences with your partner.',
  },
  {
    key: 'energy_levels' as const,
    label: 'Energy Levels',
    description: 'Share energy level indicators and management insights with your partner.',
  },
  {
    key: 'communication_guidance' as const,
    label: 'Communication Guidance',
    description: 'Share communication style guidance and recommendations with your partner.',
  },
];

const NOTIFICATION_CONFIG = [
  {
    key: 'daily_summaries' as const,
    label: 'Daily Summaries',
    description: 'Send your partner a daily overview of your current state and best approach.',
  },
  {
    key: 'phase_alerts' as const,
    label: 'Phase Alerts',
    description: 'Notify your partner when your cycle transitions to a new phase.',
  },
  {
    key: 'partner_reminders' as const,
    label: 'Partner Reminders',
    description: 'Send gentle reminders to your partner during high-energy phases.',
  },
];

// ─── Page Component ─────────────────────────────────────────────────────────

export default function SharingControlsPage() {
  const [categories, setCategories] = useState<SharingCategories>({
    emotional_tendencies: true,
    behavioral_patterns: true,
    energy_levels: true,
    communication_guidance: true,
  });

  const [notifications, setNotifications] = useState<SharingNotifications>({
    daily_summaries: true,
    phase_alerts: true,
    partner_reminders: true,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryStatus, setCategoryStatus] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);

  // ─── Data Loading ───────────────────────────────────────────────────────────

  const fetchPreferences = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/sharing/categories', { method: 'GET' });

      if (response.ok) {
        const data = await response.json();
        if (data.preferences) {
          setCategories({
            emotional_tendencies: data.preferences.emotional_tendencies ?? true,
            behavioral_patterns: data.preferences.behavioral_patterns ?? true,
            energy_levels: data.preferences.energy_levels ?? true,
            communication_guidance: data.preferences.communication_guidance ?? true,
          });
          setNotifications({
            daily_summaries: data.preferences.daily_summaries ?? true,
            phase_alerts: data.preferences.phase_alerts ?? true,
            partner_reminders: data.preferences.partner_reminders ?? true,
          });
        }
      }
      // If 404 or other non-ok, use defaults (all enabled)
    } catch {
      // Use defaults on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleCategoryToggle = async (key: keyof SharingCategories, checked: boolean) => {
    const previousValue = categories[key];
    const updatedCategories = { ...categories, [key]: checked };
    setCategories(updatedCategories);
    setCategoryStatus(null);
    setError(null);

    try {
      const response = await fetch('/api/sharing/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: checked }),
      });

      if (!response.ok) {
        // Revert on failure
        setCategories({ ...updatedCategories, [key]: previousValue });
        const errorData = await response.json();
        setError(errorData.message || 'Failed to update sharing preference.');
        return;
      }

      setCategoryStatus('Sharing preference updated.');
    } catch {
      // Revert on failure
      setCategories({ ...updatedCategories, [key]: previousValue });
      setError('Something went wrong. Please try again.');
    }
  };

  const handleNotificationToggle = async (key: keyof SharingNotifications, checked: boolean) => {
    const previousValue = notifications[key];
    const updatedNotifications = { ...notifications, [key]: checked };
    setNotifications(updatedNotifications);
    setNotificationStatus(null);
    setError(null);

    try {
      const response = await fetch('/api/sharing/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: checked }),
      });

      if (!response.ok) {
        // Revert on failure
        setNotifications({ ...updatedNotifications, [key]: previousValue });
        const errorData = await response.json();
        setError(errorData.message || 'Failed to update notification preference.');
        return;
      }

      setNotificationStatus('Notification preference updated.');
    } catch {
      // Revert on failure
      setNotifications({ ...updatedNotifications, [key]: previousValue });
      setError('Something went wrong. Please try again.');
    }
  };

  // ─── Computed ─────────────────────────────────────────────────────────────

  const allCategoriesDisabled =
    !categories.emotional_tendencies &&
    !categories.behavioral_patterns &&
    !categories.energy_levels &&
    !categories.communication_guidance;

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading sharing preferences...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold">Sharing Controls</h1>
      <p className="text-muted-foreground">
        Manage what insights and notifications are shared with your partner. Changes apply within 5
        seconds.
      </p>

      {error && (
        <p className="text-sm text-destructive" role="alert" data-testid="sharing-error">
          {error}
        </p>
      )}

      {/* Insight Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Insight Categories</CardTitle>
          <CardDescription>
            Choose which categories of insights are visible to your partner. All categories are
            enabled by default when you link a partner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {CATEGORY_CONFIG.map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor={`category-${key}`} className="text-base font-medium">
                    {label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <Switch
                  id={`category-${key}`}
                  checked={categories[key]}
                  onCheckedChange={(checked) => handleCategoryToggle(key, checked)}
                  aria-label={`Toggle ${label}`}
                />
              </div>
            ))}

            {allCategoriesDisabled && (
              <p
                className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                role="status"
                data-testid="all-categories-disabled-warning"
              >
                All insight categories are disabled. Your partner will see a message indicating no
                shared content is currently available.
              </p>
            )}

            {categoryStatus && (
              <p className="text-sm text-green-600" role="status" data-testid="category-status">
                {categoryStatus}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
          <CardDescription>
            Control which notification types are sent to your partner. All notifications are enabled
            by default when you link a partner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {NOTIFICATION_CONFIG.map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor={`notification-${key}`} className="text-base font-medium">
                    {label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <Switch
                  id={`notification-${key}`}
                  checked={notifications[key]}
                  onCheckedChange={(checked) => handleNotificationToggle(key, checked)}
                  aria-label={`Toggle ${label}`}
                />
              </div>
            ))}

            {notificationStatus && (
              <p
                className="text-sm text-green-600"
                role="status"
                data-testid="notification-status"
              >
                {notificationStatus}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
