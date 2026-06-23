import {
  fetchEmployeeProfile,
  fetchEmployeeWeekSchedule,
  type EmployeeProfile,
  type EmployeeShift,
} from '@/api/employeeOps';
import {
  DayScheduleSection,
  IconButton,
  LocationFilterRow,
  PageHeader,
  ScreenShell,
  SegmentedControl,
  WeekStrip,
  addDays,
  groupShiftsByDate,
  startOfWeek,
  toDateKey,
} from '@/components/scheduling/ScheduleKit';
import { UiText } from '@/components/ui/Text';
import { palette, semanticColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

type ScheduleScope = 'mine' | 'all';

export default function EmployeeSchedule() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [scope, setScope] = useState<ScheduleScope>('mine');
  const [weekStart, setWeekStart] = useState(() => toDateKey(startOfWeek()));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [mine, setMine] = useState<EmployeeShift[]>([]);
  const [all, setAll] = useState<EmployeeShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      fetchEmployeeProfile(),
      fetchEmployeeWeekSchedule(weekStart, 'mine'),
      fetchEmployeeWeekSchedule(weekStart, 'all'),
    ])
      .then(([profileData, mineData, allData]) => {
        if (cancelled) return;
        setProfile(profileData);
        setMine(mineData.items || []);
        setAll(allData.items || []);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load schedule.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  const visibleShifts = scope === 'mine' ? mine : all;
  const shiftsByDate = useMemo(() => groupShiftsByDate(visibleShifts), [visibleShifts]);
  const weekDates = Array.from({ length: 7 }, (_, index) => toDateKey(addDays(weekStart, index)));

  const moveWeek = (direction: number) => {
    const next = toDateKey(addDays(weekStart, direction * 7));
    setWeekStart(next);
    setSelectedDate(next);
  };

  return (
    <ScreenShell>
      <PageHeader
        eyebrow={profile?.restaurant_name || 'Schedule'}
        title={new Date(`${weekStart}T12:00:00`).toLocaleDateString(undefined, { month: 'long' })}
        subtitle="My shifts, full team schedule, and posted notes."
        action={<IconButton name="calendar" label="Current week" onPress={() => {
          const current = toDateKey(startOfWeek());
          setWeekStart(current);
          setSelectedDate(toDateKey(new Date()));
        }} />}
      />
      <SegmentedControl
        value={scope}
        options={[
          { id: 'mine', label: 'My Shifts' },
          { id: 'all', label: 'Schedule' },
        ]}
        onChange={setScope}
      />
      <View style={styles.monthControls}>
        <IconButton name="chevron-left" label="Previous week" onPress={() => moveWeek(-1)} />
        <UiText variant="caption" tone="muted">{weekStart}</UiText>
        <IconButton name="chevron-right" label="Next week" onPress={() => moveWeek(1)} />
      </View>
      <LocationFilterRow location={profile?.restaurant_name || 'Restaurant'} />
      <WeekStrip weekStart={weekStart} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {isLoading && (
        <View style={styles.stateCard}>
          <ActivityIndicator color={palette.sky[700]} />
          <UiText variant="bodySmall" tone="muted">Loading schedule...</UiText>
        </View>
      )}
      {error && (
        <View style={styles.stateCard}>
          <UiText variant="title">Schedule unavailable</UiText>
          <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>{error}</UiText>
        </View>
      )}

      {!isLoading && !error && (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {weekDates.map((dateKey) => (
            <DayScheduleSection
              key={dateKey}
              dateKey={dateKey}
              shifts={shiftsByDate[dateKey] || []}
              showPerson={scope === 'all'}
            />
          ))}
        </ScrollView>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  monthControls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  listContent: {
    paddingBottom: 120,
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
