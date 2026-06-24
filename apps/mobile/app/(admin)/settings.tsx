import {
  DEFAULT_REMOTE_TIME_CLOCK_POLICY,
  fetchManagerTimeClockPolicy,
  saveManagerTimeClockPolicy,
  type RemoteTimeClockPolicy,
  type RemoteTimeClockSettings,
} from '@/api/timeClock';
import { staleWhileRevalidate, writeCacheRecord } from '@/cache/staleWhileRevalidate';
import ScanCatalog from '@/screens/ScanCatalog';
import { UiButton } from '@/components/ui/Button';
import { UiText } from '@/components/ui/Text';
import { palette, semanticColors, statusColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { getOwnerRestaurant, type OwnerRestaurant } from '../../packages/supabase';

const POLICY_CACHE_TTL_MS = 60_000;
const POLICY_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export default function OwnerSettings() {
  const [restaurant, setRestaurant] = useState<OwnerRestaurant | null>(null);
  const [policy, setPolicy] = useState<RemoteTimeClockPolicy | null>(null);
  const [freshness, setFreshness] = useState<'fresh' | 'stale' | 'miss' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const restaurantId = restaurant?.id;
  const settings = policy?.remote_time_clock || DEFAULT_REMOTE_TIME_CLOCK_POLICY.remote_time_clock;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getOwnerRestaurant()
      .then(async (ownerRestaurant) => {
        if (cancelled) return;
        setRestaurant(ownerRestaurant);
        if (!ownerRestaurant?.id) return;
        const result = await staleWhileRevalidate<RemoteTimeClockPolicy>({
          namespace: 'manager-time-clock-policy',
          version: 1,
          parts: [ownerRestaurant.id],
          ttlMs: POLICY_CACHE_TTL_MS,
          maxStaleMs: POLICY_MAX_STALE_MS,
          fetcher: () => fetchManagerTimeClockPolicy(ownerRestaurant.id),
          onRevalidate: setPolicy,
        });
        if (cancelled) return;
        setPolicy(result.data);
        setFreshness(result.freshness);
      })
      .catch((err) => {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Could not load settings.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSetting = (patch: Partial<RemoteTimeClockSettings>) => {
    setPolicy((current) => {
      const base = current || DEFAULT_REMOTE_TIME_CLOCK_POLICY;
      const nextSettings = {
        ...base.remote_time_clock,
        ...patch,
      };
      if (!nextSettings.enabled) nextSettings.allow_manual_entries = false;
      return {
        ...base,
        restaurant_id: restaurantId || base.restaurant_id,
        remote_time_clock: nextSettings,
      };
    });
  };

  const savePolicy = async () => {
    if (!restaurantId) return;
    setIsSaving(true);
    setMessage('Saving remote clock settings...');
    try {
      const saved = await saveManagerTimeClockPolicy(restaurantId, settings);
      setPolicy(saved);
      setFreshness('fresh');
      await writeCacheRecord(
        { namespace: 'manager-time-clock-policy', version: 1, parts: [restaurantId] },
        saved,
        POLICY_CACHE_TTL_MS,
      ).catch(() => undefined);
      setMessage('Remote clock settings saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save remote clock settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <UiText variant="eyebrow" tone="muted">Settings</UiText>
        <UiText variant="h2" style={styles.title}>Operations</UiText>
        <UiText variant="bodySmall" tone="muted" style={styles.subtitle}>
          {restaurant?.name || 'Restaurant'} controls for employee tools.
        </UiText>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Remote clock-in</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Disabled restaurants hide remote clock controls from employees.
            </UiText>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={(enabled) => updateSetting({ enabled, allow_manual_entries: enabled && settings.allow_manual_entries })}
            disabled={isLoading || isSaving}
          />
        </View>

        <SettingRow
          title="Manual hours"
          body="Allow employees to submit past work hours for manager approval."
          value={settings.enabled && settings.allow_manual_entries}
          disabled={!settings.enabled || isSaving}
          onValueChange={(allow_manual_entries) => updateSetting({ allow_manual_entries })}
        />
        <SettingRow
          title="Manager mention required"
          body="Employees choose one admin to notify; all admins can still review."
          value={settings.require_manager_mention}
          disabled={!settings.enabled || isSaving}
          onValueChange={(require_manager_mention) => updateSetting({ require_manager_mention })}
        />

        {freshness === 'stale' && (
          <View style={styles.warningCard}>
            <UiText variant="bodySmall" tone="warning">Showing cached settings while syncing.</UiText>
          </View>
        )}
        {message ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{message}</UiText>
          </View>
        ) : null}
        <UiButton
          label={isSaving ? 'Saving...' : 'Save remote clock settings'}
          disabled={isSaving || isLoading || !restaurantId}
          onPress={savePolicy}
        />
      </View>

      <View style={styles.scanSection}>
        <View style={styles.header}>
          <UiText variant="eyebrow" tone="muted">Setup scans</UiText>
          <UiText variant="h2" style={styles.title}>Scan catalog</UiText>
        </View>
        <ScanCatalog embedded />
      </View>
    </ScrollView>
  );
}

function SettingRow({
  title,
  body,
  value,
  disabled,
  onValueChange,
}: {
  title: string;
  body: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      style={[styles.settingRow, disabled && styles.settingRowDisabled]}
    >
      <View style={{ flex: 1 }}>
        <UiText variant="body" style={styles.settingTitle}>{title}</UiText>
        <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>{body}</UiText>
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onValueChange} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: semanticColors.background,
    flex: 1,
  },
  content: {
    gap: spacing[4],
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
  title: {
    color: palette.ink[900],
    marginTop: spacing[1],
  },
  subtitle: {
    marginTop: spacing[1],
  },
  card: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[4],
    marginHorizontal: spacing[4],
    padding: spacing[4],
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
  },
  settingRow: {
    alignItems: 'center',
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[3],
  },
  settingRowDisabled: {
    opacity: 0.55,
  },
  settingTitle: {
    color: palette.ink[900],
    fontFamily: 'Inter_600SemiBold',
  },
  warningCard: {
    backgroundColor: statusColors.warning.bg,
    borderColor: statusColors.warning.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
  },
  messageCard: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
  },
  scanSection: {
    gap: spacing[3],
  },
});
