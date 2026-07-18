import {
  downloadHomepageWidgetPdf,
  fetchHomepageData,
  fetchHomepagePreferences,
  fetchReportingDimensions,
  saveHomepagePreferences,
  type HomepagePreferences,
  type WidgetCatalogItem,
  type WidgetData,
  type WidgetPdfPayload,
  type WidgetScope,
  type WidgetSettings,
  type ReportingDimensions,
} from '@/api/homepageWidgets';
import type { PortfolioPeriod } from '@/api/portfolioReports';
import { semanticColors, statusColors } from '@/styles/colors';
import { card, layout, radius, spacing } from '@/styles/tokens';
import { typography } from '@/styles/typography';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import Svg, { Line, Polyline } from 'react-native-svg';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

const KPI_WIDGETS = new Set(['net_sales', 'orders', 'covers', 'labor_cost', 'profit_after_labor', 'average_check', 'tips', 'deposits']);
const GRAINS = ['total', 'day', 'week', 'month'] as const;

const money = (value: unknown) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const number = (value: unknown) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(value || 0));
function format(value: unknown, kind = 'text') {
  if (value == null) return '—';
  if (kind === 'money') return money(value);
  if (kind === 'percent') return `${number(value)}%`;
  if (kind === 'minutes') return `${number(value)} min`;
  if (kind === 'number') return number(value);
  if (kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString();
  }
  if (kind === 'date') return new Date(String(value)).toLocaleDateString();
  return String(value);
}
function dateKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function periodDates(period: PortfolioPeriod, anchorDate?: string | null) {
  const end = anchorDate ? new Date(`${anchorDate}T12:00:00`) : new Date(); const start = new Date(end);
  if (period === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  else if (period === 'month') start.setDate(1);
  else if (period === 'year') { start.setMonth(0); start.setDate(1); }
  else if (period === 'full') start.setFullYear(2000, 0, 1);
  return { start: dateKey(start), end: dateKey(end) };
}

type Props = { scope: WidgetScope; restaurantId?: string; period: PortfolioPeriod; anchorDate?: string | null; groupIds?: string[] | null; includeUngrouped?: boolean; onWidgetPress?: (widgetId: string) => void };

export default function HomepageWidgets({ scope, restaurantId, period, anchorDate, groupIds = null, includeUngrouped = false, onWidgetPress }: Props) {
  const [preferences, setPreferences] = useState<HomepagePreferences | null>(null);
  const [data, setData] = useState<Record<string, WidgetData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configure, setConfigure] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<ReportingDimensions | null>(null);
  const groupKey = JSON.stringify(groupIds);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const requestedGroupIds = JSON.parse(groupKey) as string[] | null;
      const [next, nextDimensions] = await Promise.all([
        fetchHomepagePreferences(scope, restaurantId),
        fetchReportingDimensions(scope, restaurantId, requestedGroupIds, includeUngrouped),
      ]);
      setPreferences(next);
      setDimensions(nextDimensions);
      const ids = next.widget_order.filter((id) => next.visible_widgets.includes(id));
      const portfolioScope = scope === 'portfolio'
        ? { ...(requestedGroupIds?.length ? { group_ids: requestedGroupIds } : {}), include_ungrouped: includeUngrouped }
        : {};
      const payload = await fetchHomepageData(scope, restaurantId, { period, anchor_date: anchorDate, widget_ids: ids, widget_settings: next.widget_settings, ...portfolioScope });
      setData(payload.widgets || {});
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Could not load homepage widgets.'); }
    finally { setLoading(false); }
  }, [anchorDate, groupKey, includeUngrouped, period, restaurantId, scope]);
  useEffect(() => { void load(); }, [load]);
  const save = async (next: Omit<HomepagePreferences, 'catalog'>) => {
    if (!preferences) return;
    const saved = await saveHomepagePreferences(scope, restaurantId, next);
    setPreferences(saved); setConfigure(false); setSettingsId(null); await load();
  };
  const ordered = useMemo(() => preferences?.widget_order.filter((id) => preferences.visible_widgets.includes(id)) || [], [preferences]);
  const selectedWidget = preferences?.catalog.find((item) => item.id === settingsId);
  if (loading && !preferences) return <ActivityIndicator color={semanticColors.primary} style={styles.loader} />;
  return <View style={styles.wrap}>
    <Pressable onPress={() => setConfigure(true)} style={styles.configureButton}><Feather name="sliders" size={15} color={semanticColors.textMuted} /><Text style={styles.configureText}>Customize homepage</Text></Pressable>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {ordered.map((id) => {
      const widget = preferences?.catalog.find((item) => item.id === id); if (!widget) return null;
      return <Widget key={id} widget={widget} data={data[id]} settings={preferences?.widget_settings[id] || {}} onSettings={() => setSettingsId(id)} onPress={onWidgetPress ? () => onWidgetPress(id) : undefined} />;
    })}
    {configure && preferences ? <ConfigureSheet preferences={preferences} onClose={() => setConfigure(false)} onSave={save} /> : null}
    {selectedWidget && preferences ? <SettingsSheet widget={selectedWidget} widgetData={data[settingsId!]} dimensions={dimensions} settings={preferences.widget_settings[settingsId!] || {}} period={period} anchorDate={anchorDate} scope={scope} restaurantId={restaurantId} groupIds={groupIds} includeUngrouped={includeUngrouped} onClose={() => setSettingsId(null)} onSave={(next) => save({ visible_widgets: preferences.visible_widgets, widget_order: preferences.widget_order, widget_settings: { ...preferences.widget_settings, [settingsId!]: next } })} /> : null}
  </View>;
}

function Widget({ widget, data, settings, onSettings, onPress }: { widget: WidgetCatalogItem; data?: WidgetData; settings: WidgetSettings; onSettings: () => void; onPress?: () => void }) {
  const measures = data?.measure_columns || []; const rows = data?.rows || [];
  if (KPI_WIDGETS.has(widget.id)) {
    const column = measures[0] || widget.columns[0]; const row = rows[0] || {};
    const secondary = measures.slice(1, 3);
    const content = <View style={styles.metricCard}><WidgetHeader widget={widget} onSettings={onSettings} /><Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{format(row[column.id], column.kind)}</Text><Text style={styles.muted}>{column.label}</Text>{secondary.length ? <View style={styles.metricSecondaryRow}>{secondary.map((item) => <View key={item.id} style={styles.metricSecondary}><Text style={styles.eyebrow}>{item.label.toUpperCase()}</Text><Text style={styles.metricSecondaryValue}>{format(row[item.id], item.kind)}</Text></View>)}</View> : null}</View>;
    return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
  }
  if (widget.id === 'discount_review') return <DiscountReviewWidget widget={widget} data={data} onSettings={onSettings} />;
  if (widget.id === 'menu_performance') return <MenuPerformanceWidget widget={widget} data={data} settings={settings} onSettings={onSettings} />;
  if (widget.id === 'sales_trend' || settings.display_mode === 'chart') {
    const column = measures[0] || widget.columns[0];
    return <View style={styles.card}><WidgetHeader widget={widget} onSettings={onSettings} /><GraphRows rows={rows} column={column} chartType={settings.chart_type || (widget.id === 'sales_trend' ? 'line' : 'bar')} /></View>;
  }
  const dimensions = data?.dimension_columns || [];
  if (!dimensions.length && rows.length <= 1 && measures.length > 1) return <SummaryWidget widget={widget} data={data} onSettings={onSettings} />;
  return <View style={styles.card}><WidgetHeader widget={widget} onSettings={onSettings} />{rows.length ? rows.map((row, index) => <View key={`${row.period}-${row.breakdown}-${index}`} style={styles.tableRow}><View style={styles.flex}><Text numberOfLines={1} style={styles.rowTitle}>{dimensions.map((id) => format(row[id], id === 'period' ? 'date' : 'text')).join(' · ') || `Row ${index + 1}`}</Text><Text style={styles.muted}>{measures.slice(1, 3).map((column) => `${column.label}: ${format(row[column.id], column.kind)}`).join(' · ')}</Text></View>{measures[0] ? <Text style={styles.rowValue}>{format(row[measures[0].id], measures[0].kind)}</Text> : null}</View>) : <Text style={styles.empty}>No data for this range.</Text>}</View>;
}

function DiscountReviewWidget({ widget, data, onSettings }: { widget: WidgetCatalogItem; data?: WidgetData; onSettings: () => void }) {
  const summary = data?.summary || {};
  const employees = (data?.employees || []).filter((employee) => employee.action_count > 0).slice(0, 8);
  const alerts = data?.alerts || [];
  const reasons = data?.reasons || [];
  const maxAmount = Math.max(1, ...employees.map((employee) => Number(employee.total_amount || 0)));
  return <View style={styles.card}>
    <WidgetHeader widget={widget} onSettings={onSettings} />
    <View style={styles.summaryGrid}>
      {[['Total impact', summary.total_amount, 'money'], ['Actions', summary.action_count, 'number'], ['Flagged', summary.flagged_employees, 'number'], ['Unattributed', summary.unattributed_actions, 'number']].map(([label, value, kind]) => <View key={String(label)} style={[styles.summaryMetric, label === 'Flagged' && Number(value) > 0 && styles.alertMetric]}><Text style={styles.eyebrow}>{String(label).toUpperCase()}</Text><Text style={[styles.summaryValue, label === 'Flagged' && Number(value) > 0 && styles.alertText]}>{format(value, String(kind))}</Text></View>)}
    </View>
    <Text style={styles.performanceTitle}>Employee financial impact</Text>
    {employees.map((employee) => <View key={`${employee.restaurant_id}-${employee.employee_id || 'none'}`} style={[styles.auditEmployee, employee.is_flagged && styles.auditEmployeeAlert]}><View style={styles.auditEmployeeHeader}><View style={styles.flex}><Text style={[styles.rowTitle, employee.is_flagged && styles.alertText]}>{employee.employee_name}</Text><Text style={styles.muted}>{employee.restaurant_name} · {number(employee.action_count)} actions</Text></View><Text style={[styles.rowValue, employee.is_flagged && styles.alertText]}>{money(employee.total_amount)}</Text></View><View style={styles.auditBarTrack}><View style={[styles.auditBarFill, employee.is_flagged && styles.auditBarAlert, { width: `${Math.max(2, Number(employee.total_amount) / maxAmount * 100)}%` }]} /></View></View>)}
    {alerts.length ? <><Text style={styles.performanceTitle}>Review alerts</Text>{alerts.map((employee) => <View key={`${employee.restaurant_id}-${employee.employee_id}`} style={styles.alertBox}><View style={styles.auditEmployeeHeader}><Feather name="alert-triangle" size={17} color={statusColors.danger.text} /><Text style={[styles.optionTitle, styles.alertText, styles.flex]}>{employee.employee_name}</Text></View>{employee.alert_reasons.map((reason) => <Text key={reason} style={styles.alertDetail}>{reason}</Text>)}</View>)}</> : <Text style={styles.empty}>No employees crossed the configured threshold.</Text>}
    {reasons.length ? <><Text style={styles.performanceTitle}>Reason-code activity</Text>{reasons.slice(0, 8).map((reason) => <View key={`${reason.restaurant_id}-${reason.action_type}-${reason.reason_code}`} style={styles.tableRow}><View style={styles.flex}><Text style={styles.rowTitle}>{reason.reason_label}</Text><Text style={styles.muted}>{reason.action_type.replaceAll('_', ' ')} · {reason.restaurant_name} · {number(reason.count)} actions</Text></View><View><Text style={styles.rowValue}>{money(reason.total_amount)}</Text><Text style={styles.muted}>{money(reason.average_amount)} avg</Text></View></View>)}</> : null}
  </View>;
}

function MenuPerformanceWidget({ widget, data, settings, onSettings }: { widget: WidgetCatalogItem; data?: WidgetData; settings: WidgetSettings; onSettings: () => void }) {
  const measures = data?.measure_columns || []; const rows = [...(data?.rows || [])];
  const metric = measures.find((item) => item.id === settings.sort_by) || measures.find((item) => item.id === 'revenue') || measures[0];
  rows.sort((left, right) => Number(right[metric?.id] || 0) - Number(left[metric?.id] || 0));
  const take = Math.min(5, Math.max(1, Math.ceil(rows.length / 2))); const top = rows.slice(0, take); const bottom = rows.slice(-take).reverse();
  const List = ({ title, items }: { title: string; items: Record<string, unknown>[] }) => <View style={styles.performanceColumn}><Text style={styles.performanceTitle}>{title}</Text>{items.map((row, index) => <View key={`${row.breakdown}-${index}`} style={styles.performanceRow}><View style={styles.flex}><Text numberOfLines={1} style={styles.rowTitle}>{String(row.breakdown || `Item ${index + 1}`)}</Text><Text style={styles.muted}>{measures.filter((item) => item.id !== metric?.id).slice(0, 2).map((item) => `${item.label}: ${format(row[item.id], item.kind)}`).join(' · ')}</Text></View><Text style={styles.rowValue}>{format(row[metric?.id], metric?.kind)}</Text></View>)}</View>;
  return <View style={styles.card}><WidgetHeader widget={widget} onSettings={onSettings} />{rows.length ? <><List title="Top performers" items={top} /><List title="Bottom performers" items={bottom} /></> : <Text style={styles.empty}>No menu sales for this range.</Text>}</View>;
}

function SummaryWidget({ widget, data, onSettings }: { widget: WidgetCatalogItem; data?: WidgetData; onSettings: () => void }) {
  const row = data?.rows?.[0] || {}; const measures = data?.measure_columns || [];
  return <View style={styles.card}><WidgetHeader widget={widget} onSettings={onSettings} /><View style={styles.summaryGrid}>{measures.map((item) => <View key={item.id} style={styles.summaryMetric}><Text style={styles.eyebrow}>{item.label.toUpperCase()}</Text><Text style={styles.summaryValue}>{format(row[item.id], item.kind)}</Text></View>)}</View></View>;
}
function GraphRows({ rows, column, chartType }: { rows: Record<string, unknown>[]; column: WidgetCatalogItem['columns'][number]; chartType: 'bar' | 'line' }) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(Number(row[column.id] || 0))));
  if (!rows.length) return <Text style={styles.empty}>No data for this range.</Text>;
  if (chartType === 'line' && rows.length > 1) {
    const values = rows.map((row) => Number(row[column.id] || 0));
    const low = Math.min(...values); const high = Math.max(...values); const span = Math.max(1, high - low);
    const points = values.map((value, index) => `${10 + index * (280 / Math.max(1, values.length - 1))},${105 - ((value - low) / span) * 90}`).join(' ');
    return <View><Svg width="100%" height={130} viewBox="0 0 300 120"><Line x1="10" y1="105" x2="290" y2="105" stroke={semanticColors.border} strokeWidth="1" /><Polyline points={points} fill="none" stroke={semanticColors.primary} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /></Svg><View style={styles.chartEndpoints}><Text style={styles.muted}>{format(rows[0]?.period || rows[0]?.breakdown || 'Start', rows[0]?.period ? 'date' : 'text')}</Text><Text style={styles.chartValue}>{format(values.at(-1), column.kind)}</Text><Text style={styles.muted}>{format(rows.at(-1)?.period || rows.at(-1)?.breakdown || 'End', rows.at(-1)?.period ? 'date' : 'text')}</Text></View></View>;
  }
  return <View style={styles.chartRows}>{rows.map((row, index) => <View key={`${row.period || ''}-${row.breakdown || ''}-${index}`} style={styles.chartRow}><Text numberOfLines={1} style={styles.chartLabel}>{format(row.period || row.breakdown || `Row ${index + 1}`, row.period ? 'date' : 'text')}</Text><View style={styles.chartTrack}><View style={[styles.chartFill, { width: `${Math.max(2, Math.abs(Number(row[column.id] || 0)) / max * 100)}%` }]} /></View><Text style={styles.chartValue}>{format(row[column.id], column.kind)}</Text></View>)}</View>;
}
function WidgetHeader({ widget, onSettings }: { widget: WidgetCatalogItem; onSettings: () => void }) { return <View style={styles.widgetHeader}><View style={styles.flex}><Text style={styles.eyebrow}>HOMEPAGE WIDGET</Text><Text style={styles.widgetTitle}>{widget.label}</Text></View><Pressable accessibilityLabel={`Configure ${widget.label}`} onPress={(event) => { event.stopPropagation(); onSettings(); }} style={styles.iconButton}><Feather name="settings" size={16} color={semanticColors.textMuted} /></Pressable></View>; }

function ConfigureSheet({ preferences, onClose, onSave }: { preferences: HomepagePreferences; onClose: () => void; onSave: (next: Omit<HomepagePreferences, 'catalog'>) => Promise<void> }) {
  const [visible, setVisible] = useState([...preferences.visible_widgets]); const [order, setOrder] = useState([...preferences.widget_order]); const [saving, setSaving] = useState(false);
  const selected = new Set(visible); const ordered = order.filter((id) => selected.has(id));
  const move = (id: string, delta: number) => setOrder((current) => { const next = [...current]; const index = next.indexOf(id); const target = index + delta; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });
  return <Sheet title="Configure homepage" onClose={onClose}><Text style={styles.sectionLabel}>VISIBLE WIDGETS</Text>{preferences.catalog.map((widget) => <Pressable key={widget.id} onPress={() => setVisible((current) => current.includes(widget.id) ? current.filter((id) => id !== widget.id) : [...current, widget.id])} style={[styles.option, selected.has(widget.id) && styles.optionActive]}><View style={styles.flex}><Text style={styles.optionTitle}>{widget.label}</Text><Text style={styles.muted}>{widget.description}</Text></View>{selected.has(widget.id) ? <Feather name="check" size={18} color={semanticColors.primary} /> : null}</Pressable>)}<Text style={styles.sectionLabel}>HOMEPAGE ORDER</Text>{ordered.map((id, index) => <View key={id} style={styles.orderRow}><Text style={styles.orderIndex}>{index + 1}</Text><Text style={[styles.optionTitle, styles.flex]}>{preferences.catalog.find((item) => item.id === id)?.label}</Text><Pressable disabled={index === 0} onPress={() => move(id, -1)} style={styles.iconButton}><Feather name="arrow-up" size={16} color={semanticColors.textMuted} /></Pressable><Pressable disabled={index === ordered.length - 1} onPress={() => move(id, 1)} style={styles.iconButton}><Feather name="arrow-down" size={16} color={semanticColors.textMuted} /></Pressable></View>)}<Pressable disabled={saving || !visible.length} onPress={async () => { setSaving(true); try { await onSave({ visible_widgets: visible, widget_order: order, widget_settings: preferences.widget_settings }); } finally { setSaving(false); } }} style={styles.primaryButton}><Text style={styles.primaryText}>{saving ? 'Saving...' : 'Save homepage'}</Text></Pressable></Sheet>;
}

function ReportingScopeFields<T extends WidgetSettings | WidgetPdfPayload>({ widget, dimensions, value, onChange }: { widget: WidgetCatalogItem; dimensions: ReportingDimensions | null; value: T; onChange: (value: T) => void }) {
  if (!widget.reporting_dimensions.length) return <Text style={styles.auditHelp}>This widget is restaurant-wide because its source records do not carry a reliable section or device assignment.</Text>;
  const dimension = value.scope_dimension || 'none';
  const ids = value.scope_ids || [];
  const options = dimension === 'revenue_center' ? (dimensions?.sections || []) : dimension === 'device' ? (dimensions?.devices || []) : [];
  const setDimension = (next: 'none' | 'revenue_center' | 'device') => onChange({ ...value, scope_dimension: next, scope_mode: next === 'none' ? 'cumulative' : value.scope_mode || 'cumulative', scope_ids: [] });
  const toggle = (id: string) => onChange({ ...value, scope_ids: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id] });
  return <View style={styles.scopeBox}>
    <Text style={styles.sectionLabel}>REPORTING SCOPE</Text>
    <View style={styles.choiceWrap}><ScopeChoice label="Whole restaurant" selected={dimension === 'none'} onPress={() => setDimension('none')} />{widget.reporting_dimensions.includes('revenue_center') ? <ScopeChoice label="Sections" selected={dimension === 'revenue_center'} onPress={() => setDimension('revenue_center')} /> : null}{widget.reporting_dimensions.includes('device') ? <ScopeChoice label="Devices" selected={dimension === 'device'} onPress={() => setDimension('device')} /> : null}</View>
    {dimension !== 'none' ? <><Text style={styles.muted}>No selection includes every {dimension === 'device' ? 'device' : 'section'}. Sections are used as revenue centers in reports.</Text><View style={styles.choiceWrap}><ScopeChoice label="Cumulative total" selected={(value.scope_mode || 'cumulative') === 'cumulative'} onPress={() => onChange({ ...value, scope_mode: 'cumulative' })} /><ScopeChoice label="Break down results" selected={value.scope_mode === 'breakdown'} onPress={() => onChange({ ...value, scope_mode: 'breakdown' })} /></View>{options.map((option) => <CheckRow key={option.id} label={`${option.restaurant_name ? `${option.restaurant_name} / ` : ''}${option.name}${dimension === 'device' && option.section_name ? ` (${option.section_name})` : ''}`} checked={ids.includes(option.id)} onPress={() => toggle(option.id)} />)}</> : null}
  </View>;
}

function ScopeChoice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceActive]}><Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{label}</Text></Pressable>; }

function SettingsSheet({ widget, widgetData, dimensions, settings, period, anchorDate, scope, restaurantId, groupIds, includeUngrouped, onClose, onSave }: { widget: WidgetCatalogItem; widgetData?: WidgetData; dimensions: ReportingDimensions | null; settings: WidgetSettings; period: PortfolioPeriod; anchorDate?: string | null; scope: WidgetScope; restaurantId?: string; groupIds?: string[] | null; includeUngrouped: boolean; onClose: () => void; onSave: (next: WidgetSettings) => Promise<void> }) {
  const dates = periodDates(period, anchorDate);
  const [tab, setTab] = useState<'display' | 'pdf'>('display');
  const [working, setWorking] = useState(false);
  const [display, setDisplay] = useState<WidgetSettings>({
    display_grain: settings.display_grain || (widget.id === 'sales_trend' ? 'day' : 'total'),
    display_breakdown: settings.display_breakdown || widget.default_breakdown,
    display_columns: settings.display_columns || widget.default_columns,
    display_mode: settings.display_mode || (widget.id === 'sales_trend' ? 'chart' : 'table'),
    chart_type: settings.chart_type || (widget.id === 'sales_trend' ? 'line' : 'bar'),
    sort_by: settings.sort_by || widget.default_columns[0], sort_direction: settings.sort_direction || 'desc', limit: settings.limit || 12,
    alert_z_score: settings.alert_z_score || 2, alert_min_actions: settings.alert_min_actions || 5,
    scope_dimension: settings.scope_dimension || 'none', scope_mode: settings.scope_mode || 'cumulative', scope_ids: settings.scope_ids || [],
  });
  const [pdf, setPdf] = useState<WidgetPdfPayload>({
    start_date: dates.start, end_date: dates.end, grain: widget.id === 'sales_trend' ? 'day' : 'total',
    breakdown: widget.default_breakdown, columns: [...widget.default_columns], include_chart: widget.id === 'sales_trend',
    chart_type: widget.id === 'sales_trend' ? 'line' : 'bar', title: `${widget.label} report`,
    employee_ids: [], action_types: ['discount', 'comp', 'item_void', 'check_void'], reason_codes: [],
    include_team_average: true, alert_z_score: settings.alert_z_score || 2, alert_min_actions: settings.alert_min_actions || 5,
    scope_dimension: settings.scope_dimension || 'none', scope_mode: settings.scope_mode || 'cumulative', scope_ids: settings.scope_ids || [],
    ...(scope === 'portfolio' ? { ...(groupIds?.length ? { group_ids: groupIds } : {}), include_ungrouped: includeUngrouped } : {}),
  });
  const toggle = (values: string[], value: string) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  const download = async () => {
    setWorking(true);
    try {
      const file = await downloadHomepageWidgetPdf(scope, restaurantId, widget.id, pdf);
      const uri = `${FileSystem.cacheDirectory}${file.file_name}`;
      await FileSystem.writeAsStringAsync(uri, file.base64, { encoding: FileSystem.EncodingType.Base64 });
      await Share.share({ title: file.file_name, url: uri });
    } catch (error) { Alert.alert('Could not build PDF', error instanceof Error ? error.message : 'Try again.'); }
    finally { setWorking(false); }
  };
  const displayGrains = GRAINS.filter((value) => widget.grains.includes(value) && (!KPI_WIDGETS.has(widget.id) || value === 'total'));
  const employees = (widgetData?.employees || []).filter((employee) => employee.employee_id);
  const reasons = [...new Map((widgetData?.reasons || []).map((reason) => [reason.reason_code, reason])).values()];
  const actionOptions = [['discount', 'Discounts'], ['comp', 'Comps'], ['item_void', 'Item voids'], ['check_void', 'Check voids']] as const;

  const auditDisplay = <>
    <Text style={styles.auditHelp}>Employees are flagged only after meeting the minimum sample and exceeding the selected number of standard deviations above peers at the same restaurant.</Text>
    <Text style={styles.sectionLabel}>OUTLIER THRESHOLD</Text>
    <TextInput keyboardType="decimal-pad" value={String(display.alert_z_score || 2)} onChangeText={(value) => setDisplay({ ...display, alert_z_score: Math.max(1, Math.min(5, Number(value) || 1)) })} style={styles.input} />
    <Text style={styles.muted}>Standard deviations above peers</Text>
    <Text style={styles.sectionLabel}>MINIMUM ACTIONS</Text>
    <TextInput keyboardType="number-pad" value={String(display.alert_min_actions || 5)} onChangeText={(value) => setDisplay({ ...display, alert_min_actions: Math.max(1, Math.min(100, Number(value) || 1)) })} style={styles.input} />
    <Text style={styles.muted}>Prevents one-off false alerts</Text>
  </>;
  const genericDisplay = <>
    <Text style={styles.sectionLabel}>TIME GROUPING</Text><ChoiceWrap values={displayGrains} selected={display.display_grain!} onSelect={(value) => setDisplay({ ...display, display_grain: value })} />
    {!KPI_WIDGETS.has(widget.id) ? <><Text style={styles.sectionLabel}>WIDGET VIEW</Text><ChoiceWrap values={['table', 'chart'] as const} selected={display.display_mode!} onSelect={(value) => setDisplay({ ...display, display_mode: value })} />{display.display_mode === 'chart' ? <><Text style={styles.sectionLabel}>GRAPH TYPE</Text><ChoiceWrap values={widget.charts} selected={display.chart_type!} onSelect={(value) => setDisplay({ ...display, chart_type: value })} /></> : null}</> : null}
    <Text style={styles.sectionLabel}>BREAKDOWN</Text><ChoiceWrap values={widget.breakdowns} selected={display.display_breakdown!} onSelect={(value) => setDisplay({ ...display, display_breakdown: value })} />
    <Text style={styles.sectionLabel}>VISIBLE MEASURES</Text>{widget.columns.map((column) => <CheckRow key={column.id} label={column.label} checked={(display.display_columns || []).includes(column.id)} onPress={() => setDisplay({ ...display, display_columns: toggle(display.display_columns || [], column.id) })} />)}
    <Text style={styles.sectionLabel}>SORT BY</Text><ChoiceWrap values={widget.columns.map((column) => column.id)} selected={display.sort_by!} onSelect={(value) => setDisplay({ ...display, sort_by: value })} />
    <Text style={styles.sectionLabel}>SORT DIRECTION</Text><ChoiceWrap values={['desc', 'asc'] as const} selected={display.sort_direction!} onSelect={(value) => setDisplay({ ...display, sort_direction: value })} />
    <Text style={styles.sectionLabel}>ROWS</Text><TextInput keyboardType="number-pad" value={String(display.limit || 12)} onChangeText={(value) => setDisplay({ ...display, limit: Math.max(1, Math.min(100, Number(value) || 1)) })} style={styles.input} />
  </>;
  const auditPdf = <>
    <Text style={styles.sectionLabel}>EMPLOYEES</Text><Text style={styles.muted}>No selection includes every employee.</Text>
    {employees.map((employee) => <CheckRow key={employee.employee_id!} label={`${employee.employee_name} · ${employee.restaurant_name}`} checked={(pdf.employee_ids || []).includes(employee.employee_id!)} onPress={() => setPdf({ ...pdf, employee_ids: toggle(pdf.employee_ids || [], employee.employee_id!) })} />)}
    <Text style={styles.sectionLabel}>ACTIONS</Text>{actionOptions.map(([id, label]) => <CheckRow key={id} label={label} checked={(pdf.action_types || []).includes(id)} onPress={() => setPdf({ ...pdf, action_types: toggle(pdf.action_types || [], id) as WidgetPdfPayload['action_types'] })} />)}
    {reasons.length ? <><Text style={styles.sectionLabel}>REASON CODES</Text><Text style={styles.muted}>No selection includes every reason.</Text>{reasons.map((reason) => <CheckRow key={reason.reason_code} label={reason.reason_label} checked={(pdf.reason_codes || []).includes(reason.reason_code)} onPress={() => setPdf({ ...pdf, reason_codes: toggle(pdf.reason_codes || [], reason.reason_code) })} />)}</> : null}
    <View style={styles.switchRow}><Text style={styles.optionTitle}>Include peer averages and outlier scores</Text><Switch value={pdf.include_team_average} onValueChange={(value) => setPdf({ ...pdf, include_team_average: value })} /></View>
  </>;
  const genericPdf = <>
    <Text style={styles.sectionLabel}>TIME GROUPING</Text><ChoiceWrap values={widget.grains} selected={pdf.grain} onSelect={(value) => setPdf({ ...pdf, grain: value })} />
    <Text style={styles.sectionLabel}>BREAKDOWN</Text><ChoiceWrap values={widget.breakdowns} selected={pdf.breakdown} onSelect={(value) => setPdf({ ...pdf, breakdown: value })} />
    <Text style={styles.sectionLabel}>REPORT COLUMNS</Text>{widget.columns.map((column) => <CheckRow key={column.id} label={column.label} checked={pdf.columns.includes(column.id)} onPress={() => setPdf({ ...pdf, columns: toggle(pdf.columns, column.id) })} />)}
    <View style={styles.switchRow}><Text style={styles.optionTitle}>Include graph</Text><Switch value={pdf.include_chart} onValueChange={(value) => setPdf({ ...pdf, include_chart: value })} /></View>
    {pdf.include_chart ? <ChoiceWrap values={widget.charts} selected={pdf.chart_type} onSelect={(value) => setPdf({ ...pdf, chart_type: value })} /> : null}
  </>;

  return <Sheet title={widget.label} onClose={onClose}>
    <View style={styles.tabs}><Tab label="Display" active={tab === 'display'} onPress={() => setTab('display')} /><Tab label="PDF report" active={tab === 'pdf'} onPress={() => setTab('pdf')} /></View>
    {tab === 'display' ? <><ReportingScopeFields widget={widget} dimensions={dimensions} value={display} onChange={setDisplay} />{widget.id === 'discount_review' ? auditDisplay : genericDisplay}<Pressable disabled={widget.id !== 'discount_review' && !display.display_columns?.length} onPress={() => void onSave(display)} style={styles.primaryButton}><Text style={styles.primaryText}>Save widget</Text></Pressable></> : <><View style={styles.fieldRow}><LabeledInput label="From" value={pdf.start_date} onChange={(value) => setPdf({ ...pdf, start_date: value })} /><LabeledInput label="Through" value={pdf.end_date} onChange={(value) => setPdf({ ...pdf, end_date: value })} /></View><LabeledInput label="Report title" value={pdf.title} onChange={(value) => setPdf({ ...pdf, title: value })} /><ReportingScopeFields widget={widget} dimensions={dimensions} value={pdf} onChange={setPdf} />{widget.id === 'discount_review' ? auditPdf : genericPdf}<Pressable disabled={working || (widget.id === 'discount_review' ? !pdf.action_types?.length : !pdf.columns.length)} onPress={() => void download()} style={styles.primaryButton}><Feather name="download" size={16} color={semanticColors.textInverse} /><Text style={styles.primaryText}>{working ? 'Building PDF...' : 'Download PDF'}</Text></Pressable></>}
  </Sheet>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><View style={styles.sheet}><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{title}</Text><Pressable onPress={onClose} style={styles.iconButton}><Feather name="x" size={18} color={semanticColors.textMuted} /></Pressable></View><ScrollView contentContainerStyle={styles.sheetContent}>{children}</ScrollView></View></Modal>; }
function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>; }
function ChoiceWrap<T extends string>({ values, selected, onSelect }: { values: readonly T[]; selected: T; onSelect: (value: T) => void }) { return <View style={styles.choiceWrap}>{values.map((value) => <Pressable key={value} onPress={() => onSelect(value)} style={[styles.choice, selected === value && styles.choiceActive]}><Text style={[styles.choiceText, selected === value && styles.choiceTextActive]}>{value === 'none' ? 'No breakdown' : value.replaceAll('_', ' ')}</Text></Pressable>)}</View>; }
function CheckRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.option, checked && styles.optionActive]}><Text style={[styles.optionTitle, styles.flex]}>{label}</Text>{checked ? <Feather name="check" size={18} color={semanticColors.primary} /> : null}</Pressable>; }
function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <View style={styles.field}><Text style={styles.sectionLabel}>{label.toUpperCase()}</Text><TextInput value={value} onChangeText={onChange} autoCapitalize="none" style={styles.input} /></View>; }

const styles = StyleSheet.create({
  wrap: { gap: spacing[3] }, loader: { marginVertical: spacing[8] }, error: { ...typography.bodySmall, color: statusColors.danger.text }, flex: { flex: 1 },
  configureButton: { alignSelf: 'flex-end', minHeight: 42, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2] }, configureText: { ...typography.bodySmall, fontWeight: '600', color: semanticColors.textMuted },
  metricCard: { ...card.base, minHeight: 150 }, card: { ...card.base, gap: spacing[2] }, widgetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] }, eyebrow: { ...typography.eyebrow, color: semanticColors.textSubtle }, widgetTitle: { ...typography.h3, color: semanticColors.text, marginTop: 2 }, iconButton: { width: 38, height: 38, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, metricValue: { ...typography.h1, color: semanticColors.text, marginTop: spacing[4] }, metricSecondaryRow: { flexDirection: 'row', gap: spacing[2], borderTopWidth: 1, borderTopColor: semanticColors.border, paddingTop: spacing[3], marginTop: spacing[3] }, metricSecondary: { flex: 1 }, metricSecondaryValue: { ...typography.bodySmall, color: semanticColors.text, fontWeight: '700', marginTop: 2 }, muted: { ...typography.caption, color: semanticColors.textSubtle, marginTop: 2 }, empty: { ...typography.bodySmall, color: semanticColors.textSubtle, paddingVertical: spacing[4], textAlign: 'center' },
  chartRows: { gap: spacing[2] }, chartRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] }, chartLabel: { ...typography.caption, color: semanticColors.textSubtle, width: 68 }, chartTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: semanticColors.surface, overflow: 'hidden' }, chartFill: { height: 8, borderRadius: 4, backgroundColor: semanticColors.primary }, chartValue: { ...typography.caption, color: semanticColors.textMuted, width: 82, textAlign: 'right' }, chartEndpoints: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tableRow: { flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[3], borderTopWidth: 1, borderTopColor: semanticColors.border }, rowTitle: { ...typography.bodySmall, fontWeight: '600', color: semanticColors.text }, rowValue: { ...typography.bodySmall, fontWeight: '700', color: semanticColors.text },
  performanceColumn: { gap: spacing[1], marginTop: spacing[3] }, performanceTitle: { ...typography.bodySmall, color: semanticColors.text, fontWeight: '700', marginBottom: spacing[1] }, performanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, padding: spacing[3] }, summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }, summaryMetric: { width: '48%', minHeight: 82, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, padding: spacing[3], justifyContent: 'space-between' }, summaryValue: { ...typography.h3, color: semanticColors.text },
  alertMetric: { borderColor: statusColors.danger.border, backgroundColor: statusColors.danger.bg }, alertText: { color: statusColors.danger.text }, auditEmployee: { gap: spacing[2], borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, padding: spacing[3] }, auditEmployeeAlert: { borderColor: statusColors.danger.border, backgroundColor: statusColors.danger.bg }, auditEmployeeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] }, auditBarTrack: { height: 7, borderRadius: 4, backgroundColor: semanticColors.surface, overflow: 'hidden' }, auditBarFill: { height: 7, borderRadius: 4, backgroundColor: semanticColors.primary }, auditBarAlert: { backgroundColor: statusColors.danger.text }, alertBox: { gap: spacing[2], borderWidth: 1, borderColor: statusColors.danger.border, borderRadius: radius.md, backgroundColor: statusColors.danger.bg, padding: spacing[3] }, alertDetail: { ...typography.caption, color: statusColors.danger.text, lineHeight: 18 }, auditHelp: { ...typography.bodySmall, color: semanticColors.textMuted, lineHeight: 21 },
  sheet: { flex: 1, backgroundColor: semanticColors.background }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing[5], borderBottomWidth: 1, borderBottomColor: semanticColors.border }, sheetTitle: { ...typography.h2, color: semanticColors.text }, sheetContent: { padding: layout.screenPadding, paddingBottom: spacing[16], gap: spacing[3] }, sectionLabel: { ...typography.eyebrow, color: semanticColors.textSubtle, marginTop: spacing[3] },
  option: { minHeight: 58, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3] }, optionActive: { borderColor: semanticColors.primary, backgroundColor: statusColors.info.bg }, optionTitle: { ...typography.bodySmall, fontWeight: '600', color: semanticColors.text }, orderRow: { minHeight: 52, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2] }, orderIndex: { ...typography.caption, color: semanticColors.textSubtle, width: 24 },
  primaryButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: semanticColors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }, primaryText: { ...typography.bodySmall, fontWeight: '700', color: semanticColors.textInverse }, tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: semanticColors.border }, tab: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 2, borderBottomColor: 'transparent' }, tabActive: { borderBottomColor: semanticColors.primary }, tabText: { ...typography.bodySmall, fontWeight: '600', color: semanticColors.textMuted }, tabTextActive: { color: semanticColors.text },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }, choice: { minHeight: 40, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, paddingHorizontal: spacing[3], alignItems: 'center', justifyContent: 'center' }, choiceActive: { backgroundColor: semanticColors.primary, borderColor: semanticColors.primary }, choiceText: { ...typography.bodySmall, color: semanticColors.textMuted, textTransform: 'capitalize' }, choiceTextActive: { color: semanticColors.textInverse, fontWeight: '700' },
  scopeBox: { gap: spacing[2], borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, padding: spacing[3] },
  fieldRow: { flexDirection: 'row', gap: spacing[3] }, field: { flex: 1 }, input: { minHeight: 48, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, backgroundColor: semanticColors.elevated, color: semanticColors.text, paddingHorizontal: spacing[3] }, switchRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
