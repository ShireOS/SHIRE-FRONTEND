import {
  createManagerAnnouncement,
  fetchManagerAnnouncements,
  fetchManagerConversations,
  fetchManagerRequests,
  fetchManagerSchedules,
  reviewManagerRequest,
  runManagerScheduler,
  type Announcement,
  type Conversation,
  type EmployeeRequest,
  type EmployeeShift,
  type ManagerSchedule as ManagerSchedulePayload,
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
  startOfWeek,
  toDateKey,
} from '@/components/scheduling/ScheduleKit';
import { UiButton } from '@/components/ui/Button';
import { UiText } from '@/components/ui/Text';
import { palette, semanticColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { getOwnerRestaurant, type OwnerRestaurant } from '../../packages/supabase';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

type ManagerTab = 'schedule' | 'requests' | 'messages' | 'config';

export default function ManagerSchedule() {
  const [restaurant, setRestaurant] = useState<OwnerRestaurant | null>(null);
  const [tab, setTab] = useState<ManagerTab>('schedule');
  const [weekStart, setWeekStart] = useState(() => toDateKey(startOfWeek()));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [schedules, setSchedules] = useState<ManagerSchedulePayload[]>([]);
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const restaurantId = restaurant?.id;

  const loadManagerData = useCallback(async (id: string) => {
    const [scheduleData, requestData, conversationData, announcementData] = await Promise.all([
      fetchManagerSchedules(id, weekStart),
      fetchManagerRequests(id),
      fetchManagerConversations(id),
      fetchManagerAnnouncements(id),
    ]);
    setSchedules(scheduleData);
    setRequests(requestData);
    setConversations(conversationData);
    setAnnouncements(announcementData);
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
  const weekDates = Array.from({ length: 7 }, (_, index) => toDateKey(addDays(weekStart, index)));
  const selectedDayShifts = shiftsByDate[selectedDate] || [];

  const generateDraft = async () => {
    if (!restaurantId) return;
    setIsSaving(true);
    setStatus('Generating draft schedule...');
    try {
      await runManagerScheduler(restaurantId, weekStart);
      const updated = await fetchManagerSchedules(restaurantId, weekStart);
      setSchedules(updated);
      setStatus('Draft schedule generated.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not generate draft.');
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

  const moveWeek = (direction: number) => {
    const next = toDateKey(addDays(weekStart, direction * 7));
    setWeekStart(next);
    setSelectedDate(next);
  };

  return (
    <ScreenShell>
      <PageHeader
        eyebrow={restaurant?.name || 'Owner'}
        title="Schedule"
        subtitle="Draft generation, employee requests, staff messages, and mobile controls."
        action={<IconButton name="plus" label="Generate draft schedule" accent onPress={generateDraft} />}
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

      {isLoading && (
        <View style={styles.stateCard}>
          <ActivityIndicator color={palette.sky[700]} />
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
          <View style={styles.monthControls}>
            <IconButton name="chevron-left" label="Previous week" onPress={() => moveWeek(-1)} />
            <UiText variant="caption" tone="muted">{activeSchedule?.status || 'No draft'} · {weekStart}</UiText>
            <IconButton name="chevron-right" label="Next week" onPress={() => moveWeek(1)} />
          </View>
          <LocationFilterRow location={restaurant?.name || 'Restaurant'} />
          <WeekStrip weekStart={weekStart} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.summaryCard}>
              <UiText variant="eyebrow" tone="muted">Visible day</UiText>
              <UiText variant="metricSmall" style={styles.summaryMetric}>{selectedDayShifts.length}</UiText>
              <UiText variant="bodySmall" tone="muted">posted shift{selectedDayShifts.length === 1 ? '' : 's'}</UiText>
              <UiButton label="Generate draft" disabled={isSaving || !restaurantId} onPress={generateDraft} style={styles.generateButton} />
            </View>
            {weekDates.map((dateKey) => (
              <DayScheduleSection
                key={dateKey}
                dateKey={dateKey}
                shifts={shiftsByDate[dateKey] || []}
                showPerson
              />
            ))}
          </ScrollView>
        </>
      )}

      {!isLoading && !error && tab === 'requests' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {requests.length === 0 ? (
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
          <View style={styles.formCard}>
            <UiText variant="title">Post announcement</UiText>
            <TextField value={announcementTitle} onChangeText={setAnnouncementTitle} placeholder="Title" />
            <TextField value={announcementBody} onChangeText={setAnnouncementBody} placeholder="Message" multiline />
            <UiButton label="Post to team" disabled={isSaving || !announcementTitle.trim() || !announcementBody.trim()} onPress={postAnnouncement} />
          </View>
          <View style={styles.listGap}>
            {conversations.map((conversation) => <ConversationRow key={conversation.id} conversation={conversation} />)}
            {announcements.map((announcement) => <AnnouncementCard key={announcement.id} announcement={announcement} />)}
          </View>
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
  summaryCard: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[4],
  },
  summaryMetric: {
    color: palette.ink[900],
    marginTop: spacing[2],
  },
  generateButton: {
    marginTop: spacing[4],
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
});
