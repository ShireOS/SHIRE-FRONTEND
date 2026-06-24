import {
  copyManagerSchedule,
  createManagerSchedule,
  createManagerScheduleItem,
  deleteManagerScheduleItem,
  fetchManagerScheduleHistory,
  fetchManagerSchedules,
  fetchManagerStaff,
  publishManagerSchedule,
  runManagerScheduler,
  updateManagerScheduleItem,
  updateManagerScheduleSummary,
  type EmployeeShift,
  type ManagerSchedule as ManagerSchedulePayload,
  type StaffContact,
} from '@/api/employeeOps';
import {
  fetchManagerTimeClockRequests,
  reviewTimeClockRequest,
  type TimeClockRequest,
} from '@/api/timeClock';
import { Feather } from '@expo/vector-icons';
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
  opsTeal,
  shiftHours,
  startOfWeek,
  toDateKey,
} from '@/components/scheduling/ScheduleKit';
import { UiButton } from '@/components/ui/Button';
import { UiText } from '@/components/ui/Text';
import { staleWhileRevalidate, writeCacheRecord } from '@/cache/staleWhileRevalidate';
import { registerManagerPushToken } from '@/notifications/pushNotifications';
import { palette, semanticColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { getOwnerRestaurant, type OwnerRestaurant } from '../../packages/supabase';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

const STAFF_ROLES = ['manager', 'server', 'bartender', 'host', 'busser', 'runner', 'chef'];
const AUTO_GENERATE_MANUAL_THRESHOLD = 4;
const SCHEDULE_CACHE_TTL_MS = 30_000;
const SCHEDULE_CACHE_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

type ManagerScheduleCacheData = {
  schedules: ManagerSchedulePayload[];
  scheduleHistory: ManagerSchedulePayload[];
  staff: StaffContact[];
  timeClockRequests: TimeClockRequest[];
  manualScheduleCount: number;
};

export default function ManagerSchedule() {
  const [restaurant, setRestaurant] = useState<OwnerRestaurant | null>(null);
  const [weekStart, setWeekStart] = useState(() => toDateKey(startOfWeek()));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [schedules, setSchedules] = useState<ManagerSchedulePayload[]>([]);
  const [scheduleHistory, setScheduleHistory] = useState<ManagerSchedulePayload[]>([]);
  const [staff, setStaff] = useState<StaffContact[]>([]);
  const [timeClockRequests, setTimeClockRequests] = useState<TimeClockRequest[]>([]);
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
  const timeClockRequestsRef = useRef<TimeClockRequest[]>([]);
  const manualScheduleCountRef = useRef(0);

  const restaurantId = restaurant?.id;

  const applyCachedData = useCallback((data: ManagerScheduleCacheData) => {
    const safeStaff = data.staff ?? [];
    const safeRequests = data.timeClockRequests ?? [];
    setSchedules(data.schedules ?? []);
    setScheduleHistory(data.scheduleHistory ?? []);
    setStaff(safeStaff);
    setTimeClockRequests(safeRequests);
    setManualScheduleCount(data.manualScheduleCount ?? 0);
    staffRef.current = safeStaff;
    timeClockRequestsRef.current = safeRequests;
    manualScheduleCountRef.current = data.manualScheduleCount ?? 0;
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

  const refreshManagerData = useCallback(async (id: string, targetWeekStart = weekStart): Promise<ManagerScheduleCacheData> => {
    const scheduleData = await fetchManagerSchedules(id, targetWeekStart);
    const optionalResults = await Promise.allSettled([
      fetchManagerScheduleHistory(id),
      fetchManagerStaff(id),
      fetchManagerTimeClockRequests(id, 'pending'),
    ]);
    const [historyResult, staffResult, requestsResult] = optionalResults;
    const history = historyResult.status === 'fulfilled' ? historyResult.value : scheduleHistory;
    const nextData = {
      schedules: scheduleData,
      scheduleHistory: history,
      staff: staffResult.status === 'fulfilled' ? staffResult.value : staffRef.current,
      timeClockRequests: requestsResult.status === 'fulfilled' ? requestsResult.value : timeClockRequestsRef.current,
      manualScheduleCount: historyResult.status === 'fulfilled'
        ? history.filter((schedule) => schedule.generated_by === 'manual').length
        : manualScheduleCountRef.current,
    };
    await persistScheduleCache(id, targetWeekStart, nextData);
    return nextData;
  }, [persistScheduleCache, scheduleHistory, weekStart]);

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
        if (ownerRestaurant?.id) {
          registerManagerPushToken(ownerRestaurant.id).catch(() => undefined);
          await loadManagerData(ownerRestaurant.id);
        }
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
  const activeScheduleStatus = activeSchedule?.status || 'No draft';
  const isPublished = activeSchedule?.status === 'published';
  const isDraft = activeSchedule?.status === 'draft';
  const lastSourceSchedule = useMemo(() => {
    const candidates = scheduleHistory
      .filter((schedule) => schedule.id !== activeSchedule?.id)
      .filter((schedule) => String(schedule.week_start_date || '').slice(0, 10) !== String(visibleWeekStart).slice(0, 10))
      .filter((schedule) => schedule.status === 'published' || schedule.status === 'draft')
      .filter((schedule) => (schedule.items?.length || 0) > 0);
    return candidates.find((schedule) => schedule.status === 'published') || candidates[0] || null;
  }, [activeSchedule?.id, scheduleHistory, visibleWeekStart]);
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

  const refreshAndApply = async (targetWeekStart = visibleWeekStart) => {
    if (!restaurantId) return null;
    const nextData = await refreshManagerData(restaurantId, targetWeekStart);
    applyCachedData(nextData);
    return nextData;
  };

  const startCopiedSchedule = async () => {
    if (!restaurantId) return;
    setIsSaving(true);
    setStatus(activeSchedule ? 'Opening this draft.' : 'Starting from the last schedule.');
    try {
      if (activeSchedule) {
        if (activeSchedule.id) await attachScheduleContext(activeSchedule.id, scheduleContext);
        const refreshed = await refreshAndApply(visibleWeekStart);
        const shiftCount = refreshed?.schedules[0]?.items?.length || scheduleItems.length;
        setIsScheduleModalOpen(false);
        setStatus(`This week already has ${shiftCount} shift${shiftCount === 1 ? '' : 's'} in ${activeScheduleStatus.toLowerCase()}. Edit, add shifts, or publish from here.`);
        return;
      }

      let copiedSchedule: ManagerSchedulePayload | null = null;
      let copyFailed = false;
      if (lastSourceSchedule) {
        try {
          copiedSchedule = await copyManagerSchedule(restaurantId, {
            source_schedule_id: lastSourceSchedule.id,
            target_week_start: visibleWeekStart,
            force_replace: false,
          });
        } catch {
          copyFailed = true;
          copiedSchedule = null;
        }
      }

      let schedule = copiedSchedule;
      if (!schedule) schedule = await createManagerSchedule(restaurantId, visibleWeekStart);
      if (schedule?.id) {
        await attachScheduleContext(schedule.id, scheduleContext);
      }
      const refreshed = await refreshAndApply(visibleWeekStart);
      const shiftCount = refreshed?.schedules[0]?.items?.length || schedule.items?.length || 0;
      const copiedFrom = copiedSchedule && lastSourceSchedule?.week_start_date
        ? ` Copied from ${String(lastSourceSchedule.week_start_date).slice(0, 10)}.`
        : copyFailed
          ? ' Could not copy the previous schedule yet, so a blank draft was created.'
          : ' No prior schedule was available, so a blank draft was created.';
      setIsScheduleModalOpen(false);
      setStatus(`${shiftCount} shift${shiftCount === 1 ? '' : 's'} ready for this week.${copiedFrom}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not start schedule.');
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
      await refreshAndApply(nextWeekStart);
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
      await refreshAndApply(visibleWeekStart);
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
      await refreshAndApply(visibleWeekStart);
      setIsAddShiftOpen(false);
      setStatus('Manual shift added.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not add shift.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSelectedShift = () => {
    if (!restaurantId || !selectedShift) return;
    Alert.alert(
      'Delete shift?',
      `${selectedShift.waiter_name || 'This shift'} will be removed from the draft.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsSaving(true);
            setStatus('Deleting shift...');
            try {
              await deleteManagerScheduleItem(selectedShift.id);
              await refreshAndApply(visibleWeekStart);
              setSelectedShift(null);
              setStatus('Shift deleted.');
            } catch (err) {
              setStatus(err instanceof Error ? err.message : 'Could not delete shift.');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  };

  const publishSchedule = () => {
    if (!restaurantId || !activeSchedule?.id) return;
    Alert.alert(
      'Publish schedule?',
      'Employees will see this week as the posted schedule.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: async () => {
            setIsSaving(true);
            setStatus('Publishing schedule...');
            try {
              await publishManagerSchedule(activeSchedule.id);
              await refreshAndApply(visibleWeekStart);
              setStatus('Schedule published for the team.');
            } catch (err) {
              setStatus(err instanceof Error ? err.message : 'Could not publish schedule.');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  };

  const reviewRemoteTimeRequest = async (request: TimeClockRequest, nextStatus: 'approved' | 'denied') => {
    const requestId = request.request_id || request.id;
    setIsSaving(true);
    setStatus(nextStatus === 'approved' ? 'Approving remote time...' : 'Denying remote time...');
    setTimeClockRequests((current) => current.filter((item) => (item.request_id || item.id) !== requestId));
    try {
      await reviewTimeClockRequest(requestId, nextStatus);
      const refreshed = restaurantId ? await fetchManagerTimeClockRequests(restaurantId, 'pending') : [];
      setTimeClockRequests(refreshed);
      timeClockRequestsRef.current = refreshed;
      setStatus(nextStatus === 'approved' ? 'Remote time approved.' : 'Remote time denied and voided.');
    } catch (err) {
      if (restaurantId) {
        fetchManagerTimeClockRequests(restaurantId, 'pending')
          .then((items) => {
            setTimeClockRequests(items);
            timeClockRequestsRef.current = items;
          })
          .catch(() => setTimeClockRequests((current) => [request, ...current]));
      }
      setStatus(err instanceof Error ? err.message : 'Could not review remote time.');
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
                  <UiText variant="eyebrow" tone="muted">{activeSchedule ? 'Schedule draft' : 'No schedule yet'}</UiText>
                  <UiText variant="title" style={styles.summaryTitle}>{visibleWeekStart}</UiText>
                </View>
                <View style={[styles.statusPill, isPublished && styles.statusPillPublished]}>
                  <UiText variant="caption" style={[styles.statusPillText, isPublished && styles.statusPillTextPublished]}>
                    {activeScheduleStatus}
                  </UiText>
                </View>
              </View>
              <View style={styles.summaryStats}>
                <View style={styles.summaryStat}>
                  <UiText variant="metricSmall" style={styles.summaryMetric}>{scheduleItems.length}</UiText>
                  <UiText variant="bodySmall" tone="muted">week shifts</UiText>
                </View>
                <View style={styles.summaryStat}>
                  <UiText variant="metricSmall" style={styles.summaryMetric}>{selectedDayShifts.length}</UiText>
                  <UiText variant="bodySmall" tone="muted">{selectedDayLabel}</UiText>
                </View>
                <View style={styles.summaryStat}>
                  <UiText variant="metricSmall" style={styles.summaryMetric}>{totalHours.toFixed(1)}</UiText>
                  <UiText variant="bodySmall" tone="muted">week hours</UiText>
                </View>
              </View>
              <View style={styles.workflowRail}>
                <View style={[styles.workflowStep, activeSchedule && styles.workflowStepDone]}>
                  <Feather name="copy" size={14} color={activeSchedule ? '#FFFFFF' : palette.ink[500]} />
                </View>
                <View style={styles.workflowLine} />
                <View style={[styles.workflowStep, scheduleItems.length > 0 && styles.workflowStepDone]}>
                  <Feather name="edit-3" size={14} color={scheduleItems.length > 0 ? '#FFFFFF' : palette.ink[500]} />
                </View>
                <View style={styles.workflowLine} />
                <View style={[styles.workflowStep, isPublished && styles.workflowStepDone]}>
                  <Feather name="send" size={14} color={isPublished ? '#FFFFFF' : palette.ink[500]} />
                </View>
              </View>
              <UiText variant="bodySmall" tone="muted" style={styles.summaryHelp}>
                Start from a recent schedule, tune shifts on the selected day, then publish when this week is ready.
              </UiText>
              <View style={styles.summaryActions}>
                <UiButton label={isSaving ? 'Working...' : activeSchedule ? 'Open tools' : 'Start from last'} disabled={isSaving || !restaurantId} onPress={() => setIsScheduleModalOpen(true)} style={styles.actionButton} />
                <UiButton label="Add shift" variant="secondary" disabled={!activeSchedule?.id || isSaving} onPress={() => setIsAddShiftOpen((open) => !open)} style={styles.actionButton} />
              </View>
              <UiButton
                label={isPublished ? 'Published' : 'Publish schedule'}
                variant={isPublished ? 'secondary' : 'primary'}
                disabled={!activeSchedule?.id || !isDraft || isSaving}
                onPress={publishSchedule}
                style={styles.publishButton}
              />
            </View>
            {timeClockRequests.length > 0 && (
              <View style={styles.remoteQueueCard}>
                <View style={styles.remoteQueueHeader}>
                  <View style={{ flex: 1 }}>
                    <UiText variant="eyebrow" tone="muted">Admin alerts</UiText>
                    <UiText variant="title" style={styles.remoteQueueTitle}>
                      {timeClockRequests.length} remote time request{timeClockRequests.length === 1 ? '' : 's'}
                    </UiText>
                  </View>
                  <Feather name="bell" size={20} color={palette.sky[700]} />
                </View>
                {timeClockRequests.map((request) => (
                  <RemoteTimeRequestRow
                    key={request.request_id || request.id}
                    request={request}
                    disabled={isSaving}
                    onApprove={() => reviewRemoteTimeRequest(request, 'approved')}
                    onDeny={() => reviewRemoteTimeRequest(request, 'denied')}
                  />
                ))}
              </View>
            )}
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
                <UiText variant="title">Schedule tools</UiText>
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
              onPress={startCopiedSchedule}
              style={[styles.scheduleOption, styles.scheduleOptionPrimary]}
            >
              <View style={styles.optionIcon}>
                <Feather name={activeSchedule ? 'calendar' : 'copy'} size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <UiText variant="title">{activeSchedule ? 'Open current draft' : 'Start from last schedule'}</UiText>
                <UiText variant="bodySmall" tone="muted" style={styles.optionCopy}>
                  {activeSchedule
                    ? `${scheduleItems.length} shift${scheduleItems.length === 1 ? '' : 's'} are ready to edit for this week.`
                    : lastSourceSchedule
                      ? `Copy ${String(lastSourceSchedule.week_start_date).slice(0, 10)} into this week.`
                      : 'No previous schedule found yet; this creates a blank draft.'}
                </UiText>
              </View>
              <UiText variant="caption" style={styles.optionAction}>Start</UiText>
            </Pressable>

            <Pressable
              disabled={!canAutoGenerate || isSaving}
              onPress={() => generateDraft(scheduleContext)}
              style={[styles.scheduleOption, !canAutoGenerate && styles.scheduleOptionLocked]}
            >
              <View style={[styles.optionIcon, styles.aiOptionIcon]}>
                <Feather name="zap" size={18} color="#FFFFFF" />
              </View>
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
            <View style={styles.shiftModalActions}>
              <UiButton label={isSaving ? 'Saving...' : 'Save shift'} disabled={isSaving || isPublished} onPress={saveSelectedShift} style={styles.actionButton} />
              <UiButton label="Delete" variant="danger" disabled={isSaving || isPublished} onPress={deleteSelectedShift} style={styles.actionButton} />
            </View>
            {isPublished ? (
              <UiText variant="caption" tone="muted">
                Published schedules are locked. Create a new draft before editing this shift.
              </UiText>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

function RemoteTimeRequestRow({
  request,
  disabled,
  onApprove,
  onDeny,
}: {
  request: TimeClockRequest;
  disabled?: boolean;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const payload = request.structured_payload || {};
  const reason = payload.reason || request.notes || 'No reason provided';
  const type = String(request.request_type || 'remote_time').replaceAll('_', ' ');
  const start = request.start_time || payload.manual_start_time || payload.requested_clock_in_at;
  const end = request.end_time || payload.manual_end_time || payload.requested_clock_out_at;
  const date = request.start_date || payload.manual_entry_date || request.submitted_at;

  return (
    <View style={styles.remoteRequestRow}>
      <View style={styles.remoteRequestTop}>
        <View style={{ flex: 1 }}>
          <UiText variant="body" style={styles.remoteRequestName}>
            {request.waiter_name || 'Employee'}
          </UiText>
          <UiText variant="caption" tone="muted" style={styles.remoteRequestType}>
            {type}
          </UiText>
        </View>
        {request.mentioned_manager_name ? (
          <View style={styles.mentionPill}>
            <UiText variant="caption" style={styles.mentionPillText}>@ {request.mentioned_manager_name}</UiText>
          </View>
        ) : null}
      </View>
      <UiText variant="bodySmall" tone="muted" style={styles.remoteReason}>{String(reason)}</UiText>
      <UiText variant="caption" tone="muted">
        {[date ? String(date).slice(0, 10) : null, start ? String(start).slice(0, 5) : null, end ? String(end).slice(0, 5) : null]
          .filter(Boolean)
          .join(' · ') || 'No time attached'}
      </UiText>
      <View style={styles.remoteActions}>
        <UiButton label="Approve" disabled={disabled} size="small" onPress={onApprove} style={styles.remoteActionButton} />
        <UiButton label="Deny" disabled={disabled} size="small" variant="secondary" onPress={onDeny} style={styles.remoteActionButton} />
      </View>
    </View>
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
  statusPill: {
    backgroundColor: palette.sky[50],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  statusPillPublished: {
    backgroundColor: palette.ink[900],
  },
  statusPillText: {
    color: palette.sky[700],
    fontFamily: 'Inter_700Bold',
    textTransform: 'capitalize',
  },
  statusPillTextPublished: {
    color: '#FFFFFF',
  },
  summaryTitle: {
    marginTop: spacing[1],
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[4],
  },
  summaryStat: {
    minWidth: 88,
  },
  summaryMetric: {
    color: palette.ink[900],
    marginTop: spacing[2],
  },
  workflowRail: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: spacing[5],
  },
  workflowStep: {
    alignItems: 'center',
    backgroundColor: palette.ink[100],
    borderRadius: radius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  workflowStepDone: {
    backgroundColor: opsTeal,
  },
  workflowLine: {
    backgroundColor: palette.ink[100],
    flex: 1,
    height: 2,
    marginHorizontal: spacing[2],
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
  publishButton: {
    marginTop: spacing[3],
  },
  remoteQueueCard: {
    backgroundColor: palette.sky[50],
    borderColor: palette.sky[200],
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[4],
  },
  remoteQueueHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
  },
  remoteQueueTitle: {
    color: palette.ink[900],
    marginTop: spacing[1],
  },
  remoteRequestRow: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[2],
    padding: spacing[3],
  },
  remoteRequestTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing[2],
  },
  remoteRequestName: {
    color: palette.ink[900],
    fontFamily: 'Inter_700Bold',
  },
  remoteRequestType: {
    textTransform: 'capitalize',
  },
  mentionPill: {
    backgroundColor: palette.cream[100],
    borderColor: palette.sand[200],
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  mentionPillText: {
    color: palette.warmth[700],
  },
  remoteReason: {
    backgroundColor: semanticColors.surface,
    borderRadius: radius.sm,
    padding: spacing[2],
  },
  remoteActions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  remoteActionButton: {
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
  scheduleOptionPrimary: {
    backgroundColor: palette.sky[50],
    borderColor: palette.sky[200],
  },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: opsTeal,
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  aiOptionIcon: {
    backgroundColor: opsAccent,
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
  shiftModalActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
});
