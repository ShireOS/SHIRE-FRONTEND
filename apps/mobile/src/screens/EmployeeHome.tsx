import {
  fetchEmployeeAnnouncements,
  fetchEmployeeEarnings,
  fetchEmployeeProfile,
  fetchEmployeeWeekSchedule,
  type Announcement,
  type EarningsSummary,
  type EmployeeProfile,
  type EmployeeShift,
} from '@/api/employeeOps';
import {
  clockInRemote,
  clockOutRemote,
  DEFAULT_REMOTE_TIME_CLOCK_POLICY,
  fetchEmployeeAdmins,
  fetchEmployeeTimeClockPolicy,
  fetchEmployeeTimeClockStatus,
  type AdminContact,
  type RemoteTimeClockPolicy,
  type TimeClockStatus,
} from '@/api/timeClock';
import { staleWhileRevalidate } from '@/cache/staleWhileRevalidate';
import {
  AnnouncementCard,
  PageHeader,
  ScreenShell,
  ShiftRow,
  formatTime,
  opsLavender,
  startOfWeek,
  toDateKey,
} from '@/components/scheduling/ScheduleKit';
import { UiButton } from '@/components/ui/Button';
import { UiText } from '@/components/ui/Text';
import { palette, semanticColors } from '@/styles/colors';
import { shadowMd } from '@/styles/shadows';
import { radius, spacing } from '@/styles/tokens';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

const EMPLOYEE_POLICY_CACHE_TTL_MS = 60_000;
const EMPLOYEE_POLICY_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const EMPLOYEE_STATUS_CACHE_TTL_MS = 10_000;
const EMPLOYEE_STATUS_MAX_STALE_MS = 24 * 60 * 60 * 1000;

function firstPresent<T>(...values: T[]) {
  return values.find((value) => value !== null && value !== undefined);
}

function formatMoney(value: unknown, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Unset';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(number);
}

export default function EmployeeHome() {
  const router = useRouter();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [timeClockPolicy, setTimeClockPolicy] = useState<RemoteTimeClockPolicy | null>(null);
  const [timeClockStatus, setTimeClockStatus] = useState<TimeClockStatus | null>(null);
  const [admins, setAdmins] = useState<AdminContact[]>([]);
  const [policyFreshness, setPolicyFreshness] = useState<'fresh' | 'stale' | 'miss' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTimeClockSaving, setIsTimeClockSaving] = useState(false);
  const [isClockInOpen, setIsClockInOpen] = useState(false);
  const [clockInReason, setClockInReason] = useState('');
  const [mentionedManagerId, setMentionedManagerId] = useState('');
  const [timeClockMessage, setTimeClockMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const weekStart = toDateKey(startOfWeek());
  const todayKey = toDateKey(new Date());

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      fetchEmployeeProfile(),
      fetchEmployeeWeekSchedule(weekStart, 'mine'),
      fetchEmployeeEarnings(),
      fetchEmployeeAnnouncements(),
    ])
      .then(([profileData, scheduleData, earningsData, announcementData]) => {
        if (cancelled) return;
        setProfile(profileData);
        setShifts(scheduleData.items || []);
        setEarnings(earningsData);
        setAnnouncements(announcementData);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load employee home.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  const loadTimeClockData = useCallback(async () => {
    const policyResult = await staleWhileRevalidate<RemoteTimeClockPolicy>({
      namespace: 'employee-time-clock-policy',
      version: 1,
      ttlMs: EMPLOYEE_POLICY_CACHE_TTL_MS,
      maxStaleMs: EMPLOYEE_POLICY_MAX_STALE_MS,
      fetcher: fetchEmployeeTimeClockPolicy,
      onRevalidate: setTimeClockPolicy,
    });
    setTimeClockPolicy(policyResult.data);
    setPolicyFreshness(policyResult.freshness);

    if (!policyResult.data.remote_time_clock.enabled) {
      setTimeClockStatus(null);
      setAdmins([]);
      return;
    }

    const [statusResult, adminResult] = await Promise.allSettled([
      staleWhileRevalidate<TimeClockStatus>({
        namespace: 'employee-time-clock-status',
        version: 1,
        ttlMs: EMPLOYEE_STATUS_CACHE_TTL_MS,
        maxStaleMs: EMPLOYEE_STATUS_MAX_STALE_MS,
        fetcher: fetchEmployeeTimeClockStatus,
        onRevalidate: setTimeClockStatus,
      }),
      fetchEmployeeAdmins(),
    ]);

    if (statusResult.status === 'fulfilled') setTimeClockStatus(statusResult.value.data);
    if (adminResult.status === 'fulfilled') {
      setAdmins(adminResult.value);
      setMentionedManagerId((current) => current || adminResult.value[0]?.id || '');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadTimeClockData().catch((err) => {
      if (!cancelled) {
        setTimeClockPolicy(null);
        setPolicyFreshness(null);
        setTimeClockMessage(err instanceof Error ? err.message : 'Remote clock-in is unavailable.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadTimeClockData]);

  const submitClockIn = async () => {
    const reason = clockInReason.trim();
    if (reason.length < 4) {
      setTimeClockMessage('Add a short reason before clocking in remotely.');
      return;
    }
    if (remoteSettings.require_manager_mention && !mentionedManagerId) {
      setTimeClockMessage('Choose a manager to notify.');
      return;
    }

    setIsTimeClockSaving(true);
    setTimeClockMessage('Clocking you in...');
    const optimisticTime = new Date().toISOString();
    setTimeClockStatus((current) => ({
      ...(current || {}),
      active_entry: {
        id: current?.active_entry?.id || `optimistic-${optimisticTime}`,
        clock_in_at: optimisticTime,
        status: 'pending',
      },
    }));
    try {
      const nextStatus = await clockInRemote({
        reason,
        mentioned_manager_id: mentionedManagerId || null,
      });
      setTimeClockStatus(nextStatus);
      setClockInReason('');
      setIsClockInOpen(false);
      setTimeClockMessage('Remote clock-in sent to your manager.');
    } catch (err) {
      await loadTimeClockData().catch(() => undefined);
      setTimeClockMessage(err instanceof Error ? err.message : 'Could not clock in remotely.');
    } finally {
      setIsTimeClockSaving(false);
    }
  };

  const submitClockOut = async () => {
    setIsTimeClockSaving(true);
    setTimeClockMessage('Clocking you out...');
    const optimisticTime = new Date().toISOString();
    setTimeClockStatus((current) => current?.active_entry
      ? {
          ...current,
          active_entry: {
            ...current.active_entry,
            clock_out_at: optimisticTime,
            status: current.active_entry.status || 'pending',
          },
        }
      : current);
    try {
      const nextStatus = await clockOutRemote();
      setTimeClockStatus(nextStatus);
      setTimeClockMessage('Clock-out recorded.');
    } catch (err) {
      await loadTimeClockData().catch(() => undefined);
      setTimeClockMessage(err instanceof Error ? err.message : 'Could not clock out.');
    } finally {
      setIsTimeClockSaving(false);
    }
  };

  const todayShifts = shifts.filter((shift) => String(shift.shift_date).slice(0, 10) === todayKey);
  const remoteSettings = timeClockPolicy?.remote_time_clock || DEFAULT_REMOTE_TIME_CLOCK_POLICY.remote_time_clock;
  const canUseRemoteClock = Boolean(timeClockPolicy && remoteSettings.enabled);
  const activeEntry = timeClockStatus?.active_entry || null;
  const latestRequest = timeClockStatus?.latest_request || null;
  const actualWages = firstPresent(
    earnings?.actual_labor_cost,
    earnings?.labor_cost,
    earnings?.estimated_wages,
  );
  const upcomingShifts = useMemo(
    () => shifts
      .filter((shift) => String(shift.shift_date).slice(0, 10) >= todayKey)
      .slice(0, 4),
    [shifts, todayKey],
  );

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <PageHeader
            eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            title={`Good ${greetingForNow()},\n${profile?.name || 'there'}.`}
            subtitle={todayShifts.length === 0 ? 'You have no shifts today.' : `You have ${todayShifts.length} shift${todayShifts.length === 1 ? '' : 's'} today.`}
            action={<View style={styles.profileDot}><UiText variant="caption" style={styles.profileInitial}>{(profile?.name || 'S').slice(0, 1)}</UiText></View>}
          />
          <View style={styles.todayCard}>
            {todayShifts.length === 0 ? (
              <>
                <UiText variant="title">Day off</UiText>
                <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
                  No shift is assigned to you today.
                </UiText>
              </>
            ) : (
              <>
                <UiText variant="h3">
                  {formatTime(todayShifts[0].shift_start)} - {formatTime(todayShifts[todayShifts.length - 1].shift_end)}
                </UiText>
                <View style={styles.todayMeta}>
                  <View style={styles.todayDot} />
                  <UiText variant="caption" tone="muted">
                    {todayShifts.map((shift) => shift.role || shift.waiter_role || 'Staff').join(' · ')}
                  </UiText>
                </View>
              </>
            )}
            <View style={styles.taskLine}>
              <Feather name="check-circle" size={14} color={palette.ink[500]} />
              <UiText variant="caption" tone="muted">You have 0 incomplete tasks.</UiText>
            </View>
          </View>
        </View>

        {isLoading && <LoadingCard label="Loading your shift hub..." />}
        {error && <StateCard title="Employee portal unavailable" body={error} />}

        {!isLoading && !error && (
          <>
            <View style={styles.messageBlock}>
              <UiText variant="h3">Message your manager on duty</UiText>
              <UiButton
                label="Start chat"
                style={styles.chatButton}
                onPress={() => router.push('/(employee)/messages' as never)}
              />
            </View>

            {canUseRemoteClock && (
              <View style={styles.timeClockCard}>
                <View style={styles.timeClockHeader}>
                  <View style={{ flex: 1 }}>
                    <UiText variant="eyebrow" tone="muted">Remote clock</UiText>
                    <UiText variant="h3" style={styles.timeClockTitle}>
                      {activeEntry && !activeEntry.clock_out_at ? 'You are clocked in' : 'Clock in remotely'}
                    </UiText>
                    <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>
                      {activeEntry && !activeEntry.clock_out_at
                        ? `Started ${new Date(activeEntry.clock_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                        : 'Your manager will review the reason after submission.'}
                    </UiText>
                  </View>
                  <View style={styles.timeClockBadge}>
                    <UiText variant="caption" style={styles.timeClockBadgeText}>
                      {activeEntry?.status || latestRequest?.status || 'Ready'}
                    </UiText>
                  </View>
                </View>
                {timeClockMessage ? (
                  <UiText variant="bodySmall" tone="muted" style={styles.timeClockMessage}>
                    {timeClockMessage}
                  </UiText>
                ) : null}
                {policyFreshness === 'stale' && (
                  <UiText variant="caption" tone="muted" style={styles.syncCopy}>
                    Showing the last saved restaurant policy while syncing.
                  </UiText>
                )}
                <View style={styles.timeClockActions}>
                  {activeEntry && !activeEntry.clock_out_at ? (
                    <UiButton
                      label={isTimeClockSaving ? 'Saving...' : 'Clock out'}
                      disabled={isTimeClockSaving}
                      onPress={submitClockOut}
                      style={styles.timeClockActionButton}
                    />
                  ) : (
                    <UiButton
                      label="Remote clock in"
                      disabled={isTimeClockSaving}
                      onPress={() => setIsClockInOpen(true)}
                      style={styles.timeClockActionButton}
                    />
                  )}
                </View>
              </View>
            )}

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <UiText variant="h3">Your upcoming shifts</UiText>
                <Pressable onPress={() => router.push('/(employee)/schedule' as never)}>
                  <UiText variant="caption" style={styles.viewAll}>View all</UiText>
                </Pressable>
              </View>
              {upcomingShifts.length === 0 ? (
                <UiText variant="bodySmall" tone="muted" style={styles.emptyCopy}>No upcoming shifts posted.</UiText>
              ) : (
                upcomingShifts.map((shift) => <ShiftRow key={shift.id} shift={shift} />)
              )}
            </View>

            <View style={styles.statsGrid}>
              <StatTile label="Hours" value={Number(earnings?.hours || 0).toFixed(1)} />
              <StatTile label="Shifts" value={String(earnings?.shift_count ?? upcomingShifts.length)} />
              <StatTile
                label="Wages"
                value={formatMoney(actualWages)}
              />
            </View>

            {announcements[0] && (
              <View style={styles.announcements}>
                <UiText variant="h3" style={{ marginBottom: spacing[3] }}>Latest announcement</UiText>
                <AnnouncementCard announcement={announcements[0]} />
              </View>
            )}
          </>
        )}
      </ScrollView>
      <Modal
        visible={isClockInOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsClockInOpen(false)}
      >
        <ScreenShell>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <PageHeader
              eyebrow="Remote clock"
              title="Clock in"
              subtitle="Add the reason and choose the manager who should see this first."
            />
            <View style={styles.formCard}>
              <UiText variant="title">Reason</UiText>
              <TextInput
                value={clockInReason}
                onChangeText={setClockInReason}
                placeholder="Running late from another site, covering a shift, or approved remote start..."
                placeholderTextColor={palette.ink[400]}
                multiline
                style={styles.reasonInput}
              />
              <UiText variant="title">Notify manager</UiText>
              <View style={styles.managerPicker}>
                {admins.length === 0 ? (
                  <UiText variant="bodySmall" tone="muted">No admins returned yet.</UiText>
                ) : admins.map((admin) => {
                  const active = mentionedManagerId === admin.id;
                  return (
                    <Pressable
                      key={admin.id}
                      onPress={() => setMentionedManagerId(admin.id)}
                      style={[styles.managerChip, active && styles.managerChipActive]}
                    >
                      <UiText variant="caption" style={[styles.managerChipText, active && styles.managerChipTextActive]} numberOfLines={1}>
                        {admin.name || admin.email || 'Manager'}
                      </UiText>
                    </Pressable>
                  );
                })}
              </View>
              {timeClockMessage ? <UiText variant="bodySmall" tone="muted">{timeClockMessage}</UiText> : null}
              <View style={styles.modalActions}>
                <UiButton label="Cancel" variant="secondary" onPress={() => setIsClockInOpen(false)} style={styles.modalButton} />
                <UiButton label={isTimeClockSaving ? 'Clocking in...' : 'Clock in'} disabled={isTimeClockSaving} onPress={submitClockIn} style={styles.modalButton} />
              </View>
            </View>
          </ScrollView>
        </ScreenShell>
      </Modal>
    </ScreenShell>
  );
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function LoadingCard({ label }: { label: string }) {
  return (
    <View style={styles.stateCard}>
      <UiText variant="bodySmall" tone="muted">{label}</UiText>
    </View>
  );
}

function StateCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.stateCard}>
      <UiText variant="title">{title}</UiText>
      <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>{body}</UiText>
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <UiText variant="eyebrow" tone="muted">{label}</UiText>
      <UiText variant="metricSmall" style={styles.statValue}>{value}</UiText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  hero: {
    backgroundColor: opsLavender,
    paddingBottom: spacing[6],
  },
  profileDot: {
    alignItems: 'center',
    backgroundColor: palette.sand[200],
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  profileInitial: {
    color: palette.ink[800],
    fontFamily: 'Inter_700Bold',
  },
  todayCard: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing[5],
    marginTop: spacing[5],
    overflow: 'hidden',
    padding: spacing[4],
    ...shadowMd,
  },
  todayMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  todayDot: {
    backgroundColor: '#df7cac',
    borderRadius: radius.pill,
    height: 9,
    width: 9,
  },
  taskLine: {
    alignItems: 'center',
    borderTopColor: semanticColors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing[2],
    marginHorizontal: -spacing[4],
    marginTop: spacing[4],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
  },
  messageBlock: {
    backgroundColor: semanticColors.elevated,
    gap: spacing[4],
    padding: spacing[5],
  },
  timeClockCard: {
    backgroundColor: semanticColors.elevated,
    borderColor: palette.sky[200],
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[3],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    padding: spacing[4],
  },
  timeClockHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing[3],
  },
  timeClockTitle: {
    color: palette.ink[900],
  },
  timeClockBadge: {
    backgroundColor: palette.sky[50],
    borderColor: palette.sky[200],
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  timeClockBadgeText: {
    color: palette.sky[700],
    textTransform: 'capitalize',
  },
  timeClockMessage: {
    backgroundColor: palette.stone[50],
    borderRadius: radius.sm,
    padding: spacing[3],
  },
  syncCopy: {
    color: palette.warning[700],
  },
  timeClockActions: {
    flexDirection: 'row',
  },
  timeClockActionButton: {
    flex: 1,
  },
  chatButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#ff6f4d',
    borderColor: '#ff6f4d',
    minWidth: 132,
  },
  sectionCard: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    overflow: 'hidden',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing[4],
  },
  viewAll: {
    color: '#ff6f4d',
  },
  emptyCopy: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing[3],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
  },
  statTile: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    padding: spacing[3],
  },
  statValue: {
    color: palette.ink[900],
    marginTop: spacing[2],
  },
  announcements: {
    marginHorizontal: spacing[4],
    marginTop: spacing[5],
  },
  stateCard: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[2],
    margin: spacing[4],
    padding: spacing[5],
  },
  modalContent: {
    gap: spacing[4],
    paddingBottom: 48,
  },
  formCard: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[3],
    marginHorizontal: spacing[4],
    padding: spacing[4],
  },
  reasonInput: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: palette.ink[900],
    fontFamily: 'Inter_400Regular',
    minHeight: 112,
    padding: spacing[3],
    textAlignVertical: 'top',
  },
  managerPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  managerChip: {
    backgroundColor: semanticColors.surface,
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: '100%',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  managerChipActive: {
    backgroundColor: palette.sky[700],
    borderColor: palette.sky[700],
  },
  managerChipText: {
    color: palette.ink[700],
  },
  managerChipTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  modalButton: {
    flex: 1,
  },
});
