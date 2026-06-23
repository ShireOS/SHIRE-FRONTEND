import {
  createManagerSchedule,
  createManagerScheduleItem,
  createManagerAnnouncement,
  fetchManagerAnnouncements,
  fetchManagerConversations,
  fetchManagerRequests,
  fetchManagerScheduleHistory,
  fetchManagerSchedules,
  fetchManagerStaff,
  reviewManagerRequest,
  runManagerScheduler,
  updateManagerScheduleItem,
  updateManagerScheduleSummary,
  type Announcement,
  type Conversation,
  type EmployeeRequest,
  type EmployeeShift,
  type ManagerSchedule as ManagerSchedulePayload,
  type StaffContact,
} from '@/api/employeeOps';
import {
  AnnouncementCard,
  ConversationRow,
  DayScheduleSection,
  IconButton,
  LocationFilterRow,
  PageHeader,
  RequestRow,
  ScreenShell,
  SegmentedControl,
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
import { palette, semanticColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { getOwnerRestaurant, type OwnerRestaurant } from '../../packages/supabase';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

type ManagerTab = 'schedule' | 'requests' | 'messages' | 'config';
const STAFF_ROLES = ['manager', 'server', 'bartender', 'host', 'busser', 'runner', 'chef'];
const emptyToolErrors = { requests: '', messages: '', announcements: '' };
const AUTO_GENERATE_MANUAL_THRESHOLD = 4;

export default function ManagerSchedule() {
  const [restaurant, setRestaurant] = useState<OwnerRestaurant | null>(null);
  const [tab, setTab] = useState<ManagerTab>('schedule');
  const [weekStart, setWeekStart] = useState(() => toDateKey(startOfWeek()));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [schedules, setSchedules] = useState<ManagerSchedulePayload[]>([]);
  const [staff, setStaff] = useState<StaffContact[]>([]);
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [auxiliaryError, setAuxiliaryError] = useState('');
  const [toolErrors, setToolErrors] = useState(emptyToolErrors);
  const [error, setError] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<EmployeeShift | null>(null);
  const [shiftForm, setShiftForm] = useState({ role: '', shift_start: '', shift_end: '' });
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [newShiftForm, setNewShiftForm] = useState({ waiter_id: '', role: 'server', shift_start: '17:00', shift_end: '21:00' });
  const [scheduleContext, setScheduleContext] = useState('');
  const [manualScheduleCount, setManualScheduleCount] = useState(0);

  const restaurantId = restaurant?.id;

  const loadManagerData = useCallback(async (id: string) => {
    setAuxiliaryError('');
    setToolErrors(emptyToolErrors);
    const scheduleData = await fetchManagerSchedules(id, weekStart);
    const optionalResults = await Promise.allSettled([
      fetchManagerRequests(id),
      fetchManagerConversations(id),
      fetchManagerAnnouncements(id),
      fetchManagerScheduleHistory(id),
      fetchManagerStaff(id),
    ]);
    const [requestResult, conversationResult, announcementResult, historyResult, staffResult] = optionalResults;
    const optionalFailures = optionalResults.slice(0, 3).filter((result) => result.status === 'rejected').length;

    setSchedules(scheduleData);
    setRequests(requestResult.status === 'fulfilled' ? requestResult.value : []);
    setConversations(conversationResult.status === 'fulfilled' ? conversationResult.value : []);
    setAnnouncements(announcementResult.status === 'fulfilled' ? announcementResult.value : []);
    setStaff(staffResult.status === 'fulfilled' ? staffResult.value : []);
    setToolErrors({
      requests: requestResult.status === 'rejected' ? getErrorMessage(requestResult.reason, 'Requests are unavailable.') : '',
      messages: conversationResult.status === 'rejected' ? getErrorMessage(conversationResult.reason, 'Messages are unavailable.') : '',
      announcements: announcementResult.status === 'rejected' ? getErrorMessage(announcementResult.reason, 'Announcements are unavailable.') : '',
    });
    if (historyResult.status === 'fulfilled') {
      setManualScheduleCount(historyResult.value.filter((schedule) => schedule.generated_by === 'manual').length);
    }
    if (optionalFailures > 0) {
      setAuxiliaryError(`${optionalFailures} manager tool${optionalFailures === 1 ? '' : 's'} did not load. Schedule editing is still available.`);
    }
  }, [weekStart]);

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
      if (!schedule) {
        schedule = await createManagerSchedule(restaurantId, visibleWeekStart);
        setManualScheduleCount((count) => count + 1);
      }
      if (schedule?.id) {
        await attachScheduleContext(schedule.id, scheduleContext);
      }
      const updated = await fetchManagerSchedules(restaurantId, visibleWeekStart);
      setSchedules(updated);
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
      setSchedules(updated);
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
      setSchedules(updated);
      setSelectedShift(null);
      setStatus('Shift saved. The generated draft now includes your edit.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save shift.');
    } finally {
      setIsSaving(false);
    }
  };

  const reviewRequest = async (requestId: string, nextStatus: 'approved' | 'denied') => {
    setStatus(nextStatus === 'approved' ? 'Approving request...' : 'Denying request...');
    try {
      await reviewManagerRequest(requestId, nextStatus);
      if (restaurantId) setRequests(await fetchManagerRequests(restaurantId));
      setStatus(nextStatus === 'approved' ? 'Request approved.' : 'Request denied.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not update request.');
    }
  };

  const postAnnouncement = async () => {
    if (!restaurantId || !announcementTitle.trim() || !announcementBody.trim()) return;
    if (toolErrors.announcements) {
      setStatus(toolErrors.announcements);
      return;
    }
    setIsSaving(true);
    setStatus('Posting announcement...');
    try {
      await createManagerAnnouncement(restaurantId, announcementTitle.trim(), announcementBody.trim());
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setAnnouncements(await fetchManagerAnnouncements(restaurantId));
      setStatus('Announcement posted.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not post announcement.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenShell>
      <PageHeader
        eyebrow={restaurant?.name || 'Owner'}
        title="Schedule"
        subtitle="Draft generation, employee requests, staff messages, and mobile controls."
        action={<IconButton name="plus" label="Start this week's schedule" accent onPress={() => setIsScheduleModalOpen(true)} />}
      />
      <SegmentedControl
        value={tab}
        options={[
          { id: 'schedule', label: 'Schedule' },
          { id: 'requests', label: 'Requests' },
          { id: 'messages', label: 'Messages' },
          { id: 'config', label: 'Config' },
        ]}
        onChange={setTab}
      />
      {status ? (
        <View style={styles.statusCard}>
          <UiText variant="bodySmall" tone="muted">{status}</UiText>
        </View>
      ) : null}
      {auxiliaryError ? (
        <View style={styles.noticeCard}>
          <UiText variant="bodySmall" tone="muted">{auxiliaryError}</UiText>
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

      {!isLoading && !error && tab === 'schedule' && (
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
                  <UiText variant="bodySmall" tone="muted">total shifts</UiText>
                </View>
                <View>
                  <UiText variant="metricSmall" style={styles.summaryMetric}>{selectedDayShifts.length}</UiText>
                  <UiText variant="bodySmall" tone="muted">selected day</UiText>
                </View>
                <View>
                  <UiText variant="metricSmall" style={styles.summaryMetric}>{totalHours.toFixed(1)}</UiText>
                  <UiText variant="bodySmall" tone="muted">hours</UiText>
                </View>
              </View>
              <UiText variant="bodySmall" tone="muted" style={styles.summaryHelp}>
                Generate creates a draft for this week. Tap a shift below, adjust role or time, then save it back to the backend.
              </UiText>
              <UiButton label={isSaving ? 'Working...' : 'Start / generate'} disabled={isSaving || !restaurantId} onPress={() => setIsScheduleModalOpen(true)} style={styles.generateButton} />
            </View>
            {selectedShift && (
              <View style={styles.editorCard}>
                <View style={styles.editorHeader}>
                  <View>
                    <UiText variant="eyebrow" tone="muted">Editing shift</UiText>
                    <UiText variant="title">{selectedShift.waiter_name || 'Assigned staff'}</UiText>
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

      {!isLoading && !error && tab === 'requests' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {toolErrors.requests ? (
            <View style={styles.stateCard}>
              <UiText variant="title">Requests unavailable</UiText>
              <UiText variant="bodySmall" tone="muted">{toolErrors.requests}</UiText>
            </View>
          ) : requests.length === 0 ? (
            <View style={styles.stateCard}>
              <UiText variant="bodySmall" tone="muted">No employee requests yet.</UiText>
            </View>
          ) : (
            requests.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                onApprove={() => reviewRequest(request.id, 'approved')}
                onDeny={() => reviewRequest(request.id, 'denied')}
              />
            ))
          )}
        </ScrollView>
      )}

      {!isLoading && !error && tab === 'messages' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {toolErrors.messages && toolErrors.announcements ? (
            <View style={styles.stateCard}>
              <UiText variant="title">Messages unavailable</UiText>
              <UiText variant="bodySmall" tone="muted">{toolErrors.messages}</UiText>
            </View>
          ) : (
            <>
              <View style={styles.formCard}>
                <UiText variant="title">Post announcement</UiText>
                {toolErrors.announcements ? (
                  <UiText variant="bodySmall" tone="muted">{toolErrors.announcements}</UiText>
                ) : (
                  <>
                    <TextField value={announcementTitle} onChangeText={setAnnouncementTitle} placeholder="Title" />
                    <TextField value={announcementBody} onChangeText={setAnnouncementBody} placeholder="Message" multiline />
                    <UiButton label="Post to team" disabled={isSaving || !announcementTitle.trim() || !announcementBody.trim()} onPress={postAnnouncement} />
                  </>
                )}
              </View>
              <View style={styles.listGap}>
                {toolErrors.messages ? (
                  <View style={styles.stateCard}>
                    <UiText variant="bodySmall" tone="muted">{toolErrors.messages}</UiText>
                  </View>
                ) : conversations.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} />)}
                {announcements.map((announcement) => <AnnouncementCard key={announcement.id} announcement={announcement} />)}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {!isLoading && !error && tab === 'config' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.formCard}>
            <UiText variant="title">Mobile manager controls</UiText>
            <UiText variant="bodySmall" tone="muted">
              Full drag scheduling stays on web. Mobile focuses on fast draft generation, day inspection, request review, announcements, and staff communication.
            </UiText>
          </View>
          <View style={styles.configGrid}>
            <ConfigTile label="Requests" value={String(requests.filter((request) => request.status === 'pending').length)} />
            <ConfigTile label="Chats" value={String(conversations.length)} />
            <ConfigTile label="Shifts" value={String(scheduleItems.length)} />
          </View>
        </ScrollView>
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
    </ScreenShell>
  );
}

function ConfigTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.configTile}>
      <UiText variant="eyebrow" tone="muted">{label}</UiText>
      <UiText variant="metricSmall" style={styles.summaryMetric}>{value}</UiText>
    </View>
  );
}

function getErrorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
    padding: spacing[5],
    paddingBottom: 120,
  },
  monthControls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
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
  noticeCard: {
    backgroundColor: palette.stone[50],
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing[5],
    marginTop: spacing[2],
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
  generateButton: {
    marginTop: spacing[4],
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
  timeFields: {
    gap: spacing[3],
  },
  formCard: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[4],
  },
  listGap: {
    gap: spacing[3],
  },
  configGrid: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  configTile: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    padding: spacing[3],
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
