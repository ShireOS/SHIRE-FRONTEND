import {
  ApiRequestError,
} from '@/api/mobileApi';
import {
  closeBusinessDay,
  fetchCloseDayPreview,
  type CloseDayPreview,
  type CloseDayResult,
} from '@/api/posCloseDay';
import { color_pallet, semanticColors } from '@/styles/colors';
import { layout, spacing } from '@/styles/tokens';
import { typography } from '@/styles/typography';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getOwnerRestaurant } from '../../packages/supabase';

type CashForm = {
  opening_bank: string;
  paid_in: string;
  paid_out: string;
  cash_refunds: string;
  counted_cash: string;
  retained_bank: string;
  deposit_amount: string;
  variance_reason: string;
};

const INITIAL_CASH: CashForm = {
  opening_bank: '0.00',
  paid_in: '0.00',
  paid_out: '0.00',
  cash_refunds: '0.00',
  counted_cash: '0.00',
  retained_bank: '0.00',
  deposit_amount: '0.00',
  variance_reason: '',
};

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function numberValue(value: string | number | undefined) {
  return Number.parseFloat(String(value || '0')) || 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function newAttemptId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function durationLabel(minutes?: number) {
  const total = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function clockLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown time'
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function CloseDayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ restaurantId?: string; restaurantName?: string }>();
  const passedRestaurantId = param(params.restaurantId);
  const [restaurantId, setRestaurantId] = useState(passedRestaurantId || '');
  const [restaurantName, setRestaurantName] = useState(param(params.restaurantName) || 'Restaurant');
  const [preview, setPreview] = useState<CloseDayPreview | null>(null);
  const [cash, setCash] = useState<CashForm>(INITIAL_CASH);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CloseDayResult | null>(null);
  const initializedCash = useRef(false);
  const attemptId = useRef(newAttemptId());

  useEffect(() => {
    if (passedRestaurantId) return;
    getOwnerRestaurant()
      .then((restaurant) => {
        if (!restaurant) throw new Error('No restaurant is assigned to this account.');
        setRestaurantId(restaurant.id);
        setRestaurantName(restaurant.name || 'Restaurant');
      })
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : 'Could not load restaurant.'));
  }, [passedRestaurantId]);

  const loadPreview = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError('');
    try {
      const next = await fetchCloseDayPreview(restaurantId);
      setPreview(next);
      if (!initializedCash.current) {
        const reconciliation = next.cash_reconciliation;
        setCash((current) => ({
          ...current,
          opening_bank: Number(reconciliation?.opening_bank || 0).toFixed(2),
          paid_in: Number(reconciliation?.paid_in || 0).toFixed(2),
          paid_out: Number(reconciliation?.paid_out || 0).toFixed(2),
          cash_refunds: Number(reconciliation?.cash_refunds || 0).toFixed(2),
        }));
        initializedCash.current = true;
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load close-day readiness.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    initializedCash.current = false;
    attemptId.current = newAttemptId();
    setCash(INITIAL_CASH);
    setResult(null);
    void loadPreview();
  }, [loadPreview, restaurantId]);

  const expectedCash = useMemo(() => (
    numberValue(cash.opening_bank)
    + numberValue(preview?.cash_reconciliation?.cash_sales ?? preview?.cash_collected)
    + numberValue(cash.paid_in)
    - numberValue(cash.paid_out)
    - numberValue(cash.cash_refunds)
  ), [cash, preview]);
  const variance = numberValue(cash.counted_cash) - expectedCash;
  const threshold = Number(preview?.closeout_settings?.cash_variance_threshold || 0);
  const employees = preview?.open_timeclock_entries || [];
  const isClosed = preview?.business_day?.status === 'closed';

  const updateCash = (key: keyof CashForm, value: string) => {
    setCash((current) => ({ ...current, [key]: value }));
  };

  const handleError = (nextError: unknown) => {
    if (nextError instanceof ApiRequestError && nextError.detail && typeof nextError.detail === 'object') {
      const detail = nextError.detail as { code?: string; message?: string; totals?: CloseDayPreview };
      if (detail.totals) setPreview(detail.totals);
      if (detail.code === 'open_checks') {
        Alert.alert('Close all checks before closing the day', 'There is no override. Finish or void every open check on the POS first.');
        return;
      }
      if (detail.code === 'employees_clocked_in') {
        Alert.alert('Employees are still clocked in', 'The readiness data changed. Review the employee list and confirm again.');
        return;
      }
      if (detail.message) {
        setError(detail.message);
        return;
      }
    }
    setError(nextError instanceof Error ? nextError.message : 'Could not close the business day.');
  };

  const submitClose = async (confirmAutoClockOut: boolean) => {
    if (!restaurantId || !preview) return;
    if (Math.abs(variance) > threshold && !cash.variance_reason.trim()) {
      setError(`Explain the ${money(variance)} cash variance before closing.`);
      return;
    }
    setClosing(true);
    setError('');
    try {
      const closed = await closeBusinessDay(restaurantId, {
        business_date: preview.business_date,
        close_attempt_id: attemptId.current,
        confirm_auto_clock_out: confirmAutoClockOut,
        opening_bank: numberValue(cash.opening_bank),
        paid_in: numberValue(cash.paid_in),
        paid_out: numberValue(cash.paid_out),
        cash_refunds: numberValue(cash.cash_refunds),
        counted_cash: numberValue(cash.counted_cash),
        retained_bank: numberValue(cash.retained_bank),
        deposit_amount: numberValue(cash.deposit_amount),
        variance_reason: cash.variance_reason.trim() || undefined,
      });
      setResult(closed);
      setPreview({
        ...closed.totals,
        business_date: closed.business_date,
        active_business_date: closed.active_business_date,
        open_timeclock_entries: [],
        business_day: {
          ...closed.totals.business_day,
          status: 'closed',
          closed_at: closed.closed_at,
        },
      });
      Alert.alert(
        'Day closed',
        closed.auto_clocked_out.length
          ? `${closed.auto_clocked_out.length} employee${closed.auto_clocked_out.length === 1 ? '' : 's'} were clocked out and audited.`
          : 'No employee clock-outs were required.',
      );
      try {
        setPreview(await fetchCloseDayPreview(restaurantId, closed.business_date));
      } catch {
        // The close already succeeded; keep the normalized closed response if
        // the follow-up read is temporarily unavailable.
      }
    } catch (nextError) {
      handleError(nextError);
    } finally {
      setClosing(false);
    }
  };

  const beginClose = () => {
    if (!preview) return;
    setError('');
    if (preview.open_checks > 0) {
      Alert.alert(
        'Close all checks before closing the day',
        `There ${preview.open_checks === 1 ? 'is' : 'are'} ${preview.open_checks} open check${preview.open_checks === 1 ? '' : 's'}. There is no override.`,
      );
      return;
    }
    if (Number(preview.exception_count || 0) > 0) {
      setError('Resolve all close-day payment and check exceptions on the POS first.');
      return;
    }
    if (Number(preview.pending_print_jobs || 0) > 0) {
      setError('Resolve pending print work on the POS before closing remotely.');
      return;
    }
    if (employees.length > 0) {
      const names = employees.slice(0, 4).map((entry) => entry.staff_name).join(', ');
      const more = employees.length > 4 ? ` and ${employees.length - 4} more` : '';
      Alert.alert(
        'Employees are still clocked in',
        `${names}${more}. Continuing clocks everyone out now and records this override.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clock out & close', style: 'destructive', onPress: () => void submitClose(true) },
        ],
      );
      return;
    }
    Alert.alert(
      'Close business day?',
      `Finalize ${preview.business_date} using these reconciliation values?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Close day now', style: 'destructive', onPress: () => void submitClose(false) },
      ],
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.iconButton}>
          <Feather name="arrow-left" size={19} color={semanticColors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{restaurantName}</Text>
          <Text style={styles.title}>Close Day</Text>
        </View>
        <Pressable accessibilityLabel="Refresh close-day readiness" disabled={loading || closing} onPress={() => void loadPreview()} style={styles.iconButton}>
          {loading ? <ActivityIndicator size="small" color={semanticColors.text} /> : <Feather name="refresh-cw" size={18} color={semanticColors.text} />}
        </Pressable>
      </View>

      {error ? <View style={styles.errorBox}><Feather name="alert-triangle" size={18} color={color_pallet.danger[700]} /><Text style={styles.errorText}>{error}</Text></View> : null}

      {loading && !preview ? (
        <View style={styles.loadingBox}><ActivityIndicator color={semanticColors.text} /><Text style={styles.muted}>Loading close-day readiness...</Text></View>
      ) : preview ? (
        <>
          <View style={styles.metricGrid}>
            <Metric label="Business date" value={preview.business_date} />
            <Metric label="Open checks" value={String(preview.open_checks)} alert={preview.open_checks > 0} />
            <Metric label="Clocked in" value={String(employees.length)} warning={employees.length > 0} />
            <Metric label="Collected" value={money(preview.total_collected)} />
          </View>

          {isClosed ? (
            <View style={styles.successBox}>
              <Feather name="check-circle" size={22} color={color_pallet.success[700]} />
              <View style={styles.flex}><Text style={styles.successTitle}>Business day closed</Text><Text style={styles.successText}>{result ? 'The close and audit record were saved.' : `Closed ${preview.business_day?.closed_at ? new Date(preview.business_day.closed_at).toLocaleString() : 'successfully'}.`}</Text></View>
            </View>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Readiness</Text>
                <Readiness label="Checks" ready={!preview.open_checks} detail={preview.open_checks ? `${preview.open_checks} must be closed on POS` : 'All checks are closed'} />
                <Readiness label="Exceptions" ready={!preview.exception_count} detail={preview.exception_count ? `${preview.exception_count} require review` : 'No unresolved exceptions'} />
                <Readiness label="Print work" ready={!preview.pending_print_jobs} detail={preview.pending_print_jobs ? `${preview.pending_print_jobs} jobs still pending` : 'No pending print work'} />
                <Readiness label="Employees" ready={!employees.length} warning={employees.length > 0} detail={employees.length ? `${employees.length} require confirmation` : 'Everyone is clocked out'} />
                {employees.map((entry) => (
                  <View key={entry.id} style={styles.employeeRow}>
                    <View style={styles.flex}><Text style={styles.employeeName}>{entry.staff_name}</Text><Text style={styles.muted}>In {clockLabel(entry.clock_in_at)}</Text></View>
                    <Text style={styles.employeeDuration}>{durationLabel(entry.worked_minutes)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cash reconciliation</Text>
                <Text style={styles.muted}>Enter actual drawer values. These values become the finalized close record.</Text>
                <View style={styles.fieldGrid}>
                  <CashInput label="Opening bank" value={cash.opening_bank} onChange={(value) => updateCash('opening_bank', value)} />
                  <CashInput label="Paid in" value={cash.paid_in} onChange={(value) => updateCash('paid_in', value)} />
                  <CashInput label="Paid out" value={cash.paid_out} onChange={(value) => updateCash('paid_out', value)} />
                  <CashInput label="Cash refunds" value={cash.cash_refunds} onChange={(value) => updateCash('cash_refunds', value)} />
                  <CashInput label="Counted cash" value={cash.counted_cash} onChange={(value) => updateCash('counted_cash', value)} />
                  <CashInput label="Retained bank" value={cash.retained_bank} onChange={(value) => updateCash('retained_bank', value)} />
                  <CashInput label="Deposit amount" value={cash.deposit_amount} onChange={(value) => updateCash('deposit_amount', value)} />
                </View>
                <View style={styles.totalRow}><Text style={styles.muted}>Cash sales</Text><Text style={styles.totalValue}>{money(preview.cash_reconciliation?.cash_sales ?? preview.cash_collected)}</Text></View>
                <View style={styles.totalRow}><Text style={styles.muted}>Expected cash</Text><Text style={styles.totalValue}>{preview.closeout_settings?.blind_drawer_close ? 'Hidden by policy' : money(expectedCash)}</Text></View>
                <View style={styles.totalRow}><Text style={styles.muted}>Variance</Text><Text style={[styles.totalValue, Math.abs(variance) > threshold && styles.warningText]}>{money(variance)}</Text></View>
                <Text style={styles.fieldLabel}>Variance reason</Text>
                <TextInput multiline value={cash.variance_reason} onChangeText={(value) => updateCash('variance_reason', value)} placeholder="Required when outside the configured threshold" placeholderTextColor={semanticColors.textSubtle} style={[styles.input, styles.reasonInput]} />
              </View>

              <Pressable disabled={closing} onPress={beginClose} style={[styles.closeButton, closing && styles.disabled]}>
                {closing ? <ActivityIndicator color={semanticColors.textInverse} /> : <Feather name="calendar" size={18} color={semanticColors.textInverse} />}
                <Text style={styles.closeButtonText}>{closing ? 'Closing day...' : 'Close business day'}</Text>
              </Pressable>
            </>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function Metric({ label, value, alert = false, warning = false }: { label: string; value: string; alert?: boolean; warning?: boolean }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, alert && styles.alertText, warning && styles.warningText]}>{value}</Text></View>;
}

function Readiness({ label, ready, warning = false, detail }: { label: string; ready: boolean; warning?: boolean; detail: string }) {
  return <View style={styles.readinessRow}><Feather name={ready ? 'check-circle' : warning ? 'clock' : 'alert-triangle'} size={17} color={ready ? color_pallet.success[700] : warning ? color_pallet.amber[700] : color_pallet.danger[700]} /><View style={styles.flex}><Text style={styles.readinessLabel}>{label}</Text><Text style={styles.muted}>{detail}</Text></View></View>;
}

function CashInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.moneyInput}><Text style={styles.currency}>$</Text><TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" style={styles.moneyTextInput} /></View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semanticColors.background },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: spacing[4], paddingBottom: 120, gap: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticColors.border, backgroundColor: semanticColors.surface },
  eyebrow: { ...typography.eyebrow, color: semanticColors.textMuted },
  title: { ...typography.h1, color: semanticColors.text, marginTop: 2 },
  flex: { flex: 1 },
  muted: { ...typography.bodySmall, color: semanticColors.textMuted },
  loadingBox: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: color_pallet.danger[100], backgroundColor: color_pallet.danger[50], padding: 14 },
  errorText: { ...typography.bodySmall, color: color_pallet.danger[700], flex: 1 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderBottomWidth: 1, borderColor: semanticColors.border },
  metric: { width: '50%', minHeight: 82, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderColor: semanticColors.border },
  metricLabel: { ...typography.eyebrow, color: semanticColors.textMuted },
  metricValue: { ...typography.h2, color: semanticColors.text, marginTop: 5 },
  alertText: { color: color_pallet.danger[700] },
  warningText: { color: color_pallet.amber[700] },
  section: { borderWidth: 1, borderColor: semanticColors.border, backgroundColor: semanticColors.surface, padding: 16, gap: 12 },
  sectionTitle: { ...typography.h3, color: semanticColors.text },
  readinessRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  readinessLabel: { ...typography.body, fontWeight: '700', color: semanticColors.text },
  employeeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: semanticColors.border, paddingTop: 10 },
  employeeName: { ...typography.body, fontWeight: '700', color: semanticColors.text },
  employeeDuration: { ...typography.bodySmall, fontWeight: '700', color: color_pallet.amber[700] },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { width: '47%', minWidth: 140, flexGrow: 1, gap: 5 },
  fieldLabel: { ...typography.caption, fontWeight: '700', color: semanticColors.textMuted },
  moneyInput: { minHeight: 44, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: semanticColors.border, backgroundColor: semanticColors.background, paddingHorizontal: 12 },
  currency: { ...typography.body, color: semanticColors.textMuted, marginRight: 4 },
  moneyTextInput: { ...typography.body, fontWeight: '700', color: semanticColors.text, flex: 1, paddingVertical: 9 },
  input: { ...typography.body, color: semanticColors.text, borderWidth: 1, borderColor: semanticColors.border, backgroundColor: semanticColors.background, paddingHorizontal: 12, paddingVertical: 10 },
  reasonInput: { minHeight: 76, textAlignVertical: 'top' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: semanticColors.border, paddingTop: 10 },
  totalValue: { ...typography.body, fontWeight: '700', color: semanticColors.text },
  closeButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: color_pallet.elevated.dark },
  closeButtonText: { ...typography.body, fontWeight: '800', color: semanticColors.textInverse },
  disabled: { opacity: 0.5 },
  successBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: color_pallet.success[100], backgroundColor: color_pallet.success[50], padding: 16 },
  successTitle: { ...typography.h3, color: color_pallet.success[800] },
  successText: { ...typography.bodySmall, color: color_pallet.success[800], marginTop: 3 },
});
