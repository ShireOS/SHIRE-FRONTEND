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
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

export default function EmployeeHome() {
  const router = useRouter();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const todayShifts = shifts.filter((shift) => String(shift.shift_date).slice(0, 10) === todayKey);
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
                value={earnings?.estimated_wages == null ? 'Unset' : `$${Number(earnings.estimated_wages).toFixed(0)}`}
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
      <ActivityIndicator color={palette.sky[700]} />
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
});
