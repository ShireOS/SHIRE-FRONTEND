import {
  createEmployeeShiftTrade,
  fetchEmployeeContacts,
  fetchEmployeeProfile,
  fetchEmployeeShiftTrades,
  fetchEmployeeWeekSchedule,
  respondEmployeeShiftTrade,
  type EmployeeProfile,
  type EmployeeShift,
  type ShiftTradeRequest,
  type StaffContact,
} from '@/api/employeeOps';
import {
  DayScheduleSection,
  IconButton,
  LocationFilterRow,
  PageHeader,
  ScreenShell,
  SegmentedControl,
  TextField,
  WeekStrip,
  addDays,
  formatTime,
  groupShiftsByDate,
  startOfWeek,
  toDateKey,
} from '@/components/scheduling/ScheduleKit';
import { UiButton } from '@/components/ui/Button';
import { UiText } from '@/components/ui/Text';
import { palette, semanticColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

type ScheduleScope = 'mine' | 'all';

export default function EmployeeSchedule() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [scope, setScope] = useState<ScheduleScope>('mine');
  const [weekStart, setWeekStart] = useState(() => toDateKey(startOfWeek()));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [mine, setMine] = useState<EmployeeShift[]>([]);
  const [all, setAll] = useState<EmployeeShift[]>([]);
  const [contacts, setContacts] = useState<StaffContact[]>([]);
  const [tradeRequests, setTradeRequests] = useState<ShiftTradeRequest[]>([]);
  const [selectedShift, setSelectedShift] = useState<EmployeeShift | null>(null);
  const [targetWaiterId, setTargetWaiterId] = useState('');
  const [tradeReason, setTradeReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      fetchEmployeeProfile(),
      fetchEmployeeWeekSchedule(weekStart, 'mine'),
      fetchEmployeeWeekSchedule(weekStart, 'all'),
      fetchEmployeeContacts(),
      fetchEmployeeShiftTrades(),
    ])
      .then(([profileData, mineData, allData, contactData, tradeData]) => {
        if (cancelled) return;
        setProfile(profileData);
        setMine(mineData.items || []);
        setAll(allData.items || []);
        setContacts(contactData);
        setTradeRequests(tradeData);
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
  const eligibleTargets = contacts.filter((contact) => !contact.is_me);
  const activeTradeRequests = tradeRequests.filter((trade) => (
    trade.status === 'pending_target' || trade.status === 'pending_manager'
  ));

  const moveWeek = (direction: number) => {
    const next = toDateKey(addDays(weekStart, direction * 7));
    setWeekStart(next);
    setSelectedDate(next);
  };

  const openTradeModal = (shift: EmployeeShift) => {
    setSelectedShift(shift);
    setTargetWaiterId((current) => current || eligibleTargets[0]?.id || '');
    setTradeReason('');
    setMessage('');
  };

  const submitTradeRequest = async () => {
    if (!selectedShift || !targetWaiterId) {
      setMessage('Choose a coworker before sending the trade.');
      return;
    }
    setIsSaving(true);
    setMessage('');
    try {
      const created = await createEmployeeShiftTrade(selectedShift.id, targetWaiterId, tradeReason);
      setTradeRequests((current) => [created, ...current]);
      setSelectedShift(null);
      setMessage('Shift trade sent for approval.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not send shift trade.');
    } finally {
      setIsSaving(false);
    }
  };

  const respondToTrade = async (trade: ShiftTradeRequest, status: 'approved' | 'denied' | 'cancelled') => {
    setIsSaving(true);
    setMessage(status === 'approved' ? 'Approving shift trade...' : 'Updating shift trade...');
    try {
      const updated = await respondEmployeeShiftTrade(trade.id, status);
      setTradeRequests((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(status === 'approved' ? 'Shift trade approved.' : 'Shift trade updated.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not update shift trade.');
    } finally {
      setIsSaving(false);
    }
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
          <UiText variant="bodySmall" tone="muted">Loading schedule...</UiText>
        </View>
      )}
      {error && (
        <View style={styles.stateCard}>
          <UiText variant="title">Schedule unavailable</UiText>
          <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>{error}</UiText>
        </View>
      )}
      {message ? (
        <View style={styles.messageCard}>
          <UiText variant="bodySmall" tone="muted">{message}</UiText>
        </View>
      ) : null}

      {!isLoading && !error && (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {activeTradeRequests.length > 0 ? (
            <View style={styles.approvalsCard}>
              <UiText variant="eyebrow" tone="muted">Shift Requests</UiText>
              <UiText variant="title" style={styles.approvalsTitle}>Trade approvals</UiText>
              {activeTradeRequests.map((trade) => (
                <EmployeeTradeRow
                  key={trade.id}
                  trade={trade}
                  currentWaiterId={profile?.waiter_id || profile?.id}
                  disabled={isSaving}
                  onApprove={() => respondToTrade(trade, 'approved')}
                  onDeny={() => respondToTrade(trade, trade.status === 'pending_target' ? 'denied' : 'cancelled')}
                  onCancel={() => respondToTrade(trade, 'cancelled')}
                />
              ))}
            </View>
          ) : null}
          {weekDates.map((dateKey) => (
            <DayScheduleSection
              key={dateKey}
              dateKey={dateKey}
              shifts={shiftsByDate[dateKey] || []}
              showPerson={scope === 'all'}
              onShiftPress={scope === 'mine' ? openTradeModal : undefined}
            />
          ))}
        </ScrollView>
      )}

      <Modal
        animationType="slide"
        transparent
        visible={selectedShift !== null}
        onRequestClose={() => setSelectedShift(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tradeModal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <UiText variant="eyebrow" tone="muted">Shift Trade</UiText>
                <UiText variant="h3" style={styles.modalTitle}>
                  {selectedShift ? `${formatShiftDate(selectedShift.shift_date)} ${formatTime(selectedShift.shift_start)}-${formatTime(selectedShift.shift_end)}` : 'Trade shift'}
                </UiText>
              </View>
              <Pressable onPress={() => setSelectedShift(null)} style={styles.closeButton}>
                <Feather name="x" size={18} color={palette.ink[600]} />
              </Pressable>
            </View>
            <UiText variant="bodySmall" tone="muted">
              Send this full shift to one coworker. They approve first, then a manager gives final approval.
            </UiText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetPicker}>
              {eligibleTargets.length === 0 ? (
                <UiText variant="bodySmall" tone="muted">No coworkers returned yet.</UiText>
              ) : eligibleTargets.map((contact) => {
                const active = targetWaiterId === contact.id;
                return (
                  <Pressable
                    key={contact.id}
                    onPress={() => setTargetWaiterId(contact.id)}
                    style={[styles.targetChip, active && styles.targetChipActive]}
                  >
                    <UiText variant="caption" style={[styles.targetChipText, active && styles.targetChipTextActive]} numberOfLines={1}>
                      {contact.name || contact.email || 'Staff'}
                    </UiText>
                  </Pressable>
                );
              })}
            </ScrollView>
            <TextField value={tradeReason} onChangeText={setTradeReason} placeholder="Reason optional" multiline />
            <View style={styles.modalActions}>
              <UiButton label="Cancel" variant="secondary" onPress={() => setSelectedShift(null)} style={styles.modalActionButton} />
              <UiButton label={isSaving ? 'Sending...' : 'Send trade'} disabled={isSaving || !targetWaiterId} onPress={submitTradeRequest} style={styles.modalActionButton} />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

function formatShiftDate(value?: string | null) {
  if (!value) return 'Shift';
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function EmployeeTradeRow({
  trade,
  currentWaiterId,
  disabled,
  onApprove,
  onDeny,
  onCancel,
}: {
  trade: ShiftTradeRequest;
  currentWaiterId?: string;
  disabled?: boolean;
  onApprove: () => void;
  onDeny: () => void;
  onCancel: () => void;
}) {
  const needsMyApproval = trade.status === 'pending_target' && trade.target_waiter_id === currentWaiterId;
  const canCancel = trade.status === 'pending_target' && trade.requesting_waiter_id === currentWaiterId;
  return (
    <View style={styles.tradeRow}>
      <View style={styles.tradeRowTop}>
        <View style={{ flex: 1 }}>
          <UiText variant="body" style={styles.tradeTitle}>
            {trade.requesting_waiter_name || 'A coworker'} {'->'} {trade.target_waiter_name || 'you'}
          </UiText>
          <UiText variant="caption" tone="muted">
            {[formatShiftDate(trade.shift_date), trade.shift_start?.slice(0, 5), trade.shift_end?.slice(0, 5)].filter(Boolean).join(' · ')}
          </UiText>
        </View>
        <View style={styles.tradeStatusPill}>
          <UiText variant="caption" style={styles.tradeStatusText}>{String(trade.status).replaceAll('_', ' ')}</UiText>
        </View>
      </View>
      {trade.reason ? <UiText variant="bodySmall" tone="muted">{trade.reason}</UiText> : null}
      {needsMyApproval ? (
        <View style={styles.tradeActions}>
          <UiButton label="Approve" size="small" disabled={disabled} onPress={onApprove} style={styles.tradeActionButton} />
          <UiButton label="Deny" size="small" variant="secondary" disabled={disabled} onPress={onDeny} style={styles.tradeActionButton} />
        </View>
      ) : canCancel ? (
        <View style={styles.tradeActions}>
          <UiButton label="Cancel trade" size="small" variant="secondary" disabled={disabled} onPress={onCancel} style={styles.tradeActionButton} />
        </View>
      ) : (
        <UiText variant="bodySmall" tone="muted">
          {trade.status === 'pending_manager' ? 'Waiting for manager approval.' : 'Waiting for coworker approval.'}
        </UiText>
      )}
    </View>
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
    gap: spacing[4],
    paddingHorizontal: spacing[5],
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
  messageCard: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing[5],
    marginTop: spacing[3],
    padding: spacing[3],
  },
  approvalsCard: {
    backgroundColor: palette.sky[50],
    borderColor: palette.sky[200],
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[4],
  },
  approvalsTitle: {
    color: palette.ink[900],
    marginTop: spacing[1],
  },
  tradeRow: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[2],
    padding: spacing[3],
  },
  tradeRowTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing[2],
  },
  tradeTitle: {
    color: palette.ink[900],
    fontFamily: 'Inter_700Bold',
  },
  tradeStatusPill: {
    backgroundColor: palette.cream[100],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  tradeStatusText: {
    color: palette.warmth[700],
    textTransform: 'capitalize',
  },
  tradeActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  tradeActionButton: {
    flex: 1,
  },
  modalOverlay: {
    backgroundColor: 'rgba(21, 19, 19, 0.38)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  tradeModal: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[4],
    padding: spacing[5],
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
  },
  modalTitle: {
    marginTop: spacing[1],
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  targetPicker: {
    gap: spacing[2],
    paddingRight: spacing[2],
  },
  targetChip: {
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: 170,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  targetChipActive: {
    backgroundColor: palette.ink[900],
    borderColor: palette.ink[900],
  },
  targetChipText: {
    color: palette.ink[500],
  },
  targetChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  modalActionButton: {
    flex: 1,
  },
});
