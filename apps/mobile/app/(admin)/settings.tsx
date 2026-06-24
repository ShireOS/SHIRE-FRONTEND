import {
  DEFAULT_REMOTE_TIME_CLOCK_POLICY,
  fetchManagerJobCodes,
  fetchManagerTimeClockPolicy,
  updateManagerJobCode,
  type JobCode,
  saveManagerTimeClockPolicy,
  type RemoteTimeClockPolicy,
  type RemoteTimeClockSettings,
} from '@/api/timeClock';
import {
  fetchManagerStaff,
  updateManagerStaff,
  type StaffContact,
} from '@/api/employeeOps';
import { staleWhileRevalidate, writeCacheRecord } from '@/cache/staleWhileRevalidate';
import ScanCatalog from '@/screens/ScanCatalog';
import { UiButton } from '@/components/ui/Button';
import { UiText } from '@/components/ui/Text';
import { registerManagerPushToken } from '@/notifications/pushNotifications';
import { palette, semanticColors, statusColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { getOwnerRestaurant, type OwnerRestaurant } from '../../packages/supabase';

const POLICY_CACHE_TTL_MS = 60_000;
const POLICY_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const FALLBACK_ROLE_OPTIONS = ['manager', 'server', 'bartender', 'host', 'busser', 'runner', 'chef'];

export default function OwnerSettings() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<OwnerRestaurant | null>(null);
  const [policy, setPolicy] = useState<RemoteTimeClockPolicy | null>(null);
  const [jobCodes, setJobCodes] = useState<JobCode[]>([]);
  const [staff, setStaff] = useState<StaffContact[]>([]);
  const [rateEdits, setRateEdits] = useState<Record<string, string>>({});
  const [staffPayEdits, setStaffPayEdits] = useState<Record<string, string>>({});
  const [staffHoursEdits, setStaffHoursEdits] = useState<Record<string, string>>({});
  const [staffRoleEdits, setStaffRoleEdits] = useState<Record<string, string>>({});
  const [savingRateId, setSavingRateId] = useState<string | null>(null);
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);
  const [freshness, setFreshness] = useState<'fresh' | 'stale' | 'miss' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegisteringNotifications, setIsRegisteringNotifications] = useState(false);
  const [message, setMessage] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');

  const restaurantId = restaurant?.id;
  const settings = policy?.remote_time_clock || DEFAULT_REMOTE_TIME_CLOCK_POLICY.remote_time_clock;
  const roleOptions = Array.from(new Set([
    ...jobCodes.map((code) => code.code || code.label).filter(Boolean),
    ...staff.map((person) => person.role).filter(Boolean),
    ...FALLBACK_ROLE_OPTIONS,
  ])).map(String);

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
        const [codes, staffRows] = await Promise.all([
          fetchManagerJobCodes().catch(() => []),
          fetchManagerStaff(ownerRestaurant.id),
        ]);
        if (cancelled) return;
        setJobCodes(codes);
        setStaff(staffRows);
        setRateEdits(Object.fromEntries(codes.map((code) => [code.id, String(code.default_hourly_rate ?? '')])));
        setStaffPayEdits(Object.fromEntries(staffRows.map((person) => [person.id, stringifyPayRate(person)])));
        setStaffHoursEdits(Object.fromEntries(staffRows.map((person) => [person.id, String(person.suggested_weekly_hours ?? '')])));
        setStaffRoleEdits(Object.fromEntries(staffRows.map((person) => [person.id, String(person.role || '')])));
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

  const saveRoleRate = async (jobCode: JobCode) => {
    const rawRate = rateEdits[jobCode.id] ?? '';
    const parsed = Number(rawRate);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setMessage('Enter a valid hourly rate.');
      return;
    }
    setSavingRateId(jobCode.id);
    setMessage(`Saving ${jobCode.label || jobCode.code} rate...`);
    try {
      const saved = await updateManagerJobCode(jobCode.id, {
        default_hourly_rate: parsed.toFixed(2),
      });
      setJobCodes((current) => current.map((code) => (code.id === saved.id ? saved : code)));
      setRateEdits((current) => ({ ...current, [saved.id]: String(saved.default_hourly_rate ?? parsed.toFixed(2)) }));
      setMessage('Role rate saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save role rate.');
    } finally {
      setSavingRateId(null);
    }
  };

  const saveStaffPay = async (person: StaffContact) => {
    const rawRate = staffPayEdits[person.id]?.trim() ?? '';
    const rawHours = staffHoursEdits[person.id]?.trim() ?? '';
    const role = staffRoleEdits[person.id]?.trim() || person.role || undefined;
    const parsedRate = rawRate === '' ? null : Number(rawRate);
    const parsedHours = rawHours === '' ? null : Number(rawHours);
    if (parsedRate !== null && (!Number.isFinite(parsedRate) || parsedRate < 0)) {
      setMessage('Enter a valid employee hourly rate.');
      return;
    }
    if (parsedHours !== null && (!Number.isFinite(parsedHours) || parsedHours < 0)) {
      setMessage('Enter valid weekly hours.');
      return;
    }
    setSavingStaffId(person.id);
    setMessage(`Saving ${person.name || 'employee'} pay...`);
    try {
      const payPatch = buildPayPatch(person, parsedRate);
      const saved = await updateManagerStaff(person.id, {
        role,
        suggested_weekly_hours: parsedHours,
        ...payPatch,
      });
      setStaff((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setStaffPayEdits((current) => ({ ...current, [saved.id]: stringifyPayRate(saved) }));
      setStaffHoursEdits((current) => ({ ...current, [saved.id]: String(saved.suggested_weekly_hours ?? '') }));
      setStaffRoleEdits((current) => ({ ...current, [saved.id]: String(saved.role || '') }));
      setMessage('Employee pay saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save employee pay.');
    } finally {
      setSavingStaffId(null);
    }
  };

  const enableNotifications = async () => {
    if (!restaurantId) return;
    setIsRegisteringNotifications(true);
    setNotificationMessage('Requesting notifications...');
    try {
      const token = await registerManagerPushToken(restaurantId);
      setNotificationMessage(token ? 'Notifications are enabled on this device.' : 'Notifications were not enabled on this device.');
    } catch (err) {
      setNotificationMessage(err instanceof Error ? err.message : 'Could not enable notifications.');
    } finally {
      setIsRegisteringNotifications(false);
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

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Role rates</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Clocked labor uses these role rates unless an employee has a personal override.
            </UiText>
          </View>
        </View>
        {jobCodes.length === 0 ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">Role rates are not available yet.</UiText>
          </View>
        ) : (
          jobCodes
            .filter((code) => code.is_active !== false)
            .map((code) => (
              <View key={code.id} style={styles.rateRow}>
                <View style={{ flex: 1 }}>
                  <UiText variant="body" style={styles.settingTitle}>{code.label || code.code}</UiText>
                  <UiText variant="caption" tone="muted" style={{ marginTop: spacing[1] }}>
                    {code.is_tipped ? 'Tipped role' : 'Hourly role'}
                  </UiText>
                </View>
                <TextInput
                  value={rateEdits[code.id] ?? ''}
                  onChangeText={(value) => setRateEdits((current) => ({ ...current, [code.id]: value }))}
                  keyboardType="decimal-pad"
                  editable={!savingRateId}
                  placeholder="0.00"
                  placeholderTextColor={palette.ink[400]}
                  style={styles.rateInput}
                />
                <UiButton
                  label={savingRateId === code.id ? '...' : 'Save'}
                  disabled={Boolean(savingRateId)}
                  onPress={() => saveRoleRate(code)}
                  style={styles.rateButton}
                />
              </View>
            ))
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Employee pay</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Edit each person&apos;s role, hourly override, and weekly hour target.
            </UiText>
          </View>
        </View>
        {staff.length === 0 ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">No active employees returned yet.</UiText>
          </View>
        ) : (
          staff.map((person) => (
            <View key={person.id} style={styles.staffPayRow}>
              <View style={styles.staffPayHeader}>
                <View style={styles.staffAvatar}>
                  <UiText variant="caption" style={styles.staffAvatarText}>
                    {(person.name || person.email || '?').slice(0, 1).toUpperCase()}
                  </UiText>
                </View>
                <View style={{ flex: 1 }}>
                  <UiText variant="body" style={styles.settingTitle}>{person.name || person.email || 'Employee'}</UiText>
                  <UiText variant="caption" tone="muted" style={{ marginTop: spacing[1] }}>
                    {person.email || person.employee_login_id || 'Staff account'}
                  </UiText>
                </View>
              </View>
              <View style={styles.roleChoices}>
                {roleOptions.map((role) => {
                  const active = (staffRoleEdits[person.id] || person.role || '') === role;
                  return (
                    <Pressable
                      key={`${person.id}:${role}`}
                      onPress={() => setStaffRoleEdits((current) => ({ ...current, [person.id]: role }))}
                      style={[styles.rolePill, active && styles.rolePillActive]}
                    >
                      <UiText variant="caption" style={active ? styles.rolePillTextActive : styles.rolePillText}>
                        {role}
                      </UiText>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.staffPayFields}>
                <View style={styles.staffPayField}>
                  <UiText variant="caption" tone="muted">Hourly override</UiText>
                  <TextInput
                    value={staffPayEdits[person.id] ?? ''}
                    onChangeText={(value) => setStaffPayEdits((current) => ({ ...current, [person.id]: sanitizeMoney(value) }))}
                    keyboardType="decimal-pad"
                    editable={savingStaffId !== person.id}
                    placeholder={roleRateForPerson(person, jobCodes) || 'Role rate'}
                    placeholderTextColor={palette.ink[400]}
                    style={styles.payInput}
                  />
                </View>
                <View style={styles.staffPayField}>
                  <UiText variant="caption" tone="muted">Target hrs/wk</UiText>
                  <TextInput
                    value={staffHoursEdits[person.id] ?? ''}
                    onChangeText={(value) => setStaffHoursEdits((current) => ({ ...current, [person.id]: sanitizeMoney(value).slice(0, 5) }))}
                    keyboardType="decimal-pad"
                    editable={savingStaffId !== person.id}
                    placeholder="Unset"
                    placeholderTextColor={palette.ink[400]}
                    style={styles.payInput}
                  />
                </View>
                <UiButton
                  label={savingStaffId === person.id ? 'Saving...' : 'Save'}
                  disabled={Boolean(savingStaffId)}
                  onPress={() => saveStaffPay(person)}
                  style={styles.staffPayButton}
                />
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Notifications</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Receive manager alerts for remote-clock requests, schedule changes, and staff messages.
            </UiText>
          </View>
        </View>
        {notificationMessage ? (
          <View style={styles.messageCard}>
            <UiText variant="bodySmall" tone="muted">{notificationMessage}</UiText>
          </View>
        ) : null}
        <UiButton
          label={isRegisteringNotifications ? 'Enabling...' : 'Enable notifications'}
          disabled={isRegisteringNotifications || !restaurantId}
          onPress={enableNotifications}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <UiText variant="title">Staff chats</UiText>
            <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
              Start a DM, create a group chat, or post an announcement from admin.
            </UiText>
          </View>
        </View>
        <UiButton label="Open chats" onPress={() => router.push('/(admin)/messages' as never)} />
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
  rateRow: {
    alignItems: 'center',
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[3],
  },
  rateInput: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: palette.ink[900],
    fontFamily: 'Inter_600SemiBold',
    minWidth: 88,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    textAlign: 'right',
  },
  rateButton: {
    minWidth: 72,
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
  staffPayRow: {
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[3],
  },
  staffPayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
  },
  staffAvatar: {
    alignItems: 'center',
    backgroundColor: '#ffe4da',
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  staffAvatarText: {
    color: '#ff6f4d',
    fontFamily: 'Inter_700Bold',
  },
  roleChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  rolePill: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  rolePillActive: {
    backgroundColor: '#fff0ea',
    borderColor: '#ffd1c3',
  },
  rolePillText: {
    color: palette.ink[600],
    textTransform: 'capitalize',
  },
  rolePillTextActive: {
    color: '#d55232',
    fontFamily: 'Inter_700Bold',
    textTransform: 'capitalize',
  },
  staffPayFields: {
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: spacing[3],
  },
  staffPayField: {
    flex: 1,
    gap: spacing[1],
    minWidth: 120,
  },
  payInput: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: palette.ink[900],
    fontFamily: 'Inter_600SemiBold',
    minHeight: 44,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  staffPayButton: {
    minWidth: 84,
  },
  scanSection: {
    gap: spacing[3],
  },
});

function sanitizeMoney(value: string) {
  return value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 8);
}

function stringifyPayRate(person: StaffContact) {
  const value = person.hourly_rate ?? person.pay_rate ?? person.default_hourly_rate;
  return value === null || value === undefined ? '' : String(value);
}

function buildPayPatch(person: StaffContact, value: number | null) {
  if ('hourly_rate' in person) return { hourly_rate: value };
  if ('pay_rate' in person) return { pay_rate: value };
  if ('default_hourly_rate' in person) return { default_hourly_rate: value };
  return { hourly_rate: value };
}

function roleRateForPerson(person: StaffContact, jobCodes: JobCode[]) {
  const role = String(person.role || '').toLowerCase();
  const jobCode = jobCodes.find((code) => (
    String(code.code || '').toLowerCase() === role ||
    String(code.label || '').toLowerCase() === role ||
    String(code.id) === String(person.job_code_id || '')
  ));
  const value = jobCode?.default_hourly_rate;
  return value === null || value === undefined || value === '' ? '' : `$${value}`;
}
