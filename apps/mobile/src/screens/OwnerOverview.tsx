import {
  fetchOwnerAnalytics,
  type AnalyticsPeriod,
  type HourlySalesBucket,
  type MenuSalesItem,
  type OwnerAnalyticsPayload,
} from '@/api/ownerAnalytics';
import { color_pallet, semanticColors, statusColors } from '@/styles/colors';
import { shadowMd } from '@/styles/shadows';
import { card, divider, layout, radius, spacing } from '@/styles/tokens';
import { typography } from '@/styles/typography';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getOwnerRestaurant, type OwnerRestaurant } from '../../packages/supabase';

const PERIODS: { id: AnalyticsPeriod; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'full', label: 'Full' },
];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateLabel(date: Date) {
  const today = toDateKey(new Date());
  const yesterday = toDateKey(addDays(new Date(), -1));
  const key = toDateKey(date);
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatCurrency(value: unknown) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatNumber(value: unknown, digits = 0) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatMinutes(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 'DNE';
  return `${Math.round(number)}m`;
}

function firstDefined<T>(...values: T[]) {
  return values.find((value) => value !== null && value !== undefined);
}

export default function OwnerOverview() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<OwnerRestaurant | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>('day');
  const [date, setDate] = useState(() => new Date());
  const [payload, setPayload] = useState<OwnerAnalyticsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateKey = toDateKey(date);

  useEffect(() => {
    let cancelled = false;

    async function loadRestaurant() {
      try {
        const nextRestaurant = await getOwnerRestaurant();
        if (!cancelled) setRestaurant(nextRestaurant);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load restaurant.');
          setIsLoading(false);
        }
      }
    }

    loadRestaurant();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restaurant?.id) {
      if (restaurant === null) setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchOwnerAnalytics(restaurant.id, period, dateKey, {
      onRevalidate: (data) => {
        if (!cancelled) setPayload(data);
      },
    })
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load analytics.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dateKey, period, restaurant]);

  const metrics = useMemo(() => buildMetrics(payload), [payload]);
  const salesBars = useMemo(() => buildSalesBars(payload), [payload]);
  const menuItems = payload?.sections?.menu?.items || [];

  const openChecks = () => {
    if (!restaurant?.id) return;
    router.push(
      `/owner-checks?restaurantId=${encodeURIComponent(restaurant.id)}&restaurantName=${encodeURIComponent(restaurant.name)}&date=${encodeURIComponent(dateKey)}`,
    );
  };

  if (!restaurant && !isLoading && !error) {
    return (
      <View style={styles.centerState}>
        <Text style={[typography.h2, styles.stateTitle]}>Owner access required</Text>
        <Text style={[typography.bodySmall, styles.stateCopy]}>
          This account is not attached to an owner restaurant.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heading}>
        <View>
          <Text style={[typography.eyebrow, styles.eyebrow]}>{restaurant?.name || 'Restaurant'}</Text>
          <Text style={[typography.h2, styles.title]}>Overview</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={() => setDate(new Date())}>
          <Feather name="rotate-cw" size={18} color={color_pallet.ink[700]} />
        </Pressable>
      </View>

      <View style={styles.dateBar}>
        <Pressable style={styles.dateArrow} onPress={() => setDate((value) => addDays(value, -1))}>
          <Feather name="chevron-left" size={20} color={color_pallet.cream[50]} />
        </Pressable>
        <View style={styles.dateLabelGroup}>
          <Text style={[typography.caption, styles.dateLabel]}>{formatDateLabel(date)}</Text>
          <Text style={[typography.eyebrow, styles.dateSubLabel]}>{dateKey}</Text>
        </View>
        <Pressable style={styles.dateArrow} onPress={() => setDate((value) => addDays(value, 1))}>
          <Feather name="chevron-right" size={20} color={color_pallet.cream[50]} />
        </Pressable>
      </View>

      <View style={styles.periodRow}>
        {PERIODS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setPeriod(item.id)}
            style={[styles.periodPill, period === item.id && styles.periodPillActive]}
          >
            <Text style={[styles.periodText, period === item.id && styles.periodTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading && (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={color_pallet.sky[700]} />
          <Text style={[typography.bodySmall, styles.loadingText]}>Loading owner analytics...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorCard}>
          <Text style={[typography.caption, styles.errorTitle]}>Analytics unavailable</Text>
          <Text style={[typography.bodySmall, styles.errorCopy]}>{error}</Text>
        </View>
      )}

      {!isLoading && !error && (
        <>
          <Pressable style={[styles.salesCard, shadowMd]} onPress={openChecks}>
            <View style={styles.cardHeader}>
              <Text style={[typography.eyebrow, styles.cardEyebrow]}>Sales</Text>
              <Feather name="chevron-right" size={18} color={color_pallet.ink[500]} />
            </View>
            <Text style={[typography.metric, styles.salesValue]}>{formatCurrency(metrics.sales)}</Text>
            <Text style={[typography.caption, styles.salesDetail]}>
              {formatNumber(metrics.orders)} orders · {formatCurrency(metrics.avgOrder)} avg order
            </Text>
            <SparkBars values={salesBars} color={color_pallet.danger[600]} />
          </Pressable>

          <View style={styles.metricGrid}>
            <MetricTile label="Covers" value={formatNumber(metrics.covers)} />
            <MetricTile label="Turn Time" value={formatMinutes(metrics.turnTime)} />
            <MetricTile label="Team" value={formatNumber(metrics.team)} detail="staffed" />
            <MetricTile label="Labor Cost" value="DNE" detail="Pending" muted />
          </View>

          <View style={styles.section}>
            <Text style={[typography.h3, styles.sectionTitle]}>Today at a glance</Text>
            <MetricRow label="Orders" value={formatNumber(metrics.orders)} detail="Tap to inspect checks" onPress={openChecks} />
            <MetricRow label="Avg Check" value={formatCurrency(metrics.avgOrder)} />
            <MetricRow label="Tips" value={formatCurrency(metrics.tips)} />
            <MetricRow label="Card Deposit" value={formatCurrency(metrics.cardDeposit)} detail={metrics.processorFeesPending ? 'Fees pending' : 'After known fees'} muted={metrics.processorFeesPending} />
            <MetricRow label="Processing Fees" value={formatCurrency(metrics.processorFees)} detail={metrics.configuredFeeInSales ? 'Card price stays in sales' : 'Known fees'} muted={metrics.processorFeesPending} />
            <MetricRow label="SPLH" value="DNE" detail="Needs labor feed" muted />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[typography.h3, styles.sectionTitle]}>Item sales</Text>
              <Text style={[typography.caption, styles.sectionHint]}>{menuItems.length} items</Text>
            </View>
            {menuItems.length > 0 ? (
              menuItems.slice(0, 5).map((item, index) => (
                <MenuRow key={`${item.name || 'item'}-${index}`} item={item} />
              ))
            ) : (
              <Text style={[typography.bodySmall, styles.emptyText]}>No item sales for this range.</Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function buildMetrics(payload: OwnerAnalyticsPayload | null) {
  const revenue = payload?.sections?.revenue?.data || {};
  const visits = payload?.sections?.visits?.data || {};
  const staff = payload?.sections?.staff?.data || {};

  return {
    sales: firstDefined(revenue.sales, revenue.sales_excluding_tax_tip, revenue.net_sales, revenue.total_revenue),
    orders: revenue.order_count,
    avgOrder: revenue.avg_order_value,
    tips: revenue.tips,
    processorFees: revenue.processor_fees_known,
    processorFeesPending: Boolean(revenue.processor_fees_pending),
    cardDeposit: revenue.card_deposit_estimate,
    configuredFeeInSales: Boolean(revenue.configured_fee_in_sales),
    covers: visits.covers,
    turnTime: visits.avg_turn_minutes,
    team: firstDefined(staff.staff_worked, staff.shift_count),
  };
}

function buildSalesBars(payload: OwnerAnalyticsPayload | null) {
  const rows: HourlySalesBucket[] = payload?.sections?.time_series?.revenue || [];
  return rows.slice(-10).map((row) => Number(row.revenue || 0)).filter((value) => value > 0);
}

function SparkBars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  const displayValues = values.length > 0 ? values : [0, 0, 0, 0, 0, 0, 0, 0];

  return (
    <View style={styles.sparkWrap}>
      {displayValues.map((value, index) => {
        const height = value > 0 ? 8 + (value / max) * 34 : 10;
        return (
          <View
            key={`${value}-${index}`}
            style={[
              styles.sparkBar,
              {
                height,
                backgroundColor: value > 0 ? color : color_pallet.stone[200],
                opacity: value > 0 ? 1 : 0.65,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function MetricTile({
  label,
  value,
  detail,
  muted,
}: {
  label: string;
  value: string;
  detail?: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.metricTile}>
      <Text style={[typography.caption, styles.tileLabel]}>{label}</Text>
      <Text style={[typography.h2, styles.tileValue, muted && styles.mutedText]}>{value}</Text>
      {detail && <Text style={[typography.caption, styles.tileDetail]}>{detail}</Text>}
    </View>
  );
}

function MetricRow({
  label,
  value,
  detail,
  muted,
  onPress,
}: {
  label: string;
  value: string;
  detail?: string;
  muted?: boolean;
  onPress?: () => void;
}) {
  const Content = (
    <View style={styles.metricRow}>
      <View>
        <Text style={[typography.caption, styles.rowLabel]}>{label}</Text>
        {detail && <Text style={[typography.caption, styles.rowDetail]}>{detail}</Text>}
      </View>
      <View style={styles.rowValueGroup}>
        <Text style={[typography.title, styles.rowValue, muted && styles.mutedText]}>{value}</Text>
        {onPress && <Feather name="chevron-right" size={16} color={color_pallet.ink[500]} />}
      </View>
    </View>
  );

  if (!onPress) return Content;
  return <Pressable onPress={onPress}>{Content}</Pressable>;
}

function MenuRow({ item }: { item: MenuSalesItem }) {
  return (
    <View style={styles.metricRow}>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[typography.caption, styles.rowLabel]}>
          {item.name || 'Menu item'}
        </Text>
        <Text style={[typography.caption, styles.rowDetail]}>
          {item.category || 'Uncategorized'} · {formatNumber(item.quantity)} sold
        </Text>
      </View>
      <Text style={[typography.title, styles.rowValue]}>{formatCurrency(item.revenue)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color_pallet.bg.DEFAULT,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[1],
    paddingBottom: 128,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: color_pallet.ink[500],
  },
  title: {
    color: color_pallet.ink[900],
    marginTop: 2,
  },
  refreshButton: {
    width: layout.controlHeightSmall,
    height: layout.controlHeightSmall,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: semanticColors.border,
  },
  dateBar: {
    marginTop: spacing[4],
    minHeight: layout.controlHeight,
    borderRadius: radius.md,
    backgroundColor: color_pallet.ink[700],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[2],
  },
  dateArrow: {
    width: layout.controlHeightSmall,
    height: layout.controlHeightSmall,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabelGroup: {
    alignItems: 'center',
  },
  dateLabel: {
    color: color_pallet.cream[50],
  },
  dateSubLabel: {
    color: 'rgba(250,250,250,0.62)',
    fontSize: 10,
    marginTop: spacing[1] / 2,
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  periodPill: {
    flex: 1,
    minHeight: layout.controlHeightSmall,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: semanticColors.border,
  },
  periodPillActive: {
    backgroundColor: color_pallet.elevated.dark,
    borderColor: color_pallet.elevated.dark,
  },
  periodText: {
    color: color_pallet.ink[600],
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  periodTextActive: {
    color: color_pallet.cream[50],
  },
  loadingCard: {
    ...card.base,
    marginTop: spacing[5],
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[2],
    color: color_pallet.ink[500],
  },
  errorCard: {
    marginTop: spacing[5],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: statusColors.danger.border,
    backgroundColor: statusColors.danger.bg,
    padding: spacing[4],
  },
  errorTitle: {
    color: color_pallet.danger[600],
  },
  errorCopy: {
    color: color_pallet.ink[700],
    marginTop: 4,
  },
  salesCard: {
    ...card.base,
    marginTop: spacing[5],
    padding: spacing[5],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardEyebrow: {
    color: color_pallet.ink[500],
  },
  salesValue: {
    marginTop: spacing[3],
    color: color_pallet.ink[900],
    fontSize: 42,
  },
  salesDetail: {
    color: color_pallet.ink[500],
    marginTop: spacing[1],
  },
  sparkWrap: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[1],
    marginTop: spacing[4],
  },
  sparkBar: {
    width: 7,
    borderRadius: 4,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginTop: spacing[3],
  },
  metricTile: {
    ...card.base,
    width: '48.4%',
    padding: spacing[4],
  },
  tileLabel: {
    color: color_pallet.ink[500],
  },
  tileValue: {
    color: color_pallet.ink[900],
    marginTop: spacing[2],
  },
  tileDetail: {
    color: color_pallet.ink[500],
    marginTop: spacing[1] / 2,
  },
  section: {
    marginTop: spacing[6],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: divider.backgroundColor,
    paddingTop: spacing[4],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: color_pallet.ink[900],
    marginBottom: spacing[2],
  },
  sectionHint: {
    color: color_pallet.ink[500],
  },
  metricRow: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: semanticColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
  },
  rowLabel: {
    color: color_pallet.ink[800],
  },
  rowDetail: {
    color: color_pallet.ink[500],
    marginTop: spacing[1] / 2,
  },
  rowValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowValue: {
    color: color_pallet.ink[900],
    textAlign: 'right',
  },
  mutedText: {
    color: color_pallet.ink[500],
  },
  emptyText: {
    color: color_pallet.ink[500],
    paddingVertical: spacing[3],
  },
  centerState: {
    flex: 1,
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color_pallet.bg.DEFAULT,
  },
  stateTitle: {
    color: color_pallet.ink[900],
    textAlign: 'center',
  },
  stateCopy: {
    color: color_pallet.ink[500],
    marginTop: 8,
    textAlign: 'center',
  },
});
