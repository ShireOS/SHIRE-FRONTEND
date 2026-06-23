import {
  createManagerSchedule,
  createManagerScheduleItem,
  fetchManagerScheduleHistory,
  fetchManagerSchedules,
  fetchManagerStaff,
  runManagerScheduler,
  updateManagerScheduleItem,
  updateManagerScheduleSummary,
  type EmployeeShift,
  type ManagerSchedule as ManagerSchedulePayload,
  type StaffContact,
} from '@/api/employeeOps';
import {
  DayScheduleSection,
  IconButton,
  LocationFilterRow,
  PageHeader,
  ScreenShell,
  TextField,
  WeekStrip,
  addDays,
  groupShiftsByDate,
  opsAccent,
  shiftHours,
  startOfWeek,
  toDateKey,
} from '@/components/scheduling/ScheduleKit';
import { UiButton } from '@/components/ui/Button';
import { UiText } from '@/components/ui/Text';
import { staleWhileRevalidate, writeCacheRecord } from '@/cache/staleWhileRevalidate';
import { palette, semanticColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { getOwnerRestaurant, type OwnerRestaurant } from '../../packages/supabase';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

const STAFF_ROLES = ['manager', 'server', 'bartender', 'host', 'busser', 'runner', 'chef'];
const AUTO_GENERATE_MANUAL_THRESHOLD = 4;
const SCHEDULE_CACHE_TTL_MS = 30_000;
const SCHEDULE_CACHE_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

type ManagerScheduleCacheData = {
  schedules: ManagerSchedulePayload[];
  staff: StaffContact[];
  manualScheduleCount: number;
};

export default function ManagerSchedule() {
  const [restaurant, setRestaurant] = useState<OwnerRestaurant | null>(null);
  const [weekStart, setWeekStart] = useState(() => toDateKey(startOfWeek()));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [schedules, setSchedules] = useState<ManagerSchedulePayload[]>([]);
  const [staff, setStaff] = useState<StaffContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<EmployeeShift | null>(null);
  const [shiftForm, setShiftForm] = useState({ role: '', shift_start: '', shift_end: '' });
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [newShiftForm, setNewShiftForm] = useState({ waiter_id: '', role: 'server', shift_start: '17:00', shift_end: '21:00' });
  const [scheduleContext, setScheduleContext] = useState('');
  const [manualScheduleCount, setManualScheduleCount] = useState(0);
  const staffRef = useRef<StaffContact[]>([]);
  const manualScheduleCountRef = useRef(0);

  const restaurantId = restaurant?.id;

  const applyCachedData = useCallback((data: ManagerScheduleCacheData) => {
    setSchedules(data.schedules);
    setStaff(data.staff);
    setManualScheduleCount(data.manualScheduleCount);
    staffRef.current = data.staff;
    manualScheduleCountRef.current = data.manualScheduleCount;
  }, []);

  const persistScheduleCache = useCallback(async (
    id: string,
    targetWeekStart: string,
    data: ManagerScheduleCacheData,
  ) => {
    await writeCacheRecord(
      { namespace: 'manager-schedule', version: 1, parts: [id, targetWeekStart] },
      data,
      SCHEDULE_CACHE_TTL_MS,
    ).catch(() => undefined);
  }, []);

  const commitManagerData = useCallback(async (
    id: string,
    targetWeekStart: string,
    data: ManagerScheduleCacheData,
  ) => {
    applyCachedData(data);
    await persistScheduleCache(id, targetWeekStart, data);
  }, [applyCachedData, persistScheduleCache]);

  const refreshManagerData = useCallback(async (id: string, targetWeekStart = weekStart): Promise<ManagerScheduleCacheData> => {
    const scheduleData = await fetchManagerSchedules(id, targetWeekStart);
    const optionalResults = await Promise.allSettled([
      fetchManagerScheduleHistory(id),
      fetchManagerStaff(id),
    ]);
    const [historyResult, staffResult] = optionalResults;
    const nextData = {
      schedules: scheduleData,
      staff: staffResult.status === 'fulfilled' ? staffResult.value : staffRef.current,
      manualScheduleCount: historyResult.status === 'fulfilled'
        ? historyResult.value.filter((schedule) => schedule.generated_by === 'manual').length
        : manualScheduleCountRef.current,
    };
    await persistScheduleCache(id, targetWeekStart, nextData);
    return nextData;
  }, [persistScheduleCache, weekStart]);

  const loadManagerData = useCallback(async (id: string) => {
    const key = { namespace: 'manager-schedule', version: 1, parts: [id, weekStart] };
    const result = await staleWhileRevalidate<ManagerScheduleCacheData>({
      ...key,
      ttlMs: SCHEDULE_CACHE_TTL_MS,
      maxStaleMs: SCHEDULE_CACHE_MAX_STALE_MS,
      fetcher: () => refreshManagerData(id, weekStart),
      onRevalidate: applyCachedData,
    });
    applyCachedData(result.data);
  }, [applyCachedData, refreshManagerData, weekStart]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getOwnerRestaurant()
      .then(async (ownerRestaurant) => {
        if (cancelled) return;
        setRestaurant(ownerRestaurant);
        if (ownerRestaurant?.id) await loadManagerData(ownerRestaurant.id);
      })
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load manager schedule.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadManagerData]);

  const activeSchedule = schedules[0] || null;
  const scheduleItems = useMemo(() => activeSchedule?.items || [], [activeSchedule]);
  const shiftsByDate = useMemo(() => groupShiftsByDate(scheduleItems as EmployeeShift[]), [scheduleItems]);
  const visibleWeekStart = activeSchedule?.week_start_date || weekStart;
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => toDateKey(addDays(visibleWeekStart, index))),
    [visibleWeekStart],
  );
  const selectedDayShifts = shiftsByDate[selectedDate] || [];
  const totalHours = scheduleItems.reduce((sum, shift) => sum + shiftHours(shift as EmployeeShift), 0);
  const selectedDayLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const canAutoGenerate = manualScheduleCount >= AUTO_GENERATE_MANUAL_THRESHOLD;
  const manualSchedulesRemaining = Math.max(0, AUTO_GENERATE_MANUAL_THRESHOLD - manualScheduleCount);

  useEffect(() => {
    if (!selectedShift) {
      setShiftForm({ role: '', shift_start: '', shift_end: '' });
      return;
    }
    setShiftForm({
      role: selectedShift.role || selectedShift.waiter_role || '',
      shift_start: String(selectedShift.shift_start || '').slice(0, 5),
      shift_end: String(selectedShift.shift_end || '').slice(0, 5),
    });
  }, [selectedShift]);

  useEffect(() => {
    if (!scheduleItems.length) return;
    if (weekDates.includes(selectedDate) && shiftsByDate[selectedDate]?.length) return;
    const firstShiftDate = String(scheduleItems[0]?.shift_date || visibleWeekStart).slice(0, 10);
    setSelectedDate(firstShiftDate);
  }, [scheduleItems, selectedDate, shiftsByDate, visibleWeekStart, weekDates]);

  useEffect(() => {
    if (newShiftForm.waiter_id || staff.length === 0) return;
    const firstStaff = staff[0];
    setNewShiftForm((prev) => ({
      ...prev,
      waiter_id: firstStaff.id,
      role: firstStaff.role || prev.role,
    }));
  }, [newShiftForm.waiter_id, staff]);

  const attachScheduleContext = async (scheduleId: string, context: string) => {
    const trimmed = context.trim();
    if (!trimmed) return;
    await updateManagerScheduleSummary(scheduleId, `Manager context: ${trimmed}`);
  };

  const startManualSchedule = async () => {
    if (!restaurantId) return;
    setIsSaving(true);
    setStatus(activeSchedule ? 'Opening this week for manual scheduling.' : 'Creating a manual draft for this week.');
    try {
      let schedule = activeSchedule;
      let nextManualScheduleCount = manualScheduleCount;
      if (!schedule) {
        schedule = await createManagerSchedule(restaurantId, visibleWeekStart);
        nextManualScheduleCount += 1;
      }
      if (schedule?.id) {
        await attachScheduleContext(schedule.id, scheduleContext);
      }
      const updated = await fetchManagerSchedules(restaurantId, visibleWeekStart);
      await commitManagerData(restaurantId, visibleWeekStart, {
        schedules: updated,
        staff,
        manualScheduleCount: nextManualScheduleCount,
      });
      setIsScheduleModalOpen(false);
      setStatus('Manual draft is ready. Tap shifts to edit; add-shift controls can build on this draft next.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not create manual draft.');
    } finally {
      setIsSaving(false);
    }
  };

  const generateDraft = async (context = '') => {
    if (!restaurantId) return;
    if (!canAutoGenerate) {
      setStatus(`Auto generation unlocks after ${manualSchedulesRemaining} more manual schedule${manualSchedulesRemaining === 1 ? '' : 's'}.`);
      return;
    }
    setIsSaving(true);
    setStatus('Generating a fresh draft. This may replace the current draft for this week.');
    try {
      const run = await runManagerScheduler(restaurantId, visibleWeekStart);
      const nextWeekStart = run.week_start_date || visibleWeekStart;
      setWeekStart(nextWeekStart);
      const updated = await fetchManagerSchedules(restaurantId, nextWeekStart);
      if (updated[0]?.id) {
        await attachScheduleContext(updated[0].id, context);
      }
      await commitManagerData(restaurantId, nextWeekStart, {
        schedules: updated,
        staff,
        manualScheduleCount,
      });
      const shiftCount = updated[0]?.items?.length || 0;
      setSelectedShift(null);
      setIsScheduleModalOpen(false);
      setStatus(`Draft generated with ${shiftCount} shift${shiftCount === 1 ? '' : 's'}. Tap any shift to edit it.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not generate draft.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveSelectedShift = async () => {
    if (!restaurantId || !selectedShift) return;
    if (!/^\d{2}:\d{2}$/.test(shiftForm.shift_start) || !/^\d{2}:\d{2}$/.test(shiftForm.shift_end)) {
      setStatus('Use HH:MM time for start and end.');
      return;
    }
    const normalizedRole = shiftForm.role.trim().toLowerCase();
    if (!STAFF_ROLES.includes(normalizedRole)) {
      setStatus('Choose one of the listed roles before saving.');
      return;
    }
    setIsSaving(true);
    setStatus(`Saving ${selectedShift.waiter_name || 'shift'}...`);
    try {
      await updateManagerScheduleItem(selectedShift.id, {
        role: normalizedRole,
        shift_start: shiftForm.shift_start,
        shift_end: shiftForm.shift_end,
        is_manual_override: true,
      });
      const updated = await fetchManagerSchedules(restaurantId, visibleWeekStart);
      await commitManagerData(restaurantId, visibleWeekStart, {
        schedules: updated,
        staff,
        manualScheduleCount,
      });
      setSelectedShift(null);
      setStatus('Shift saved. The generated draft now includes your edit.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save shift.');
    } finally {
      setIsSaving(false);
    }
  };

  const addManualShift = async () => {
    if (!restaurantId || !activeSchedule?.id) {
      setStatus('Create a manual draft before adding shifts.');
      return;
    }
    if (!newShiftForm.waiter_id) {
      setStatus('Choose an employee before adding a shift.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(newShiftForm.shift_start) || !/^\d{2}:\d{2}$/.test(newShiftForm.shift_end)) {
      setStatus('Use HH:MM time for the new shift.');
      return;
    }
    const normalizedRole = newShiftForm.role.trim().toLowerCase();
    if (!STAFF_ROLES.includes(normalizedRole)) {
      setStatus('Choose one of the listed roles before adding a shift.');
      return;
    }
    setIsSaving(true);
    setStatus('Adding manual shift...');
    try {
      await createManagerScheduleItem(activeSchedule.id, {
        waiter_id: newShiftForm.waiter_id,
        role: normalizedRole,
        shift_date: selectedDate,
        shift_start: newShiftForm.shift_start,
        shift_end: newShiftForm.shift_end,
        source: 'manual',
      });
      const updated = await fetchManagerSchedules(restaurantId, visibleWeekStart);
      await commitManagerData(restaurantId, visibleWeekStart, {
        schedules: updated,
        staff,
        manualScheduleCount,
      });
      setIsAddShiftOpen(false);
      setStatus('Manual shift added.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not add shift.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenShell>
      <PageHeader
        eyebrow={restaurant?.name || 'Owner'}
        title="Schedule"
        subtitle="Build, generate, and edit this week's staff schedule."
        action={<IconButton name="plus" label="Start this week's schedule" accent onPress={() => setIsScheduleModalOpen(true)} />}
      />
      {status ? (
        <View style={styles.statusCard}>
          <UiText variant="bodySmall" tone="muted">{status}</UiText>
        </View>
      ) : null}

      {isLoading && (
        <View style={styles.stateCard}>
          <UiText variant="bodySmall" tone="muted">Loading manager schedule...</UiText>
        </View>
      )}
      {error && (
        <View style={styles.stateCard}>
          <UiText variant="title">Manager schedule unavailable</UiText>
          <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>{error}</UiText>
        </View>
      )}

      {!isLoading && !error && (
        <>
          <LocationFilterRow location={restaurant?.name || 'Restaurant'} />
          <WeekStrip weekStart={visibleWeekStart} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View>
                  <UiText variant="eyebrow" tone="muted">Generated week</UiText>
                  <UiText variant="title" style={styles.summaryTitle}>{visibleWeekStart}</UiText>
                </View>
                <UiText variant="caption" tone="muted">{activeSchedule?.status || 'No draft'}</UiText>
              </View>
              <View style={styles.summaryStats}>
                <View>
                  <UiText variant="metricSmall" style={styles.summaryMetric}>{scheduleItems.length}</UiText>
                  <UiText variant="bodySmall" tone="muted">week shifts</UiText>
                </View>
                <View>
                  <UiText variant="metricSmall" style={styles.summaryMetric}>{selectedDayShifts.length}</UiText>
                  <UiText variant="bodySmall" tone="muted">{selectedDayLabel}</UiText>
                </View>
                <View>
                  <UiText variant="metricSmall" style={styles.summaryMetric}>{totalHours.toFixed(1)}</UiText>
                  <UiText variant="bodySmall" tone="muted">week hours</UiText>
                </View>
              </View>
              <UiText variant="bodySmall" tone="muted" style={styles.summaryHelp}>
                Generate creates a draft for this week. Tap a shift below, adjust role or time, then save it back to the backend.
              </UiText>
              <View style={styles.summaryActions}>
                <UiButton label={isSaving ? 'Working...' : 'Start / generate'} disabled={isSaving || !restaurantId} onPress={() => setIsScheduleModalOpen(true)} style={styles.actionButton} />
                <UiButton label="Add shift" variant="secondary" disabled={!activeSchedule?.id || isSaving} onPress={() => setIsAddShiftOpen((open) => !open)} style={styles.actionButton} />
              </View>
            </View>
            {isAddShiftOpen && activeSchedule?.id && (
              <View style={styles.editorCard}>
                <View style={styles.editorHeader}>
                  <View>
                    <UiText variant="eyebrow" tone="muted">Manual shift</UiText>
                    <UiText variant="title">{selectedDate}</UiText>
                  </View>
                  <Pressable onPress={() => setIsAddShiftOpen(false)} style={styles.closeButton}>
                    <UiText variant="caption" style={styles.closeText}>Close</UiText>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.staffPicker}>
                  {staff.map((member) => {
                    const active = newShiftForm.waiter_id === member.id;
                    return (
                      <Pressable
                        key={member.id}
                        onPress={() => setNewShiftForm((prev) => ({ ...prev, waiter_id: member.id, role: member.role || prev.role }))}
                        style={[styles.staffChip, active && styles.staffChipActive]}
                      >
                        <UiText variant="caption" style={[styles.staffChipText, active && styles.staffChipTextActive]} numberOfLines={1}>
                          {member.name || 'Staff'}
                        </UiText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={styles.rolePicker}>
                  {STAFF_ROLES.map((role) => {
                    const active = newShiftForm.role.toLowerCase() === role;
                    return (
                      <Pressable
                        key={role}
                        onPress={() => setNewShiftForm((prev) => ({ ...prev, role }))}
                        style={[styles.roleChip, active && styles.roleChipActive]}
                      >
                        <UiText variant="caption" style={[styles.roleChipText, active && styles.roleChipTextActive]}>
                          {role}
                        </UiText>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.timeFields}>
                  <TextField value={newShiftForm.shift_start} onChangeText={(value) => setNewShiftForm((prev) => ({ ...prev, shift_start: value }))} placeholder="Start HH:MM" />
                  <TextField value={newShiftForm.shift_end} onChangeText={(value) => setNewShiftForm((prev) => ({ ...prev, shift_end: value }))} placeholder="End HH:MM" />
                </View>
                <UiButton label={isSaving ? 'Adding...' : 'Add to selected day'} disabled={isSaving || staff.length === 0} onPress={addManualShift} />
              </View>
            )}
            {weekDates.map((dateKey) => (
              <DayScheduleSection
                key={dateKey}
                dateKey={dateKey}
                shifts={shiftsByDate[dateKey] || []}
                showPerson
                onShiftPress={setSelectedShift}
              />
            ))}
          </ScrollView>
        </>
      )}

      <Modal
        animationType="fade"
        transparent
        visible={isScheduleModalOpen}
        onRequestClose={() => setIsScheduleModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.scheduleModal}>
            <View style={styles.editorHeader}>
              <View>
                <UiText variant="eyebrow" tone="muted">This week</UiText>
                <UiText variant="title">Start schedule</UiText>
              </View>
              <Pressable onPress={() => setIsScheduleModalOpen(false)} style={styles.closeButton}>
                <UiText variant="caption" style={styles.closeText}>Close</UiText>
              </Pressable>
            </View>

            <TextField
              value={scheduleContext}
              onChangeText={setScheduleContext}
              placeholder="Context for this week, e.g. busier for 4th of July"
              multiline
            />
            <UiText variant="caption" tone="muted">
              Saved onto the draft summary. The deployed AI endpoint does not accept this note directly yet.
            </UiText>

            <Pressable
              disabled={isSaving}
              onPress={startManualSchedule}
              style={styles.scheduleOption}
            >
              <View style={{ flex: 1 }}>
                <UiText variant="title">Generate manually</UiText>
                <UiText variant="bodySmall" tone="muted" style={styles.optionCopy}>
                  Create or open this week as a manual draft, then tap shifts to edit it.
                </UiText>
              </View>
              <UiText variant="caption" style={styles.optionAction}>Start</UiText>
            </Pressable>

            <Pressable
              disabled={!canAutoGenerate || isSaving}
              onPress={() => generateDraft(scheduleContext)}
              style={[styles.scheduleOption, !canAutoGenerate && styles.scheduleOptionLocked]}
            >
              <View style={{ flex: 1 }}>
                <UiText variant="title">Auto generate with AI</UiText>
                <UiText variant="bodySmall" tone="muted" style={styles.optionCopy}>
                  {canAutoGenerate
                    ? 'Use your scheduling history to create a fresh AI draft.'
                    : `${manualSchedulesRemaining} more manual schedule${manualSchedulesRemaining === 1 ? '' : 's'} required before auto generation unlocks.`}
                </UiText>
              </View>
              <UiText variant="caption" style={styles.optionAction}>
                {canAutoGenerate ? 'Run' : `${manualScheduleCount}/${AUTO_GENERATE_MANUAL_THRESHOLD}`}
              </UiText>
              {!canAutoGenerate && <View pointerEvents="none" style={styles.lockedSheen} />}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={selectedShift !== null}
        onRequestClose={() => setSelectedShift(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.scheduleModal}>
            <View style={styles.editorHeader}>
              <View>
                <UiText variant="eyebrow" tone="muted">Editing shift</UiText>
                <UiText variant="title">{selectedShift?.waiter_name || 'Assigned staff'}</UiText>
              </View>
              <Pressable onPress={() => setSelectedShift(null)} style={styles.closeButton}>
                <UiText variant="caption" style={styles.closeText}>Close</UiText>
              </Pressable>
            </View>
            <View style={styles.rolePicker}>
              {STAFF_ROLES.map((role) => {
                const active = shiftForm.role.toLowerCase() === role;
                return (
                  <Pressable
                    key={role}
                    onPress={() => setShiftForm((prev) => ({ ...prev, role }))}
                    style={[styles.roleChip, active && styles.roleChipActive]}
                  >
                    <UiText variant="caption" style={[styles.roleChipText, active && styles.roleChipTextActive]}>
                      {role}
                    </UiText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.timeFields}>
              <TextField value={shiftForm.shift_start} onChangeText={(value) => setShiftForm((prev) => ({ ...prev, shift_start: value }))} placeholder="Start HH:MM" />
              <TextField value={shiftForm.shift_end} onChangeText={(value) => setShiftForm((prev) => ({ ...prev, shift_end: value }))} placeholder="End HH:MM" />
            </View>
            <UiButton label={isSaving ? 'Saving...' : 'Save shift'} disabled={isSaving} onPress={saveSelectedShift} />
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
    padding: spacing[5],
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
  statusCard: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing[5],
    marginTop: spacing[3],
    padding: spacing[3],
  },
  summaryCard: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[4],
  },
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryTitle: {
    marginTop: spacing[1],
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[4],
  },
  summaryMetric: {
    color: palette.ink[900],
    marginTop: spacing[2],
  },
  summaryHelp: {
    marginTop: spacing[4],
  },
  summaryActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  actionButton: {
    flex: 1,
  },
  editorCard: {
    backgroundColor: semanticColors.elevated,
    borderColor: opsAccent,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[4],
  },
  editorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  closeButton: {
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  closeText: {
    color: palette.ink[500],
  },
  rolePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  roleChip: {
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  roleChipActive: {
    backgroundColor: opsAccent,
    borderColor: opsAccent,
  },
  roleChipText: {
    color: palette.ink[500],
    textTransform: 'capitalize',
  },
  roleChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  staffPicker: {
    gap: spacing[2],
    paddingRight: spacing[2],
  },
  staffChip: {
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: 150,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  staffChipActive: {
    backgroundColor: palette.ink[900],
    borderColor: palette.ink[900],
  },
  staffChipText: {
    color: palette.ink[500],
  },
  staffChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  timeFields: {
    gap: spacing[3],
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(20, 18, 16, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing[5],
  },
  scheduleModal: {
    backgroundColor: semanticColors.elevated,
    borderRadius: radius.lg,
    gap: spacing[4],
    maxWidth: 520,
    padding: spacing[4],
    width: '100%',
  },
  scheduleOption: {
    alignItems: 'center',
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    overflow: 'hidden',
    padding: spacing[4],
  },
  scheduleOptionLocked: {
    opacity: 0.58,
  },
  optionCopy: {
    marginTop: spacing[1],
  },
  optionAction: {
    color: opsAccent,
    fontFamily: 'Inter_700Bold',
  },
  lockedSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.36)',
  },
});
