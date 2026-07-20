import {
  deletePortfolioRecipient,
  fetchPortfolioRecipients,
  fetchPortfolioReport,
  fetchPortfolioViewPreferences,
  savePortfolioRecipient,
  savePortfolioViewPreferences,
  sendPortfolioTest,
  type PortfolioGroup,
  type PortfolioPeriod,
  type PortfolioRecipient,
  type PortfolioRecipientPayload,
  type PortfolioReport,
} from '@/api/portfolioReports';
import { semanticColors, statusColors } from '@/styles/colors';
import { card, layout, radius, spacing } from '@/styles/tokens';
import { typography } from '@/styles/typography';
import { Feather } from '@expo/vector-icons';
import HomepageWidgets from '@/components/HomepageWidgets';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

const PERIODS: { id: PortfolioPeriod; label: string }[] = [
  { id: 'day', label: 'Day' }, { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }, { id: 'full', label: 'Full' },
];
const EMPTY_RECIPIENT: PortfolioRecipientPayload = {
  name: '', email: '', frequency: 'weekly', send_time: '07:00', timezone: 'America/Chicago',
  weekday: 1, month_day: 1, scope_mode: 'all', group_ids: [], include_ungrouped: true, is_active: true,
};

const number = (value: unknown) => new Intl.NumberFormat('en-US').format(Number(value || 0));

export default function PortfolioOverview() {
  const [tab, setTab] = useState<'overview' | 'email'>('overview');
  const [period, setPeriod] = useState<PortfolioPeriod>('week');
  const [report, setReport] = useState<PortfolioReport | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [includeUngrouped, setIncludeUngrouped] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewHydrated, setViewHydrated] = useState(false);
  const [viewPersistenceReady, setViewPersistenceReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPortfolioViewPreferences()
      .then((payload) => {
        if (cancelled) return;
        const saved = payload.settings.overview;
        if (saved) {
          setPeriod(saved.period || 'week');
          setGroupIds(saved.group_ids || []);
          setIncludeUngrouped(Boolean(saved.include_ungrouped));
        }
        setViewPersistenceReady(true);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setViewHydrated(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!viewHydrated || !viewPersistenceReady) return;
    const timeout = setTimeout(() => {
      savePortfolioViewPreferences({ period, group_ids: groupIds, include_ungrouped: includeUngrouped })
        .catch(() => undefined);
    }, 450);
    return () => clearTimeout(timeout);
  }, [groupIds, includeUngrouped, period, viewHydrated, viewPersistenceReady]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const nextReport = await fetchPortfolioReport(period, groupIds, includeUngrouped);
      setReport(nextReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load portfolio analytics.');
    } finally { setLoading(false); }
  }, [groupIds, includeUngrouped, period]);

  useEffect(() => { if (viewHydrated) void load(); }, [load, viewHydrated]);
  const totals = report?.totals || {};
  const filterLabel = groupIds.length || includeUngrouped
    ? `${groupIds.length + (includeUngrouped ? 1 : 0)} groups`
    : 'All groups';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View><Text style={styles.eyebrow}>ENTERPRISE</Text><Text style={styles.title}>Portfolio overview</Text><Text style={styles.muted}>{number(totals.store_count)} stores · {number(totals.reporting_stores)} reporting</Text></View>
        <Pressable accessibilityLabel="Refresh" onPress={() => void load()} style={styles.iconButton}><Feather name="refresh-cw" size={17} color={semanticColors.textMuted} /></Pressable>
      </View>

      <View style={styles.tabs}><Tab label="Overview" selected={tab === 'overview'} onPress={() => setTab('overview')} /><Tab label="Email reports" selected={tab === 'email'} onPress={() => setTab('email')} /></View>
      {tab === 'email' ? <EmailPanel groups={report?.scope.groups || []} /> : <>
        <View style={styles.toolbarRow}><Pressable onPress={() => setFilterOpen(true)} style={styles.secondaryButton}><Feather name="filter" size={15} color={semanticColors.textMuted} /><Text style={styles.secondaryButtonText}>{filterLabel}</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>{PERIODS.map((item) => <Pressable key={item.id} onPress={() => setPeriod(item.id)} style={[styles.periodButton, period === item.id && styles.periodButtonActive]}><Text style={[styles.periodText, period === item.id && styles.periodTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && !report ? <ActivityIndicator color={semanticColors.primary} style={styles.loader} /> : viewHydrated ? <HomepageWidgets scope="portfolio" period={period} groupIds={groupIds} includeUngrouped={includeUngrouped} /> : null}
      </>}
      <GroupFilterModal visible={filterOpen} groups={report?.scope.groups || []} selected={groupIds} includeUngrouped={includeUngrouped} onClose={() => setFilterOpen(false)} onApply={(ids, ungrouped) => { setGroupIds(ids); setIncludeUngrouped(ungrouped); setFilterOpen(false); }} />
    </ScrollView>
  );
}

function Tab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.tab, selected && styles.tabActive]}><Text style={[styles.tabText, selected && styles.tabTextActive]}>{label}</Text></Pressable>;
}

function GroupFilterModal({ visible, groups, selected, includeUngrouped, onClose, onApply }: { visible: boolean; groups: PortfolioGroup[]; selected: string[]; includeUngrouped: boolean; onClose: () => void; onApply: (ids: string[], ungrouped: boolean) => void }) {
  const [draft, setDraft] = useState(selected); const [ungrouped, setUngrouped] = useState(includeUngrouped);
  useEffect(() => { if (visible) { setDraft(selected); setUngrouped(includeUngrouped); } }, [includeUngrouped, selected, visible]);
  const toggle = (id: string) => setDraft((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <Sheet visible={visible} title="Filter portfolio" onClose={onClose}><Pressable onPress={() => { setDraft([]); setUngrouped(false); }} style={[styles.option, draft.length === 0 && !ungrouped && styles.optionSelected]}><Text style={styles.optionTitle}>All groups</Text>{draft.length === 0 && !ungrouped && <Feather name="check" size={18} color={semanticColors.primary} />}</Pressable>{groups.map((group) => <Pressable key={group.id} onPress={() => toggle(group.id)} style={[styles.option, draft.includes(group.id) && styles.optionSelected]}><View style={styles.groupHeader}><View style={[styles.dot, { backgroundColor: group.color }]} /><Text style={styles.optionTitle}>{group.name}</Text></View>{draft.includes(group.id) && <Feather name="check" size={18} color={semanticColors.primary} />}</Pressable>)}<Pressable onPress={() => setUngrouped(!ungrouped)} style={[styles.option, ungrouped && styles.optionSelected]}><Text style={styles.optionTitle}>Ungrouped</Text>{ungrouped && <Feather name="check" size={18} color={semanticColors.primary} />}</Pressable><Pressable onPress={() => onApply(draft, ungrouped)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Apply filter</Text></Pressable></Sheet>;
}

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><View style={styles.modalScreen}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={onClose} style={styles.iconButton}><Feather name="x" size={19} color={semanticColors.textMuted} /></Pressable></View><ScrollView contentContainerStyle={styles.modalContent}>{children}</ScrollView></View></Modal>;
}

function EmailPanel({ groups }: { groups: PortfolioGroup[] }) {
  const [recipients, setRecipients] = useState<PortfolioRecipient[]>([]); const [availableGroups, setAvailableGroups] = useState<PortfolioGroup[]>(groups); const [canManage, setCanManage] = useState(false); const [deliveryEnabled, setDeliveryEnabled] = useState(false); const [disabledReason, setDisabledReason] = useState(''); const [editing, setEditing] = useState<PortfolioRecipient | null | undefined>(undefined); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { const data = await fetchPortfolioRecipients(); setRecipients(data.recipients || []); setAvailableGroups(data.groups || []); setCanManage(data.can_manage); setDeliveryEnabled(data.delivery_enabled); setDisabledReason(data.delivery_disabled_reason || ''); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <View>{!deliveryEnabled && disabledReason ? <Text style={styles.warningBox}>{disabledReason}</Text> : null}<View style={styles.emailHeader}><View style={styles.flex}><Text style={styles.sectionTitleInline}>Portfolio recipients</Text><Text style={styles.muted}>Consolidated group and store reports.</Text></View>{canManage && <Pressable onPress={() => setEditing(null)} style={styles.primarySmall}><Feather name="plus" size={15} color={semanticColors.textInverse} /><Text style={styles.primaryButtonText}>Add</Text></Pressable>}</View>{loading ? <ActivityIndicator color={semanticColors.primary} /> : recipients.map((recipient) => <Pressable key={recipient.id} onPress={() => setEditing(recipient)} style={styles.card}><View style={styles.emailHeader}><View style={styles.flex}><Text style={styles.storeName}>{recipient.name || recipient.email}</Text><Text style={styles.muted}>{recipient.email}</Text><Text style={styles.optionDescription}>{recipient.frequency} · {recipient.scope_mode === 'all' ? 'All groups' : `${recipient.group_ids.length} groups${recipient.include_ungrouped ? ' + Ungrouped' : ''}`}</Text></View><View style={styles.emailActions}><Pressable disabled={!deliveryEnabled} onPress={async () => { try { const result = await sendPortfolioTest(recipient.id); Alert.alert('Test sent', result.message); } catch (err) { Alert.alert('Test failed', err instanceof Error ? err.message : 'Could not send test.'); } await load(); }} style={styles.iconButton}><Feather name="send" size={16} color={semanticColors.textMuted} /></Pressable><Pressable onPress={async () => { await savePortfolioRecipient({ ...recipient, is_active: !recipient.is_active, send_time: recipient.send_time.slice(0, 5) }, recipient.id); await load(); }} style={styles.iconButton}><Feather name={recipient.is_active ? 'pause' : 'play'} size={16} color={semanticColors.textMuted} /></Pressable><Pressable onPress={() => Alert.alert('Delete recipient?', recipient.email, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deletePortfolioRecipient(recipient.id); await load(); } }])} style={styles.iconButton}><Feather name="trash-2" size={16} color={statusColors.danger.text} /></Pressable></View></View>{recipient.last_delivery_status && <Text style={recipient.last_delivery_status === 'failed' ? styles.error : styles.optionDescription}>Last delivery: {recipient.last_delivery_status}</Text>}</Pressable>)}{!loading && recipients.length === 0 && <View style={styles.empty}><Feather name="mail" size={24} color={semanticColors.textSubtle} /><Text style={styles.storeName}>No portfolio recipients</Text></View>}{editing !== undefined && <RecipientModal recipient={editing} groups={availableGroups} onClose={() => setEditing(undefined)} onSaved={load} />}</View>;
}

function RecipientModal({ recipient, groups, onClose, onSaved }: { recipient: PortfolioRecipient | null; groups: PortfolioGroup[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState<PortfolioRecipientPayload>(() => recipient ? { ...recipient, send_time: recipient.send_time.slice(0, 5) } : EMPTY_RECIPIENT); const [saving, setSaving] = useState(false);
  const set = <K extends keyof PortfolioRecipientPayload>(key: K, value: PortfolioRecipientPayload[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const toggleGroup = (id: string) => set('group_ids', draft.group_ids.includes(id) ? draft.group_ids.filter((item) => item !== id) : [...draft.group_ids, id]);
  return <Sheet visible title={recipient ? 'Edit recipient' : 'Add recipient'} onClose={onClose}><Label text="Name"><TextInput style={styles.input} value={draft.name} onChangeText={(value) => set('name', value)} /></Label><Label text="Email"><TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={draft.email} onChangeText={(value) => set('email', value)} /></Label><Text style={styles.fieldLabel}>Frequency</Text><View style={styles.choiceRow}>{(['daily','weekly','monthly'] as const).map((frequency) => <Pressable key={frequency} onPress={() => set('frequency', frequency)} style={[styles.choice, draft.frequency === frequency && styles.choiceActive]}><Text style={draft.frequency === frequency ? styles.choiceTextActive : styles.choiceText}>{frequency}</Text></Pressable>)}</View><Label text="Send time"><TextInput style={styles.input} placeholder="07:00" value={draft.send_time} onChangeText={(value) => set('send_time', value)} /></Label><Label text="Timezone"><TextInput style={styles.input} autoCapitalize="none" value={draft.timezone} onChangeText={(value) => set('timezone', value)} /></Label>{draft.frequency === 'weekly' && <><Text style={styles.fieldLabel}>Weekday</Text><View style={styles.choiceRow}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, index) => <Pressable key={day} onPress={() => set('weekday', index)} style={[styles.choice, draft.weekday === index && styles.choiceActive]}><Text style={draft.weekday === index ? styles.choiceTextActive : styles.choiceText}>{day}</Text></Pressable>)}</View></>}{draft.frequency === 'monthly' && <Label text="Day of month"><TextInput style={styles.input} keyboardType="number-pad" value={String(draft.month_day || 1)} onChangeText={(value) => set('month_day', Math.min(28, Math.max(1, Number(value) || 1)))} /></Label>}<Text style={styles.fieldLabel}>Scope</Text><View style={styles.choiceRow}>{(['all','groups'] as const).map((mode) => <Pressable key={mode} onPress={() => set('scope_mode', mode)} style={[styles.choice, draft.scope_mode === mode && styles.choiceActive]}><Text style={draft.scope_mode === mode ? styles.choiceTextActive : styles.choiceText}>{mode === 'all' ? 'All groups' : 'Selected groups'}</Text></Pressable>)}</View>{draft.scope_mode === 'groups' && <>{groups.map((group) => <Pressable key={group.id} onPress={() => toggleGroup(group.id)} style={[styles.option, draft.group_ids.includes(group.id) && styles.optionSelected]}><Text style={styles.optionTitle}>{group.name}</Text>{draft.group_ids.includes(group.id) && <Feather name="check" size={17} color={semanticColors.primary} />}</Pressable>)}<View style={styles.switchRow}><Text style={styles.optionTitle}>Include Ungrouped</Text><Switch value={draft.include_ungrouped} onValueChange={(value) => set('include_ungrouped', value)} /></View></>}<Pressable disabled={saving || !draft.email} onPress={async () => { setSaving(true); try { await savePortfolioRecipient(draft, recipient?.id); await onSaved(); onClose(); } catch (err) { Alert.alert('Could not save', err instanceof Error ? err.message : 'Try again.'); } finally { setSaving(false); } }} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save recipient'}</Text></Pressable></Sheet>;
}

function Label({ text, children }: { text: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{text}</Text>{children}</View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semanticColors.background }, content: { padding: layout.screenPadding, paddingBottom: spacing[16], gap: spacing[4] },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3] }, eyebrow: { ...typography.eyebrow, color: semanticColors.textSubtle }, title: { ...typography.h1, color: semanticColors.text, marginTop: spacing[1] }, muted: { ...typography.bodySmall, color: semanticColors.textMuted, marginTop: spacing[1] },
  iconButton: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: semanticColors.border, alignItems: 'center', justifyContent: 'center' }, tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: semanticColors.border }, tab: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 2, borderBottomColor: 'transparent' }, tabActive: { borderBottomColor: semanticColors.primary }, tabText: { ...typography.bodySmall, fontWeight: '600', color: semanticColors.textMuted }, tabTextActive: { color: semanticColors.text },
  toolbarRow: { flexDirection: 'row', gap: spacing[2] }, secondaryButton: { minHeight: 40, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2] }, secondaryButtonText: { ...typography.bodySmall, fontWeight: '600', color: semanticColors.textMuted }, periodRow: { gap: spacing[2] }, periodButton: { minHeight: 38, minWidth: 64, paddingHorizontal: spacing[3], borderRadius: radius.md, borderWidth: 1, borderColor: semanticColors.border, alignItems: 'center', justifyContent: 'center' }, periodButtonActive: { backgroundColor: semanticColors.primary, borderColor: semanticColors.primary }, periodText: { ...typography.bodySmall, fontWeight: '600', color: semanticColors.textMuted }, periodTextActive: { color: semanticColors.textInverse },
  loader: { marginVertical: spacing[8] }, error: { ...typography.bodySmall, color: statusColors.danger.text }, warning: { ...typography.caption, color: statusColors.warning.text, marginTop: 2 }, warningBox: { ...typography.bodySmall, color: statusColors.warning.text, backgroundColor: statusColors.warning.bg, borderColor: statusColors.warning.border, borderWidth: 1, borderRadius: radius.md, padding: spacing[3] },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }, metric: { ...card.base, width: '47.5%', minHeight: 108 }, metricLabel: { ...typography.eyebrow, color: semanticColors.textSubtle }, metricValue: { ...typography.h2, color: semanticColors.text, marginTop: spacing[2] }, delta: { ...typography.caption, marginTop: spacing[1] },
  card: { ...card.base, gap: spacing[3] }, sectionTitle: { ...typography.h2, color: semanticColors.text, marginTop: spacing[3] }, sectionTitleInline: { ...typography.h2, color: semanticColors.text }, trendRows: { gap: spacing[2] }, trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] }, trendLabel: { ...typography.caption, color: semanticColors.textSubtle, width: 42 }, trendTrack: { flex: 1, height: 8, backgroundColor: semanticColors.surface, borderRadius: radius.pill, overflow: 'hidden' }, trendFill: { height: 8, backgroundColor: semanticColors.primary, borderRadius: radius.pill }, trendValue: { ...typography.caption, color: semanticColors.textMuted, width: 74, textAlign: 'right' },
  storeCard: { ...card.base, gap: spacing[3] }, storeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] }, rank: { ...typography.eyebrow, color: semanticColors.textSubtle, width: 28 }, storeNameWrap: { flex: 1 }, storeName: { ...typography.body, fontWeight: '700', color: semanticColors.text }, storeSales: { ...typography.body, fontWeight: '700', color: semanticColors.text }, storeStats: { flexDirection: 'row', gap: spacing[5] }, smallStat: { gap: 2 }, smallLabel: { ...typography.caption, color: semanticColors.textSubtle }, smallValue: { ...typography.bodySmall, fontWeight: '600', color: semanticColors.textMuted }, groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 }, dot: { width: 10, height: 10, borderRadius: 5 },
  modalScreen: { flex: 1, backgroundColor: semanticColors.background }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[5], borderBottomWidth: 1, borderBottomColor: semanticColors.border }, modalTitle: { ...typography.h2, color: semanticColors.text }, modalContent: { padding: spacing[5], gap: spacing[3] }, option: { minHeight: 58, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, padding: spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] }, optionSelected: { borderColor: semanticColors.primary, backgroundColor: statusColors.info.bg }, optionCopy: { flex: 1 }, optionTitle: { ...typography.body, fontWeight: '600', color: semanticColors.text }, optionDescription: { ...typography.caption, color: semanticColors.textSubtle, marginTop: 2 },
  primaryButton: { minHeight: 48, backgroundColor: semanticColors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing[3] }, primarySmall: { minHeight: 40, backgroundColor: semanticColors.primary, borderRadius: radius.md, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2] }, primaryButtonText: { ...typography.bodySmall, fontWeight: '700', color: semanticColors.textInverse },
  emailHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], justifyContent: 'space-between' }, flex: { flex: 1 }, emailActions: { flexDirection: 'row', gap: spacing[2] }, empty: { ...card.base, alignItems: 'center', paddingVertical: spacing[8], gap: spacing[2] },
  field: { gap: spacing[2] }, fieldLabel: { ...typography.eyebrow, color: semanticColors.textMuted }, input: { minHeight: 48, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, backgroundColor: semanticColors.elevated, color: semanticColors.text, paddingHorizontal: spacing[3] }, choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }, choice: { minHeight: 40, paddingHorizontal: spacing[3], borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, choiceActive: { backgroundColor: semanticColors.primary, borderColor: semanticColors.primary }, choiceText: { ...typography.bodySmall, color: semanticColors.textMuted }, choiceTextActive: { ...typography.bodySmall, color: semanticColors.textInverse, fontWeight: '700' }, switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
});
