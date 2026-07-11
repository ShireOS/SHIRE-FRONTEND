import {
  REPORT_SECTIONS,
  deleteReportRecipient,
  fetchReportPreference,
  fetchReportRecipients,
  fetchRestaurantReport,
  generateStaffReportInsight,
  saveReportPreference,
  saveReportRecipient,
  sendTestReportRecipient,
  type ReportPreference,
  type ReportRecipient,
  type ReportSectionId,
  type RestaurantReport,
} from '@/api/restaurantReports';
import { color_pallet, semanticColors } from '@/styles/colors';
import { typography } from '@/styles/typography';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { getOwnerRestaurant } from '../../packages/supabase';

const SECTION_LABELS: Record<ReportSectionId, string> = {
  sales_revenue: 'Sales & revenue',
  top_bottom_sellers: 'Top & bottom sellers',
  average_check: 'Average check',
  employee_reports: 'Employee reports',
  payroll_support: 'Payroll support',
  punch_log: 'Punch log',
  z_report: 'End-of-day Z report',
  daily_summary: 'Daily summary',
};
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PERIODS = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom' },
] as const;
type PeriodPreset = typeof PERIODS[number]['id'];
type ComparisonMode = 'previous_period' | 'previous_year' | 'custom';
type ReportRange = {
  start: string;
  end: string;
  comparisonStart: string;
  comparisonEnd: string;
};
const DEFAULT_PREFERENCE: ReportPreference = {
  visible_sections: [...REPORT_SECTIONS],
  section_order: [...REPORT_SECTIONS],
  section_settings: {},
};
const EMPTY_RECIPIENT: Omit<ReportRecipient, 'id'> = {
  name: '',
  email: '',
  frequency: 'daily',
  sections: ['sales_revenue', 'daily_summary'],
  send_time: '07:00',
  timezone: 'America/Chicago',
  weekday: 1,
  month_day: 1,
  is_active: true,
};

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shiftDate(value: string | Date, amount: number) {
  const date = typeof value === 'string' ? parseDateKey(value) : new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function periodRange(preset: Exclude<PeriodPreset, 'custom'>, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  if (preset === 'month') start.setDate(1);
  else if (preset === 'quarter') start.setMonth(Math.floor(end.getMonth() / 3) * 3, 1);
  else if (preset === 'year') start.setMonth(0, 1);
  else start.setDate(end.getDate() - ((end.getDay() + 6) % 7));
  return { start: toDateKey(start), end: toDateKey(end) };
}

function comparisonRange(startKey: string, endKey: string, mode: Exclude<ComparisonMode, 'custom'>) {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  if (mode === 'previous_year') {
    start.setFullYear(start.getFullYear() - 1);
    end.setFullYear(end.getFullYear() - 1);
    return { comparisonStart: toDateKey(start), comparisonEnd: toDateKey(end) };
  }
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const comparisonEnd = shiftDate(start, -1);
  const comparisonStart = shiftDate(comparisonEnd, -(dayCount - 1));
  return { comparisonStart: toDateKey(comparisonStart), comparisonEnd: toDateKey(comparisonEnd) };
}

function initialRange(): ReportRange {
  const range = periodRange('week');
  return { ...range, ...comparisonRange(range.start, range.end, 'previous_period') };
}

function validDateRange(start: string, end: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end;
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function formatNumber(value: unknown, digits = 0) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(Number(value || 0));
}

function formatPercent(value: unknown) {
  return value == null ? '—' : `${formatNumber(value, 1)}%`;
}

export default function RestaurantReportsScreen() {
  const params = useLocalSearchParams<{ restaurantId?: string; restaurantName?: string }>();
  const router = useRouter();
  const width = useWindowDimensions().width;
  const passedRestaurantId = param(params.restaurantId);
  const [restaurantId, setRestaurantId] = useState(passedRestaurantId || '');
  const [restaurantName, setRestaurantName] = useState(param(params.restaurantName) || 'Restaurant');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('week');
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [dateRange, setDateRange] = useState<ReportRange>(initialRange);
  const [dateDraft, setDateDraft] = useState(() => ({ start: initialRange().start, end: initialRange().end }));
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('previous_period');
  const [compareDraft, setCompareDraft] = useState(() => ({ ...initialRange(), mode: 'previous_period' as ComparisonMode, enabled: false }));
  const [basis, setBasis] = useState<'units' | 'revenue' | 'margin'>('revenue');
  const [daypart, setDaypart] = useState('');
  const [report, setReport] = useState<RestaurantReport | null>(null);
  const [preference, setPreference] = useState<ReportPreference>(DEFAULT_PREFERENCE);
  const [recipients, setRecipients] = useState<ReportRecipient[]>([]);
  const [canManageRecipients, setCanManageRecipients] = useState(false);
  const [emailDelivery, setEmailDelivery] = useState({ enabled: false, reason: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'period' | 'dates' | 'compare' | 'config' | 'email' | null>(null);
  const [insights, setInsights] = useState<Record<string, { loading?: boolean; data?: any; error?: string }>>({});

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

  const applyPrimaryRange = (range: { start: string; end: string }, preset: PeriodPreset = 'custom') => {
    const comparison = comparisonMode === 'custom'
      ? { comparisonStart: dateRange.comparisonStart, comparisonEnd: dateRange.comparisonEnd }
      : comparisonRange(range.start, range.end, comparisonMode);
    setPeriodPreset(preset);
    setDateRange({ ...range, ...comparison });
  };

  const selectPeriod = (preset: PeriodPreset) => {
    if (preset === 'custom') {
      setDateDraft({ start: dateRange.start, end: dateRange.end });
      setModal('dates');
      return;
    }
    applyPrimaryRange(periodRange(preset), preset);
    setModal(null);
  };

  const updateCompareMode = (mode: ComparisonMode) => {
    const comparison = mode === 'custom'
      ? { comparisonStart: compareDraft.comparisonStart, comparisonEnd: compareDraft.comparisonEnd }
      : comparisonRange(dateRange.start, dateRange.end, mode);
    setCompareDraft({ ...compareDraft, ...comparison, mode });
  };

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
        include_comparison: String(comparisonEnabled),
        top_n: '10',
        rank_basis: basis,
      });
      if (comparisonEnabled) {
        query.set('comparison_start_date', dateRange.comparisonStart);
        query.set('comparison_end_date', dateRange.comparisonEnd);
      }
      if (daypart) query.set('daypart', daypart);
      const [nextReport, nextPreference, recipientData] = await Promise.all([
        fetchRestaurantReport(restaurantId, query),
        fetchReportPreference(restaurantId),
        fetchReportRecipients(restaurantId),
      ]);
      setReport(nextReport);
      setPreference(nextPreference);
      setRecipients(recipientData.recipients || []);
      setCanManageRecipients(Boolean(recipientData.can_manage));
      setEmailDelivery({
        enabled: Boolean(recipientData.delivery_enabled),
        reason: recipientData.delivery_disabled_reason || '',
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }, [basis, comparisonEnabled, dateRange.comparisonEnd, dateRange.comparisonStart, dateRange.end, dateRange.start, daypart, restaurantId]);

  useEffect(() => { load().catch(() => undefined); }, [load]);

  const savePreference = async (next: ReportPreference) => {
    if (!restaurantId) return;
    const saved = await saveReportPreference(restaurantId, next);
    setPreference(saved);
  };
  const saveRecipient = async (draft: Omit<ReportRecipient, 'id'>, id?: string) => {
    if (!restaurantId) return;
    await saveReportRecipient(restaurantId, draft, id);
    const next = await fetchReportRecipients(restaurantId);
    setRecipients(next.recipients || []);
  };
  const removeRecipient = async (id: string) => {
    if (!restaurantId) return;
    await deleteReportRecipient(restaurantId, id);
    setRecipients((current) => current.filter((recipient) => recipient.id !== id));
  };
  const testRecipient = async (id: string) => {
    if (!restaurantId) throw new Error('Restaurant is unavailable.');
    const result = await sendTestReportRecipient(restaurantId, id);
    const next = await fetchReportRecipients(restaurantId);
    setRecipients(next.recipients || []);
    return result;
  };
  const generateInsight = async (staffId: string) => {
    if (!restaurantId) return;
    setInsights((current) => ({ ...current, [staffId]: { loading: true } }));
    try {
      const data = await generateStaffReportInsight(restaurantId, staffId, dateRange.start, dateRange.end);
      setInsights((current) => ({ ...current, [staffId]: { data } }));
    } catch (nextError) {
      setInsights((current) => ({ ...current, [staffId]: { error: nextError instanceof Error ? nextError.message : 'Could not generate insight.' } }));
    }
  };

  const sections = report?.sections || ({} as RestaurantReport['sections']);
  const visibleSections = preference.section_order.filter((id) => preference.visible_sections.includes(id));
  const statWidth = width >= 800 ? '31.5%' : '48%';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} stickyHeaderIndices={[0]}>
        <View style={styles.stickyHeader}>
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              {passedRestaurantId && <Pressable onPress={() => router.back()} style={styles.backButton}><Feather name="arrow-left" size={17} color={semanticColors.textMuted} /><Text style={styles.backText}>Portfolio</Text></Pressable>}
              <Text style={styles.eyebrow}>Restaurant reports</Text>
              <Text style={styles.title} numberOfLines={1}>{restaurantName}</Text>
              <Text style={styles.dateCopy}>{dateRange.start} — {dateRange.end}</Text>
            </View>
          </View>
          <View style={styles.headerActionRow}>
            <IconAction icon="calendar" label="Compare" onPress={() => { setCompareDraft({ ...dateRange, mode: comparisonMode, enabled: comparisonEnabled }); setModal('compare'); }} />
            <IconAction icon="settings" label="Configure" onPress={() => setModal('config')} />
            <IconAction icon="mail" label="Email" onPress={() => setModal('email')} />
            <IconAction icon="refresh-cw" label="Refresh" onPress={() => load()} />
          </View>
          <View style={styles.periodBar}>
            <Pressable accessibilityLabel="Reporting period" onPress={() => setModal('period')} style={styles.periodButton}>
              <Text style={styles.periodLabel}>Period</Text>
              <View style={styles.periodValueRow}><Text style={styles.periodValue}>{PERIODS.find((period) => period.id === periodPreset)?.label}</Text><Feather name="chevron-down" size={15} color={semanticColors.textMuted} /></View>
            </Pressable>
            <Pressable accessibilityLabel="Custom report dates" onPress={() => { setDateDraft({ start: dateRange.start, end: dateRange.end }); setModal('dates'); }} style={styles.dateButton}>
              <Text style={styles.periodLabel}>From</Text><Text numberOfLines={1} style={styles.dateValue}>{dateRange.start}</Text>
            </Pressable>
            <Pressable accessibilityLabel="Custom report dates" onPress={() => { setDateDraft({ start: dateRange.start, end: dateRange.end }); setModal('dates'); }} style={styles.dateButton}>
              <Text style={styles.periodLabel}>Through</Text><Text numberOfLines={1} style={styles.dateValue}>{dateRange.end}</Text>
            </Pressable>
          </View>
          {comparisonEnabled && <View style={styles.comparisonBanner}><Feather name="bar-chart-2" size={15} color={semanticColors.primary} /><Text style={styles.comparisonText}><Text style={styles.comparisonStrong}>Comparison active: </Text>{dateRange.comparisonStart} — {dateRange.comparisonEnd}</Text></View>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label="All dayparts" active={!daypart} onPress={() => setDaypart('')} />
            {['breakfast', 'lunch', 'dinner', 'late_night'].map((item) => <Chip key={item} label={item.replace('_', ' ')} active={daypart === item} onPress={() => setDaypart(item)} />)}
          </ScrollView>
        </View>

        {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
        {loading && !report ? <View style={styles.loading}><ActivityIndicator color={semanticColors.primary} /></View> : null}

        {report && visibleSections.map((id) => {
          const section = sections?.[id];
          if (!section) return null;
          if (id === 'sales_revenue') return <SalesSection key={id} section={section} statWidth={statWidth} comparisonEnabled={comparisonEnabled} />;
          if (id === 'top_bottom_sellers') return <RankingSection key={id} section={section} basis={basis} onBasis={setBasis} />;
          if (id === 'average_check') return <AverageSection key={id} section={section} statWidth={statWidth} comparisonEnabled={comparisonEnabled} />;
          if (id === 'employee_reports') return <EmployeeSection key={id} section={section} insights={insights} onInsight={generateInsight} />;
          if (id === 'payroll_support') return <PayrollSection key={id} section={section} statWidth={statWidth} comparisonEnabled={comparisonEnabled} />;
          if (id === 'punch_log') return <PunchSection key={id} section={section} statWidth={statWidth} />;
          if (id === 'z_report') return <ZReportSection key={id} section={section} />;
          return <DailySection key={id} section={section} statWidth={statWidth} comparisonEnabled={comparisonEnabled} />;
        })}
      </ScrollView>

      <PeriodModal visible={modal === 'period'} selected={periodPreset} onClose={() => setModal(null)} onSelect={selectPeriod} />
      <DateRangeModal visible={modal === 'dates'} draft={dateDraft} onChange={setDateDraft} onClose={() => setModal(null)} onApply={() => { applyPrimaryRange(dateDraft); setModal(null); }} />
      <ComparisonModal visible={modal === 'compare'} draft={compareDraft} onChange={setCompareDraft} onMode={updateCompareMode} onClose={() => setModal(null)} onApply={() => { setComparisonMode(compareDraft.mode); setComparisonEnabled(compareDraft.enabled); setDateRange((current) => ({ ...current, comparisonStart: compareDraft.comparisonStart, comparisonEnd: compareDraft.comparisonEnd })); setModal(null); }} />
      <ConfigModal visible={modal === 'config'} preference={preference} onClose={() => setModal(null)} onSave={savePreference} />
      <EmailModal visible={modal === 'email'} recipients={recipients} canManage={canManageRecipients} deliveryEnabled={emailDelivery.enabled} disabledReason={emailDelivery.reason} defaultTimezone={report?.restaurant?.timezone} onClose={() => setModal(null)} onSave={saveRecipient} onDelete={removeRecipient} onTest={testRecipient} />
    </View>
  );
}

function ReportSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <View style={styles.section}><View><Text style={styles.sectionTitle}>{title}</Text>{subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}</View>{children}</View>;
}

function Stat({ label, value, width, comparison, comparisonFormat = formatNumber, invertDelta = false }: { label: string; value: string; width: number | `${number}%`; comparison?: any; comparisonFormat?: (value: unknown) => string; invertDelta?: boolean }) {
  const delta = comparison?.delta == null ? null : Number(comparison.delta);
  const favorable = delta == null ? true : invertDelta ? delta <= 0 : delta >= 0;
  return <View style={[styles.stat, { width }]}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>{delta != null && <Text style={[styles.deltaText, favorable ? styles.deltaPositive : styles.deltaNegative]} numberOfLines={2}>{delta >= 0 ? '+' : '-'}{comparisonFormat(Math.abs(delta))} from comparison{comparison.percent_change != null ? ` (${delta >= 0 ? '+' : ''}${formatPercent(comparison.percent_change)})` : ''}</Text>}</View>;
}

function Disclosure({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={styles.disclosure}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((current) => !current)} style={styles.disclosureButton}><Text style={styles.disclosureTitle}>{title} <Text style={styles.disclosureCount}>({formatNumber(count)})</Text></Text><Feather name={open ? 'chevron-down' : 'chevron-right'} size={18} color={semanticColors.textMuted} /></Pressable>{open && <View style={styles.disclosureBody}>{children}</View>}</View>;
}

function SalesSection({ section, statWidth, comparisonEnabled }: { section: any; statWidth: any; comparisonEnabled: boolean }) {
  const summary = section.summary || {};
  const comparison = comparisonEnabled ? section.comparison || {} : {};
  return <ReportSection title="Sales & revenue" subtitle="Profit after labor is net revenue minus recorded wages; other costs are not included yet."><View style={styles.statGrid}><Stat width={statWidth} label="Net sales" value={formatMoney(summary.net_revenue)} comparison={comparison.net_revenue} comparisonFormat={formatMoney} /><Stat width={statWidth} label="Employee cost" value={formatMoney(summary.labor_cost)} comparison={comparison.labor_cost} comparisonFormat={formatMoney} invertDelta /><Stat width={statWidth} label="Profit after labor" value={formatMoney(summary.labor_adjusted_profit)} comparison={comparison.labor_adjusted_profit} comparisonFormat={formatMoney} /><Stat width={statWidth} label="Units" value={formatNumber(summary.units_sold)} comparison={comparison.units_sold} /><Stat width={statWidth} label="Item margin" value={formatMoney(summary.item_margin)} comparison={comparison.item_margin} comparisonFormat={formatMoney} /><Stat width={statWidth} label="Tickets" value={formatNumber(summary.ticket_count)} comparison={comparison.ticket_count} /></View><DataTable columns={[['name', 'Item'], ['category', 'Category'], ['units', 'Units'], ['revenue', 'Revenue'], ['margin', 'Margin']]} rows={section.items || []} formatters={{ revenue: formatMoney, margin: formatMoney }} /></ReportSection>;
}

function RankingSection({ section, basis, onBasis }: { section: any; basis: string; onBasis: (value: any) => void }) {
  return <ReportSection title="Top & bottom sellers"><View style={styles.chipRow}>{['units', 'revenue', 'margin'].map((item) => <Chip key={item} label={item} active={basis === item} onPress={() => onBasis(item)} />)}</View><Text style={styles.subhead}>Top</Text><DataTable columns={[['name', 'Item'], ['units', 'Units'], ['revenue', 'Revenue'], ['margin', 'Margin']]} rows={section.top || []} formatters={{ revenue: formatMoney, margin: formatMoney }} /><Text style={styles.subhead}>Bottom</Text><DataTable columns={[['name', 'Item'], ['units', 'Units'], ['revenue', 'Revenue'], ['margin', 'Margin']]} rows={section.bottom || []} formatters={{ revenue: formatMoney, margin: formatMoney }} /></ReportSection>;
}

function AverageSection({ section, statWidth, comparisonEnabled }: { section: any; statWidth: any; comparisonEnabled: boolean }) {
  const summary = section.summary || {};
  const comparison = comparisonEnabled ? section.comparison || {} : {};
  return <ReportSection title="Average check"><View style={styles.statGrid}><Stat width={statWidth} label="Average check" value={formatMoney(summary.average_check)} comparison={comparison.average_check} comparisonFormat={formatMoney} /><Stat width={statWidth} label="Items / ticket" value={formatNumber(summary.average_items_per_ticket, 2)} comparison={comparison.average_items_per_ticket} comparisonFormat={(value) => formatNumber(value, 2)} /><Stat width={statWidth} label="Tickets" value={formatNumber(summary.ticket_count)} comparison={comparison.ticket_count} /></View><DataTable columns={[['server_name', 'Server'], ['tickets', 'Tickets'], ['average_check', 'Avg check'], ['average_items_per_ticket', 'Items']]} rows={section.by_server || []} formatters={{ average_check: formatMoney }} /></ReportSection>;
}

function MobileInsight({ insight }: { insight?: { loading?: boolean; data?: any; error?: string } }) {
  if (insight?.loading) return <View style={styles.insight}><ActivityIndicator size="small" color={semanticColors.primary} /><Text style={styles.insightSummary}>Generating contextual analysis...</Text></View>;
  if (insight?.error) return <View style={[styles.insight, styles.insightError]}><Text style={styles.insightErrorText}>{insight.error}</Text></View>;
  if (!insight?.data) return null;
  const analysis = insight.data.analysis || insight.data.recommendations || {};
  const peer = analysis.peer_context || insight.data.metrics_snapshot?.peer_context || {};
  const history = analysis.history_context || insight.data.metrics_snapshot?.history_context || {};
  const workload = analysis.workload_context || insight.data.metrics_snapshot?.workload_context || {};
  const standing = String(peer.overall_standing || 'not ranked').replaceAll('_', ' ');
  return <View style={styles.insight}><Text style={styles.insightSummary}>{analysis.summary || insight.data.insight_text}</Text><View style={styles.insightBadges}>{peer.overall_rank && <Text style={styles.insightBadge}>Rank {peer.overall_rank} of {peer.cohort_size}</Text>}<Text style={styles.insightBadge}>{standing}</Text>{history.available && <Text style={styles.insightBadge}>{history.trend}</Text>}</View><Text style={styles.insightHeading}>Peer context</Text><Text style={styles.insightCopy}>{analysis.peer_assessment || `${formatNumber(peer.overall_percentile, 1)} percentile among ${peer.cohort_label || 'staff'}.`}</Text><Text style={styles.insightHeading}>Personal history</Text><Text style={styles.insightCopy}>{analysis.history_assessment || 'No prior-period comparison is available.'}</Text><Text style={styles.insightHeading}>Workload estimate</Text><Text style={styles.insightCopy}>{formatNumber(workload.tables_or_checks_handled)} tables/checks across {formatNumber(workload.hours_worked, 1)} hours · {workload.workload_estimated_turn_minutes == null ? '—' : `${formatNumber(workload.workload_estimated_turn_minutes, 1)} min`} rough interval</Text>{analysis.strengths?.length > 0 && <Text style={styles.insightCopy}><Text style={styles.insightStrong}>Strengths: </Text>{analysis.strengths.join(' · ')}</Text>}{analysis.areas_to_watch?.length > 0 && <Text style={styles.insightCopy}><Text style={styles.insightStrong}>Watch: </Text>{analysis.areas_to_watch.join(' · ')}</Text>}{analysis.recommendations?.length > 0 && <Text style={styles.insightCopy}><Text style={styles.insightStrong}>Next: </Text>{analysis.recommendations.join(' · ')}</Text>}{analysis.caveats?.length > 0 && <Text style={styles.insightCaveat}>{analysis.caveats.join(' ')}</Text>}</View>;
}

function EmployeeSection({ section, insights, onInsight }: { section: any; insights: Record<string, { loading?: boolean; data?: any; error?: string }>; onInsight: (id: string) => void }) {
  return <ReportSection title="Employee reports">{(section.staff || []).map((staff: any) => <View key={staff.staff_id} style={styles.employeeRow}><View style={styles.employeeHeader}><View><Text style={styles.rowTitle}>{staff.staff_name}</Text><Text style={styles.rowMeta}>{staff.role || 'Staff'} · {formatMoney(staff.revenue)} · {formatNumber(staff.ticket_count)} tickets</Text></View><Pressable disabled={insights[staff.staff_id]?.loading} onPress={() => onInsight(staff.staff_id)} style={styles.smallButton}><Feather name="zap" size={13} color={semanticColors.text} /><Text style={styles.smallButtonText}>{insights[staff.staff_id]?.loading ? 'Working' : 'AI'}</Text></Pressable></View><View style={styles.metricLine}><Text style={styles.rowMeta}>Avg {formatMoney(staff.average_check)}</Text><Text style={styles.rowMeta}>Tip {formatPercent(staff.average_tip_percentage)}</Text><Text style={styles.rowMeta}>Add-on {formatPercent(staff.upsell_attachment_rate)}</Text><Text style={styles.rowMeta}>Index {formatNumber(staff.quick_index, 1)}</Text></View><MobileInsight insight={insights[staff.staff_id]} /></View>)}</ReportSection>;
}

function PayrollSection({ section, statWidth, comparisonEnabled }: { section: any; statWidth: any; comparisonEnabled: boolean }) {
  const totals = section.totals || {};
  const comparison = comparisonEnabled ? section.comparison || {} : {};
  return <ReportSection title="Payroll support"><View style={styles.statGrid}><Stat width={statWidth} label="Regular hours" value={formatNumber(totals.regular_hours, 1)} comparison={comparison.regular_hours} comparisonFormat={(value) => formatNumber(value, 1)} invertDelta /><Stat width={statWidth} label="Overtime" value={formatNumber(totals.overtime_hours, 1)} comparison={comparison.overtime_hours} comparisonFormat={(value) => formatNumber(value, 1)} invertDelta /><Stat width={statWidth} label="Wages owed" value={formatMoney(totals.wages_owed)} comparison={comparison.wages_owed} comparisonFormat={formatMoney} invertDelta /><Stat width={statWidth} label="Tips earned" value={formatMoney(totals.tips_earned)} comparison={comparison.tips_earned} comparisonFormat={formatMoney} /></View><DataTable columns={[['staff_name', 'Employee'], ['regular_hours', 'Regular'], ['overtime_hours', 'OT'], ['wages_owed', 'Wages'], ['tips_earned', 'Tips']]} rows={section.employees || []} formatters={{ wages_owed: formatMoney, tips_earned: formatMoney }} /></ReportSection>;
}

function PunchSection({ section, statWidth }: { section: any; statWidth: any }) {
  const summary = section.summary || {};
  const entries = section.entries || [];
  return <ReportSection title="Punch log"><View style={styles.statGrid}><Stat width={statWidth} label="Punches" value={formatNumber(summary.punches)} /><Stat width={statWidth} label="Missed" value={formatNumber(summary.missed_punches)} /><Stat width={statWidth} label="Edits" value={formatNumber(summary.manual_edits)} /></View><Disclosure title="Punch entries" count={entries.length}><DataTable columns={[['staff_name', 'Employee'], ['clock_in_at', 'Clock in'], ['clock_out_at', 'Clock out'], ['hours', 'Hours'], ['source', 'Source']]} rows={entries} formatters={{ clock_in_at: (value) => new Date(value as string).toLocaleString(), clock_out_at: (value) => value ? new Date(value as string).toLocaleString() : 'Missing' }} /></Disclosure></ReportSection>;
}

function ZReportSection({ section }: { section: any }) {
  const transactions = section.transactions || [];
  return <ReportSection title="End-of-day Z report"><Text style={styles.subhead}>Daily closes</Text><DataTable columns={[['business_date', 'Date'], ['closed_by_name', 'Closed by'], ['closed_at', 'Closed at']]} rows={section.daily_closes || []} formatters={{ closed_at: (value) => new Date(value as string).toLocaleString() }} /><Text style={styles.subhead}>Payment mix</Text><DataTable columns={[['business_date', 'Date'], ['payment_method', 'Method'], ['payments', 'Count'], ['amount', 'Amount'], ['expected_deposit', 'Deposit']]} rows={section.payment_mix || []} formatters={{ amount: formatMoney, expected_deposit: formatMoney }} /><Disclosure title="Transactions" count={transactions.length}><DataTable columns={[['order_number', 'Check'], ['completed_at', 'Completed'], ['waiter_name', 'Server'], ['payment_method', 'Method'], ['amount', 'Amount'], ['tip_amount', 'Tip']]} rows={transactions} formatters={{ completed_at: (value) => new Date(value as string).toLocaleString(), amount: formatMoney, tip_amount: formatMoney }} /></Disclosure></ReportSection>;
}

function DailySection({ section, statWidth, comparisonEnabled }: { section: any; statWidth: any; comparisonEnabled: boolean }) {
  const summary = section.summary || {};
  const comparison = comparisonEnabled ? section.comparison || {} : {};
  return <ReportSection title={`Daily summary · ${section.business_date || ''}`} subtitle="Profit after labor excludes food and other operating costs."><View style={styles.statGrid}><Stat width={statWidth} label="Net sales" value={formatMoney(summary.net_revenue)} comparison={comparison.net_revenue} comparisonFormat={formatMoney} /><Stat width={statWidth} label="Employee cost" value={formatMoney(summary.labor_cost)} comparison={comparison.labor_cost} comparisonFormat={formatMoney} invertDelta /><Stat width={statWidth} label="Profit after labor" value={formatMoney(summary.labor_adjusted_profit)} comparison={comparison.labor_adjusted_profit} comparisonFormat={formatMoney} /><Stat width={statWidth} label="Tickets" value={formatNumber(summary.ticket_count)} comparison={comparison.ticket_count} /><Stat width={statWidth} label="Labor %" value={formatPercent(summary.labor_pct)} /></View>{(section.flags || []).map((flag: any, index: number) => <View key={`${flag.message}-${index}`} style={styles.flag}><Text style={styles.flagText}>{flag.message}</Text></View>)}<DataTable columns={[['name', 'Top item'], ['units', 'Units'], ['revenue', 'Revenue'], ['margin', 'Margin']]} rows={section.top_items || []} formatters={{ revenue: formatMoney, margin: formatMoney }} /></ReportSection>;
}

function DataTable({ columns, rows, formatters = {} }: { columns: [string, string][]; rows: any[]; formatters?: Record<string, (value: unknown) => string> }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}><View style={styles.table}><View style={[styles.tableRow, styles.tableHead]}>{columns.map(([key, label]) => <Text key={key} style={styles.tableHeadCell}>{label}</Text>)}</View>{rows.map((row, index) => <View key={row.id || row.staff_id || row.menu_item_id || `${index}`} style={styles.tableRow}>{columns.map(([key]) => <Text key={key} style={styles.tableCell} numberOfLines={1}>{formatters[key] ? formatters[key](row[key]) : String(row[key] ?? '—')}</Text>)}</View>)}{!rows.length && <Text style={styles.emptyText}>No records in this period.</Text>}</View></ScrollView>;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function IconAction({ icon, label, onPress, disabled = false }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.iconButton, disabled && styles.buttonDisabled]}><Feather name={icon} size={18} color={semanticColors.text} /></Pressable>;
}

function PeriodModal({ visible, selected, onClose, onSelect }: { visible: boolean; selected: PeriodPreset; onClose: () => void; onSelect: (value: PeriodPreset) => void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><ModalHeader title="Reporting period" onClose={onClose} />{PERIODS.map((period) => <Pressable key={period.id} onPress={() => onSelect(period.id)} style={styles.optionRow}><Text style={styles.optionText}>{period.label}</Text>{selected === period.id && <Feather name="check" size={18} color={semanticColors.primary} />}</Pressable>)}</View></View></Modal>;
}

function DateRangeModal({ visible, draft, onChange, onClose, onApply }: { visible: boolean; draft: { start: string; end: string }; onChange: (value: { start: string; end: string }) => void; onClose: () => void; onApply: () => void }) {
  const valid = validDateRange(draft.start, draft.end);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><ModalHeader title="Custom date range" onClose={onClose} /><View style={styles.form}><LabeledInput label="From (YYYY-MM-DD)" value={draft.start} onChangeText={(start) => onChange({ ...draft, start })} keyboardType="numbers-and-punctuation" /><LabeledInput label="Through (YYYY-MM-DD)" value={draft.end} onChangeText={(end) => onChange({ ...draft, end })} keyboardType="numbers-and-punctuation" />{!valid && <Text style={styles.validationText}>Enter valid dates with From on or before Through.</Text>}<Pressable disabled={!valid} onPress={onApply} style={[styles.primaryButton, !valid && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>Apply dates</Text></Pressable></View></View></View></Modal>;
}

function ComparisonModal({ visible, draft, onChange, onMode, onClose, onApply }: { visible: boolean; draft: ReportRange & { mode: ComparisonMode; enabled: boolean }; onChange: (value: ReportRange & { mode: ComparisonMode; enabled: boolean }) => void; onMode: (value: ComparisonMode) => void; onClose: () => void; onApply: () => void }) {
  const valid = validDateRange(draft.comparisonStart, draft.comparisonEnd);
  const modes: { id: ComparisonMode; label: string }[] = [
    { id: 'previous_period', label: 'Previous equal period' },
    { id: 'previous_year', label: 'Same period last year' },
    { id: 'custom', label: 'Custom period' },
  ];
  const invalid = draft.enabled && !valid;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><ModalHeader title="Comparison period" onClose={onClose} /><View style={styles.form}><View style={styles.comparisonControl}><Text style={styles.comparisonControlLabel}>Comparison</Text><Switch accessibilityLabel="Toggle comparison" value={draft.enabled} onValueChange={(enabled) => onChange({ ...draft, enabled })} trackColor={{ false: semanticColors.borderStrong, true: color_pallet.sky[300] }} thumbColor={draft.enabled ? semanticColors.primary : color_pallet.stone[100]} /></View><View pointerEvents={draft.enabled ? 'auto' : 'none'} style={!draft.enabled && styles.disabledSection}>{modes.map((mode) => <Pressable key={mode.id} onPress={() => onMode(mode.id)} style={styles.optionRow}><Text style={styles.optionText}>{mode.label}</Text><Feather name={draft.mode === mode.id ? 'check-circle' : 'circle'} size={18} color={draft.mode === mode.id ? semanticColors.primary : semanticColors.textMuted} /></Pressable>)}<View style={styles.comparisonDateFields}><LabeledInput label="Comparison from" value={draft.comparisonStart} onChangeText={(comparisonStart) => onChange({ ...draft, comparisonStart, mode: 'custom' })} keyboardType="numbers-and-punctuation" /><LabeledInput label="Comparison through" value={draft.comparisonEnd} onChangeText={(comparisonEnd) => onChange({ ...draft, comparisonEnd, mode: 'custom' })} keyboardType="numbers-and-punctuation" /></View></View>{invalid && <Text style={styles.validationText}>Enter a valid comparison range.</Text>}<Pressable disabled={invalid} onPress={onApply} style={[styles.primaryButton, invalid && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>Save comparison</Text></Pressable></View></View></View></Modal>;
}

function ConfigModal({ visible, preference, onClose, onSave }: { visible: boolean; preference: ReportPreference; onClose: () => void; onSave: (value: ReportPreference) => Promise<void> }) {
  const [selected, setSelected] = useState<ReportSectionId[]>(preference.visible_sections);
  const [saving, setSaving] = useState(false);
  useEffect(() => setSelected(preference.visible_sections), [preference.visible_sections]);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><ModalHeader title="Visible report sections" onClose={onClose} /><ScrollView style={styles.modalScroll}>{REPORT_SECTIONS.map((id) => <Pressable key={id} onPress={() => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} style={styles.toggleRow}><Feather name={selected.includes(id) ? 'check-square' : 'square'} size={20} color={selected.includes(id) ? semanticColors.primary : semanticColors.textMuted} /><Text style={styles.toggleText}>{SECTION_LABELS[id]}</Text></Pressable>)}</ScrollView><Pressable disabled={saving || !selected.length} onPress={async () => { setSaving(true); await onSave({ ...preference, visible_sections: selected }); setSaving(false); onClose(); }} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save layout'}</Text></Pressable></View></View></Modal>;
}

function EmailModal({
  visible, recipients, canManage, deliveryEnabled, disabledReason, defaultTimezone,
  onClose, onSave, onDelete, onTest,
}: {
  visible: boolean;
  recipients: ReportRecipient[];
  canManage: boolean;
  deliveryEnabled: boolean;
  disabledReason: string;
  defaultTimezone?: string;
  onClose: () => void;
  onSave: (value: Omit<ReportRecipient, 'id'>, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTest: (id: string) => Promise<{ message: string }>;
}) {
  const [draft, setDraft] = useState<Omit<ReportRecipient, 'id'> | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const edit = (recipient?: ReportRecipient) => {
    setEditingId(recipient?.id);
    setDraft(recipient ? {
      name: recipient.name || '', email: recipient.email, frequency: recipient.frequency,
      sections: recipient.sections, send_time: String(recipient.send_time || '07:00').slice(0, 5),
      timezone: recipient.timezone, weekday: recipient.weekday, month_day: recipient.month_day,
      is_active: recipient.is_active,
    } : { ...EMPTY_RECIPIENT, timezone: defaultTimezone || EMPTY_RECIPIENT.timezone });
  };
  const sendTest = async (recipient: ReportRecipient) => {
    setTestingId(recipient.id);
    setMessage('');
    try {
      const result = await onTest(recipient.id);
      setMessage(result.message || `Test report accepted for ${recipient.email}`);
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : 'Could not send test report.');
    } finally {
      setTestingId(null);
    }
  };
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage('');
    try {
      await onSave(draft, editingId);
      setDraft(null);
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : 'Could not save recipient.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}>
        <ModalHeader title="Scheduled report recipients" onClose={onClose} />
        {!deliveryEnabled && <View style={styles.warningBox}><Text style={styles.warningText}>{disabledReason || 'Email delivery is not configured.'}</Text></View>}
        {message ? <Text style={styles.statusMessage}>{message}</Text> : null}
        <ScrollView style={styles.modalScroll}>
          {draft ? (
            <View style={styles.form}>
              <LabeledInput label="Name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
              <LabeledInput label="Email" value={draft.email} onChangeText={(email) => setDraft({ ...draft, email })} keyboardType="email-address" />
              <LabeledInput label="Send time (24-hour)" value={String(draft.send_time).slice(0, 5)} onChangeText={(send_time) => setDraft({ ...draft, send_time })} placeholder="07:00" />
              <LabeledInput label="Timezone" value={draft.timezone} onChangeText={(timezone) => setDraft({ ...draft, timezone })} placeholder="America/Chicago" />
              <Text style={styles.inputLabel}>Frequency</Text>
              <View style={styles.chipRow}>{(['daily', 'weekly', 'monthly'] as const).map((frequency) => <Chip key={frequency} label={frequency} active={draft.frequency === frequency} onPress={() => setDraft({ ...draft, frequency })} />)}</View>
              {draft.frequency === 'weekly' && <><Text style={styles.inputLabel}>Send day</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{DAY_LABELS.map((label, weekday) => <Chip key={label} label={label} active={(draft.weekday ?? 1) === weekday} onPress={() => setDraft({ ...draft, weekday })} />)}</ScrollView></>}
              {draft.frequency === 'monthly' && <LabeledInput label="Day of month (1-28)" value={String(draft.month_day ?? 1)} onChangeText={(value) => setDraft({ ...draft, month_day: Math.max(1, Math.min(28, Number(value) || 1)) })} keyboardType="number-pad" />}
              <View style={styles.optionRow}><Text style={styles.optionText}>Active schedule</Text><Switch value={draft.is_active} onValueChange={(is_active) => setDraft({ ...draft, is_active })} /></View>
              <Text style={styles.inputLabel}>Sections</Text>
              {REPORT_SECTIONS.map((id) => <Pressable key={id} onPress={() => setDraft({ ...draft, sections: draft.sections.includes(id) ? draft.sections.filter((item) => item !== id) : [...draft.sections, id] })} style={styles.toggleRow}><Feather name={draft.sections.includes(id) ? 'check-square' : 'square'} size={19} color={semanticColors.primary} /><Text style={styles.toggleText}>{SECTION_LABELS[id]}</Text></Pressable>)}
              <View style={styles.modalActions}><Pressable onPress={() => setDraft(null)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable><Pressable disabled={saving || !draft.email || !draft.sections.length} onPress={save} style={[styles.primaryButton, (saving || !draft.email || !draft.sections.length) && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save'}</Text></Pressable></View>
            </View>
          ) : <>
            {recipients.map((recipient) => <View key={recipient.id} style={styles.recipientRow}><View style={styles.recipientCopy}><Text style={styles.rowTitle}>{recipient.name || recipient.email}</Text><Text style={styles.rowMeta}>{recipient.email} · {recipient.frequency} · {String(recipient.send_time).slice(0, 5)}</Text><Text style={styles.rowMeta} numberOfLines={2}>{recipient.sections.map((id) => SECTION_LABELS[id]).join(', ')}</Text><Text style={styles.rowMeta}>{recipient.last_delivery_status ? `Last delivery: ${recipient.last_delivery_status}` : 'No deliveries yet'}</Text></View>{canManage && <View style={styles.iconActions}><IconAction icon="send" label="Send test" disabled={!deliveryEnabled || testingId === recipient.id} onPress={() => sendTest(recipient)} /><IconAction icon="edit-2" label="Edit" onPress={() => edit(recipient)} /><IconAction icon="trash-2" label="Delete" onPress={() => onDelete(recipient.id)} /></View>}</View>)}
            {!recipients.length && <Text style={styles.emptyText}>No scheduled recipients.</Text>}
            {canManage && <Pressable onPress={() => edit()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Add recipient</Text></Pressable>}
          </>}
        </ScrollView>
      </View></View>
    </Modal>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return <View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={onClose} style={styles.iconButton}><Feather name="x" size={19} color={semanticColors.text} /></Pressable></View>;
}

function LabeledInput({ label, ...props }: { label: string } & ComponentProps<typeof TextInput>) {
  return <View><Text style={styles.inputLabel}>{label}</Text><TextInput {...props} autoCapitalize="none" style={styles.input} placeholderTextColor={semanticColors.textMuted} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: semanticColors.background },
  content: { paddingBottom: 48 },
  stickyHeader: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, backgroundColor: semanticColors.background, borderBottomWidth: 1, borderBottomColor: semanticColors.border },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  titleCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...typography.eyebrow, color: semanticColors.textMuted, textTransform: 'uppercase' },
  title: { ...typography.h1, color: semanticColors.text, letterSpacing: 0, marginTop: 3 },
  dateCopy: { ...typography.caption, color: semanticColors.textMuted, marginTop: 3 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  backText: { ...typography.caption, color: semanticColors.textMuted, fontWeight: '700' },
  iconActions: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  headerActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7, marginTop: 9 },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: semanticColors.border, backgroundColor: color_pallet.elevated.DEFAULT },
  periodBar: { flexDirection: 'row', gap: 8, marginTop: 10 },
  periodButton: { flex: 1.15, minWidth: 104, minHeight: 52, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: semanticColors.border, backgroundColor: color_pallet.elevated.DEFAULT },
  dateButton: { flex: 1, minWidth: 88, minHeight: 52, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: semanticColors.border, backgroundColor: color_pallet.elevated.DEFAULT },
  periodLabel: { ...typography.eyebrow, color: semanticColors.textMuted, textTransform: 'uppercase' },
  periodValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 4 },
  periodValue: { ...typography.caption, flex: 1, color: semanticColors.text, fontWeight: '700' },
  dateValue: { ...typography.caption, color: semanticColors.text, fontWeight: '700', marginTop: 4 },
  comparisonControl: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: semanticColors.border, backgroundColor: color_pallet.elevated.DEFAULT },
  comparisonControlLabel: { ...typography.bodySmall, color: semanticColors.text, fontWeight: '700' },
  comparisonDateFields: { gap: 12, marginTop: 12 },
  disabledSection: { opacity: 0.4 },
  comparisonBanner: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: color_pallet.amber[600], backgroundColor: color_pallet.amber[100] },
  comparisonText: { ...typography.caption, flex: 1, color: color_pallet.ink[700] },
  comparisonStrong: { fontWeight: '700', color: color_pallet.ink[900] },
  chipRow: { flexDirection: 'row', gap: 7, paddingTop: 10, paddingBottom: 2 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticColors.border, backgroundColor: color_pallet.elevated.DEFAULT },
  chipActive: { backgroundColor: color_pallet.ink[900], borderColor: color_pallet.ink[900] },
  chipText: { ...typography.caption, color: semanticColors.textMuted, textTransform: 'capitalize' },
  chipTextActive: { color: color_pallet.cream[50], fontWeight: '700' },
  loading: { minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  errorBox: { margin: 18, padding: 13, borderRadius: 7, backgroundColor: '#FEE2E2' },
  errorText: { ...typography.bodySmall, color: '#991B1B' },
  section: { paddingHorizontal: 18, paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: semanticColors.border, gap: 14 },
  sectionTitle: { ...typography.h2, color: semanticColors.text, letterSpacing: 0 },
  sectionSubtitle: { ...typography.bodySmall, color: semanticColors.textMuted, marginTop: 4 },
  subhead: { ...typography.caption, color: semanticColors.text, fontWeight: '700', marginTop: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { minHeight: 108, padding: 12, borderRadius: 7, borderWidth: 1, borderColor: semanticColors.border, backgroundColor: color_pallet.elevated.DEFAULT },
  statLabel: { ...typography.eyebrow, color: semanticColors.textMuted, textTransform: 'uppercase' },
  statValue: { ...typography.h2, color: semanticColors.text, marginTop: 7, letterSpacing: 0 },
  deltaText: { ...typography.caption, marginTop: 5, fontWeight: '700' },
  deltaPositive: { color: '#047857' },
  deltaNegative: { color: '#B91C1C' },
  disclosure: { borderTopWidth: 1, borderColor: semanticColors.border, paddingTop: 5 },
  disclosureButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 4 },
  disclosureTitle: { ...typography.bodySmall, color: semanticColors.text, fontWeight: '700' },
  disclosureCount: { color: semanticColors.textMuted, fontWeight: '400' },
  disclosureBody: { paddingTop: 4 },
  tableScroll: { maxWidth: '100%' },
  table: { minWidth: 680, borderTopWidth: 1, borderColor: semanticColors.border },
  tableRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: semanticColors.border },
  tableHead: { backgroundColor: color_pallet.stone[100] },
  tableHeadCell: { width: 136, paddingHorizontal: 10, ...typography.eyebrow, color: semanticColors.textMuted, textTransform: 'uppercase' },
  tableCell: { width: 136, paddingHorizontal: 10, ...typography.caption, color: semanticColors.text },
  emptyText: { ...typography.bodySmall, color: semanticColors.textMuted, paddingVertical: 24, textAlign: 'center' },
  employeeRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: semanticColors.border, gap: 7 },
  employeeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowTitle: { ...typography.body, color: semanticColors.text, fontWeight: '700' },
  rowMeta: { ...typography.caption, color: semanticColors.textMuted, marginTop: 2 },
  metricLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  smallButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 32, borderRadius: 6, borderWidth: 1, borderColor: semanticColors.border },
  smallButtonText: { ...typography.caption, color: semanticColors.text, fontWeight: '700' },
  insight: { marginTop: 8, gap: 7, padding: 11, borderRadius: 6, borderWidth: 1, borderColor: color_pallet.amber[600], backgroundColor: color_pallet.amber[100] },
  insightSummary: { ...typography.bodySmall, color: color_pallet.ink[900] },
  insightBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  insightBadge: { ...typography.caption, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, color: color_pallet.ink[800], backgroundColor: color_pallet.cream[50], textTransform: 'capitalize' },
  insightHeading: { ...typography.eyebrow, color: color_pallet.ink[700], textTransform: 'uppercase', marginTop: 3 },
  insightCopy: { ...typography.caption, color: color_pallet.ink[700] },
  insightStrong: { fontWeight: '700', color: color_pallet.ink[900] },
  insightCaveat: { ...typography.caption, color: color_pallet.ink[500], marginTop: 3, paddingTop: 7, borderTopWidth: 1, borderTopColor: color_pallet.amber[600] },
  insightError: { borderColor: color_pallet.danger[600], backgroundColor: color_pallet.danger[50] },
  insightErrorText: { ...typography.bodySmall, color: color_pallet.danger[700] },
  flag: { padding: 10, borderRadius: 6, backgroundColor: color_pallet.amber[100] },
  flagText: { ...typography.bodySmall, color: color_pallet.ink[800] },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 620, maxHeight: '88%', padding: 18, borderRadius: 8, backgroundColor: semanticColors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { ...typography.h2, color: semanticColors.text, letterSpacing: 0 },
  modalScroll: { maxHeight: 620 },
  optionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderColor: semanticColors.border },
  optionText: { ...typography.bodySmall, color: semanticColors.text, fontWeight: '600' },
  toggleRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: semanticColors.border },
  toggleText: { ...typography.bodySmall, color: semanticColors.text },
  primaryButton: { minHeight: 43, paddingHorizontal: 16, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: color_pallet.ink[900], marginTop: 14 },
  primaryButtonText: { ...typography.caption, color: color_pallet.cream[50], fontWeight: '700' },
  buttonDisabled: { opacity: 0.4 },
  secondaryButton: { minHeight: 43, paddingHorizontal: 16, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: semanticColors.border },
  secondaryButtonText: { ...typography.caption, color: semanticColors.text, fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  form: { gap: 12 },
  inputLabel: { ...typography.eyebrow, color: semanticColors.textMuted, textTransform: 'uppercase', marginBottom: 5 },
  input: { minHeight: 43, paddingHorizontal: 12, borderWidth: 1, borderColor: semanticColors.border, borderRadius: 7, color: semanticColors.text, backgroundColor: color_pallet.elevated.DEFAULT },
  validationText: { ...typography.caption, color: '#B91C1C' },
  warningBox: { padding: 10, marginBottom: 10, borderRadius: 6, backgroundColor: color_pallet.amber[100] },
  warningText: { ...typography.bodySmall, color: color_pallet.ink[800] },
  statusMessage: { ...typography.bodySmall, color: semanticColors.textMuted, marginBottom: 10 },
  recipientRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderColor: semanticColors.border },
  recipientCopy: { flex: 1 },
});
