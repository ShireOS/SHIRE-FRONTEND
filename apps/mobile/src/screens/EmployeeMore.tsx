import {
  createEmployeeRequest,
  fetchEmployeeAvailability,
  fetchEmployeeContacts,
  fetchEmployeeRequests,
  saveEmployeeAvailability,
  type AvailabilityEntry,
  type EmployeeRequest,
  type StaffContact,
} from '@/api/employeeOps';
import {
  DEFAULT_REMOTE_TIME_CLOCK_POLICY,
  fetchEmployeeAdmins,
  fetchEmployeeTimeClockPolicy,
  submitManualTimeEntry,
  type AdminContact,
  type RemoteTimeClockPolicy,
} from '@/api/timeClock';
import { staleWhileRevalidate } from '@/cache/staleWhileRevalidate';
import {
  ContactRow,
  PageHeader,
  RequestRow,
  ScreenShell,
  SegmentedControl,
  TextField,
} from '@/components/scheduling/ScheduleKit';
import { UiButton } from '@/components/ui/Button';
import { UiText } from '@/components/ui/Text';
import { semanticColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

type MoreTab = 'availability' | 'time_off' | 'manual_hours' | 'contacts';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const POLICY_CACHE_TTL_MS = 60_000;
const POLICY_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export default function EmployeeMore() {
  const [tab, setTab] = useState<MoreTab>('availability');
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [contacts, setContacts] = useState<StaffContact[]>([]);
  const [timeClockPolicy, setTimeClockPolicy] = useState<RemoteTimeClockPolicy | null>(null);
  const [admins, setAdmins] = useState<AdminContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [availabilityForm, setAvailabilityForm] = useState({
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
    availability_type: 'available' as 'available' | 'unavailable',
    note: '',
  });
  const [timeOffForm, setTimeOffForm] = useState({
    start_date: '',
    end_date: '',
    title: 'Time off',
    notes: '',
    priority: 'normal',
  });
  const [manualForm, setManualForm] = useState({
    work_date: '',
    start_time: '09:00',
    end_time: '17:00',
    reason: '',
    mentioned_manager_id: '',
  });

  const remoteSettings = timeClockPolicy?.remote_time_clock || DEFAULT_REMOTE_TIME_CLOCK_POLICY.remote_time_clock;
  const canSubmitManualHours = Boolean(timeClockPolicy && remoteSettings.enabled && remoteSettings.allow_manual_entries);
  const tabs: { id: MoreTab; label: string }[] = [
    { id: 'availability', label: 'Availability' },
    { id: 'time_off', label: 'Time off' },
    ...(canSubmitManualHours ? [{ id: 'manual_hours' as MoreTab, label: 'Manual hours' }] : []),
    { id: 'contacts', label: 'Contacts' },
  ];

  const refresh = async () => {
    const [availabilityData, requestData, contactData] = await Promise.all([
      fetchEmployeeAvailability(),
      fetchEmployeeRequests(),
      fetchEmployeeContacts(),
    ]);
    setAvailability(availabilityData);
    setRequests(requestData);
    setContacts(contactData);
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    refresh()
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load employee tools.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      staleWhileRevalidate<RemoteTimeClockPolicy>({
        namespace: 'employee-time-clock-policy',
        version: 1,
        ttlMs: POLICY_CACHE_TTL_MS,
        maxStaleMs: POLICY_MAX_STALE_MS,
        fetcher: fetchEmployeeTimeClockPolicy,
        onRevalidate: setTimeClockPolicy,
      }),
      fetchEmployeeAdmins(),
    ]).then(([policyResult, adminResult]) => {
      if (cancelled) return;
      if (policyResult.status === 'fulfilled') setTimeClockPolicy(policyResult.value.data);
      if (adminResult.status === 'fulfilled') {
        setAdmins(adminResult.value);
        setManualForm((current) => current.mentioned_manager_id || !adminResult.value[0]?.id
          ? current
          : { ...current, mentioned_manager_id: adminResult.value[0].id });
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const addAvailability = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      const next = [
        ...availability,
        {
          day_of_week: Number(availabilityForm.day_of_week),
          start_time: availabilityForm.start_time,
          end_time: availabilityForm.end_time,
          availability_type: availabilityForm.availability_type,
          notes: availabilityForm.note || null,
        },
      ];
      const saved = await saveEmployeeAvailability(next);
      setAvailability(saved);
      setAvailabilityForm((current) => ({ ...current, note: '' }));
      setMessage('Availability saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save availability.');
    } finally {
      setIsSaving(false);
    }
  };

  const submitTimeOff = async () => {
    if (!timeOffForm.start_date) {
      setMessage('Choose a start date first.');
      return;
    }
    setIsSaving(true);
    setMessage('');
    try {
      const created = await createEmployeeRequest({
        request_type: 'time_off',
        priority: timeOffForm.priority,
        start_date: timeOffForm.start_date,
        end_date: timeOffForm.end_date || timeOffForm.start_date,
        title: timeOffForm.title || 'Time off',
        notes: timeOffForm.notes || null,
        structured_payload: { source: 'mobile_employee_time_off' },
      });
      setRequests((current) => [created, ...current]);
      setTimeOffForm({ start_date: '', end_date: '', title: 'Time off', notes: '', priority: 'normal' });
      setMessage('Request submitted.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not submit request.');
    } finally {
      setIsSaving(false);
    }
  };

  const submitManualHours = async () => {
    if (!manualForm.work_date) {
      setMessage('Choose the work date first.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(manualForm.start_time) || !/^\d{2}:\d{2}$/.test(manualForm.end_time)) {
      setMessage('Use HH:MM time for manual hours.');
      return;
    }
    if (manualForm.reason.trim().length < 4) {
      setMessage('Add a short reason for the manual hours.');
      return;
    }
    if (remoteSettings.require_manager_mention && !manualForm.mentioned_manager_id) {
      setMessage('Choose a manager to notify.');
      return;
    }
    setIsSaving(true);
    setMessage('');
    try {
      const created = await submitManualTimeEntry({
        work_date: manualForm.work_date,
        start_time: manualForm.start_time,
        end_time: manualForm.end_time,
        reason: manualForm.reason.trim(),
        mentioned_manager_id: manualForm.mentioned_manager_id || null,
      });
      setRequests((current) => [created as EmployeeRequest, ...current]);
      setManualForm({
        work_date: '',
        start_time: '09:00',
        end_time: '17:00',
        reason: '',
        mentioned_manager_id: admins[0]?.id || '',
      });
      setMessage('Manual hours sent for manager review.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not submit manual hours.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenShell>
      <PageHeader
        eyebrow="Self Service"
        title="More"
        subtitle="Availability, time off, contacts, and submitted requests."
      />
      <SegmentedControl
        value={tab}
        options={tabs}
        onChange={setTab}
      />

      {isLoading && (
        <View style={styles.stateCard}>
          <UiText variant="bodySmall" tone="muted">Loading employee tools...</UiText>
        </View>
      )}
      {error && (
        <View style={styles.stateCard}>
          <UiText variant="title">Self service unavailable</UiText>
          <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[1] }}>{error}</UiText>
        </View>
      )}
      {message ? (
        <View style={styles.messageCard}>
          <UiText variant="bodySmall" tone="muted">{message}</UiText>
        </View>
      ) : null}

      {!isLoading && !error && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === 'availability' && (
            <>
              <View style={styles.formCard}>
                <UiText variant="title">Add availability</UiText>
                <View style={styles.dayGrid}>
                  {DAYS.map((day, index) => (
                    <UiButton
                      key={day}
                      label={day}
                      size="small"
                      variant={availabilityForm.day_of_week === index ? 'primary' : 'secondary'}
                      onPress={() => setAvailabilityForm((current) => ({ ...current, day_of_week: index }))}
                      style={styles.dayButton}
                    />
                  ))}
                </View>
                <View style={styles.twoCol}>
                  <TextField
                    value={availabilityForm.start_time}
                    onChangeText={(start_time) => setAvailabilityForm((current) => ({ ...current, start_time }))}
                    placeholder="09:00"
                  />
                  <TextField
                    value={availabilityForm.end_time}
                    onChangeText={(end_time) => setAvailabilityForm((current) => ({ ...current, end_time }))}
                    placeholder="17:00"
                  />
                </View>
                <SegmentedControl
                  value={availabilityForm.availability_type}
                  options={[
                    { id: 'available', label: 'Available' },
                    { id: 'unavailable', label: 'Not available' },
                  ]}
                  onChange={(availability_type) => setAvailabilityForm((current) => ({ ...current, availability_type }))}
                />
                <TextField
                  value={availabilityForm.note}
                  onChangeText={(note) => setAvailabilityForm((current) => ({ ...current, note }))}
                  placeholder="Optional note"
                  multiline
                />
                <UiButton label="Save availability" disabled={isSaving} onPress={addAvailability} />
              </View>
              <View style={styles.listGap}>
                {availability.map((entry, index) => (
                  <View key={entry.id || `${entry.day_of_week}-${index}`} style={styles.simpleRow}>
                    <UiText variant="body">{DAYS[entry.day_of_week]} · {entry.start_time}-{entry.end_time}</UiText>
                    <UiText variant="bodySmall" tone="muted">{entry.availability_type}</UiText>
                  </View>
                ))}
              </View>
            </>
          )}

          {tab === 'time_off' && (
            <>
              <View style={styles.formCard}>
                <UiText variant="title">Request time off</UiText>
                <View style={styles.twoCol}>
                  <TextField value={timeOffForm.start_date} onChangeText={(start_date) => setTimeOffForm((current) => ({ ...current, start_date }))} placeholder="YYYY-MM-DD" />
                  <TextField value={timeOffForm.end_date} onChangeText={(end_date) => setTimeOffForm((current) => ({ ...current, end_date }))} placeholder="End date" />
                </View>
                <TextField value={timeOffForm.title} onChangeText={(title) => setTimeOffForm((current) => ({ ...current, title }))} placeholder="Title" />
                <TextField value={timeOffForm.notes} onChangeText={(notes) => setTimeOffForm((current) => ({ ...current, notes }))} placeholder="Optional note" multiline />
                <UiButton label="Submit request" disabled={isSaving} onPress={submitTimeOff} />
              </View>
              <View style={styles.listGap}>
                {requests.map((request) => <RequestRow key={request.id} request={request} />)}
              </View>
            </>
          )}

          {tab === 'manual_hours' && canSubmitManualHours && (
            <>
              <View style={styles.formCard}>
                <UiText variant="title">Submit manual hours</UiText>
                <UiText variant="bodySmall" tone="muted">
                  Use this for work that already happened. Your manager approves it before it counts.
                </UiText>
                <TextField
                  value={manualForm.work_date}
                  onChangeText={(work_date) => setManualForm((current) => ({ ...current, work_date }))}
                  placeholder="YYYY-MM-DD"
                />
                <View style={styles.twoCol}>
                  <TextField
                    value={manualForm.start_time}
                    onChangeText={(start_time) => setManualForm((current) => ({ ...current, start_time }))}
                    placeholder="Start HH:MM"
                  />
                  <TextField
                    value={manualForm.end_time}
                    onChangeText={(end_time) => setManualForm((current) => ({ ...current, end_time }))}
                    placeholder="End HH:MM"
                  />
                </View>
                <TextField
                  value={manualForm.reason}
                  onChangeText={(reason) => setManualForm((current) => ({ ...current, reason }))}
                  placeholder="Reason"
                  multiline
                />
                <UiText variant="title">Notify manager</UiText>
                <View style={styles.managerPicker}>
                  {admins.length === 0 ? (
                    <UiText variant="bodySmall" tone="muted">No admins returned yet.</UiText>
                  ) : admins.map((admin) => {
                    const active = manualForm.mentioned_manager_id === admin.id;
                    return (
                      <UiButton
                        key={admin.id}
                        label={admin.name || admin.email || 'Manager'}
                        size="small"
                        variant={active ? 'primary' : 'secondary'}
                        onPress={() => setManualForm((current) => ({ ...current, mentioned_manager_id: admin.id }))}
                      />
                    );
                  })}
                </View>
                <UiButton label={isSaving ? 'Submitting...' : 'Submit manual hours'} disabled={isSaving} onPress={submitManualHours} />
              </View>
              <View style={styles.listGap}>
                {requests.map((request) => <RequestRow key={request.id} request={request} />)}
              </View>
            </>
          )}

          {tab === 'contacts' && (
            <View style={styles.listGap}>
              {contacts.length === 0 ? (
                <View style={styles.stateCard}>
                  <UiText variant="bodySmall" tone="muted">No contacts returned yet.</UiText>
                </View>
              ) : (
                contacts.map((contact) => <ContactRow key={contact.id} contact={contact} />)
              )}
            </View>
          )}
        </ScrollView>
      )}
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
  messageCard: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing[5],
    marginTop: spacing[3],
    padding: spacing[3],
  },
  formCard: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[4],
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  dayButton: {
    minWidth: 58,
  },
  twoCol: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  managerPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  listGap: {
    gap: spacing[3],
  },
  simpleRow: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[4],
  },
});
