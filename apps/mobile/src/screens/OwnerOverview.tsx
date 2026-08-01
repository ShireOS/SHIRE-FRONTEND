import { type AnalyticsPeriod } from '@/api/ownerAnalytics';
import { fetchManagerInbox } from '@/api/managerInbox';
import {
  fetchManagerTimeClockRequests,
  reviewTimeClockRequest,
  type TimeClockRequest,
} from '@/api/timeClock';
import { staleWhileRevalidate } from '@/cache/staleWhileRevalidate';
import { registerManagerPushToken } from '@/notifications/pushNotifications';
import { color_pallet, semanticColors, statusColors } from '@/styles/colors';
import { card, divider, layout, radius, spacing } from '@/styles/tokens';
import { typography } from '@/styles/typography';
import { Feather } from '@expo/vector-icons';
import HomepageWidgets from '@/components/HomepageWidgets';
import { fetchRestaurantViewPreferences, saveRestaurantViewPreferences } from '@/api/restaurantReports';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getOwnerRestaurant, type OwnerRestaurant } from '../../packages/supabase';

const PERIODS: { id: AnalyticsPeriod; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'full', label: 'Full' },
];
const TIME_CLOCK_REQUEST_CACHE_TTL_MS = 15_000;
const TIME_CLOCK_REQUEST_MAX_STALE_MS = 24 * 60 * 60 * 1000;

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

export default function OwnerOverview() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<OwnerRestaurant | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>('day');
  const [date, setDate] = useState(() => new Date());
  const [timeClockRequests, setTimeClockRequests] = useState<TimeClockRequest[]>([]);
  const [managerAlertCount, setManagerAlertCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewingTime, setIsReviewingTime] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewHydrated, setViewHydrated] = useState(false);
  const [viewPersistenceReady, setViewPersistenceReady] = useState(false);

  const dateKey = toDateKey(date);

  const openChecks = () => {
    if (!restaurant?.id) return;
    router.push(
      `/owner-checks?restaurantId=${encodeURIComponent(restaurant.id)}&restaurantName=${encodeURIComponent(restaurant.name)}&date=${encodeURIComponent(dateKey)}`,
    );
  };

  useEffect(() => {
    let cancelled = false;

    async function loadRestaurant() {
      try {
        const nextRestaurant = await getOwnerRestaurant();
        if (!cancelled) {
          setRestaurant(nextRestaurant);
          if (nextRestaurant?.id) registerManagerPushToken(nextRestaurant.id).catch(() => undefined);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load restaurant.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadRestaurant();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restaurant?.id) return;
    let cancelled = false;
    setViewHydrated(false);
    setViewPersistenceReady(false);
    fetchRestaurantViewPreferences(restaurant.id)
      .then((payload) => {
        if (cancelled) return;
        const saved = payload.settings.homepage;
        if (saved) {
          setPeriod(saved.period || 'day');
          if (saved.anchor_date) setDate(new Date(`${saved.anchor_date}T12:00:00`));
        }
        setViewPersistenceReady(true);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setViewHydrated(true); });
    return () => { cancelled = true; };
  }, [restaurant?.id]);

  useEffect(() => {
    if (!restaurant?.id || !viewHydrated || !viewPersistenceReady) return;
    const timeout = setTimeout(() => {
      saveRestaurantViewPreferences(restaurant.id, 'homepage', {
        period,
        anchor_date: dateKey,
      }).catch(() => undefined);
    }, 450);
    return () => clearTimeout(timeout);
  }, [dateKey, period, restaurant?.id, viewHydrated, viewPersistenceReady]);

  useEffect(() => {
    if (!restaurant?.id) return;
    let cancelled = false;
    staleWhileRevalidate<TimeClockRequest[]>({
      namespace: 'manager-time-clock-requests',
      version: 1,
      parts: [restaurant.id, 'pending'],
      ttlMs: TIME_CLOCK_REQUEST_CACHE_TTL_MS,
      maxStaleMs: TIME_CLOCK_REQUEST_MAX_STALE_MS,
      fetcher: () => fetchManagerTimeClockRequests(restaurant.id, 'pending'),
      onRevalidate: (items) => {
        if (!cancelled) setTimeClockRequests(items);
      },
      onError: () => undefined,
    }).then((result) => {
      if (!cancelled) setTimeClockRequests(result.data);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [restaurant]);

  useEffect(() => {
    if (!restaurant?.id) return undefined;
    let cancelled = false;
    const refresh = () => fetchManagerInbox(restaurant.id, 'open')
      .then((response) => {
        if (!cancelled) setManagerAlertCount(response.open_count);
      })
      .catch(() => undefined);
    void refresh();
    const timer = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [restaurant?.id]);

  const reviewRemoteTime = async (request: TimeClockRequest, status: 'approved' | 'denied') => {
    if (!restaurant?.id) return;
    const requestId = request.request_id || request.id;
    setIsReviewingTime(true);
    setTimeClockRequests((current) => current.filter((item) => (item.request_id || item.id) !== requestId));
    try {
      await reviewTimeClockRequest(requestId, status);
      const refreshed = await fetchManagerTimeClockRequests(restaurant.id, 'pending');
      setTimeClockRequests(refreshed);
    } catch {
      setTimeClockRequests((current) => [request, ...current]);
    } finally {
      setIsReviewingTime(false);
    }
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
        <View style={styles.headingActions}>
          <Pressable
            accessibilityLabel={managerAlertCount ? `${managerAlertCount} manager alerts` : 'Manager alerts'}
            style={styles.refreshButton}
            onPress={() => router.push('/(admin)/alerts' as never)}
          >
            <Feather name="bell" size={18} color={color_pallet.ink[700]} />
            {managerAlertCount > 0 && (
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{managerAlertCount > 99 ? '99+' : managerAlertCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable accessibilityLabel="Return to today" style={styles.refreshButton} onPress={() => setDate(new Date())}>
            <Feather name="rotate-cw" size={18} color={color_pallet.ink[700]} />
          </Pressable>
        </View>
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
          <Text style={[typography.bodySmall, styles.loadingText]}>Loading restaurant...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorCard}>
          <Text style={[typography.caption, styles.errorTitle]}>Analytics unavailable</Text>
          <Text style={[typography.bodySmall, styles.errorCopy]}>{error}</Text>
        </View>
      )}

      {!isLoading && restaurant && (
        <>
          {timeClockRequests.length > 0 && (
            <View style={styles.timeAlertCard}>
              <View style={styles.timeAlertHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.eyebrow, styles.cardEyebrow]}>Admin alerts</Text>
                  <Text style={[typography.h3, styles.timeAlertTitle]}>
                    {timeClockRequests.length} remote time request{timeClockRequests.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <Feather name="bell" size={20} color={color_pallet.sky[700]} />
              </View>
              {timeClockRequests.slice(0, 3).map((request) => (
                <View key={request.request_id || request.id} style={styles.timeAlertRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body, styles.timeAlertName]}>{request.waiter_name || 'Employee'}</Text>
                    <Text style={[typography.bodySmall, styles.timeAlertCopy]} numberOfLines={2}>
                      {(request.structured_payload?.reason || request.notes || String(request.request_type || 'Remote time')).toString()}
                    </Text>
                  </View>
                  <View style={styles.timeAlertActions}>
                    <Pressable disabled={isReviewingTime} onPress={() => reviewRemoteTime(request, 'approved')} style={styles.timeApproveButton}>
                      <Feather name="check" size={16} color="#FFFFFF" />
                    </Pressable>
                    <Pressable disabled={isReviewingTime} onPress={() => reviewRemoteTime(request, 'denied')} style={styles.timeDenyButton}>
                      <Feather name="x" size={16} color={color_pallet.danger[700]} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
          {viewHydrated && <HomepageWidgets scope="restaurant" restaurantId={restaurant.id} period={period} anchorDate={dateKey} onWidgetPress={(widgetId) => { if (widgetId === 'net_sales' || widgetId === 'orders') openChecks(); }} />}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color_pallet.bg.DEFAULT,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing[4],
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
  headingActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  alertBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: statusColors.danger.strong,
  },
  alertBadgeText: {
    color: semanticColors.textInverse,
    fontSize: 9,
    fontWeight: '800',
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
  timeAlertCard: {
    ...card.base,
    backgroundColor: color_pallet.sky[50],
    borderColor: color_pallet.sky[200],
    gap: spacing[3],
    marginTop: spacing[5],
    padding: spacing[4],
  },
  timeAlertHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
  },
  timeAlertTitle: {
    color: color_pallet.ink[900],
    marginTop: spacing[1],
  },
  timeAlertRow: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[3],
  },
  timeAlertName: {
    color: color_pallet.ink[900],
    fontFamily: 'Inter_700Bold',
  },
  timeAlertCopy: {
    color: color_pallet.ink[500],
    marginTop: spacing[1],
  },
  timeAlertActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  timeApproveButton: {
    alignItems: 'center',
    backgroundColor: color_pallet.success[600],
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  timeDenyButton: {
    alignItems: 'center',
    backgroundColor: color_pallet.danger[50],
    borderColor: color_pallet.danger[100],
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
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
    justifyContent: 'space-between',
    marginTop: spacing[3],
  },
  metricTile: {
    ...card.base,
    justifyContent: 'space-between',
    minHeight: 116,
    width: '47%',
    padding: spacing[4],
  },
  metricTileMuted: {
    backgroundColor: color_pallet.stone[50],
    borderColor: color_pallet.stone[300],
  },
  tileLabel: {
    color: color_pallet.ink[500],
  },
  tileValue: {
    color: color_pallet.ink[900],
    marginTop: spacing[2],
  },
  tileValueUnavailable: {
    color: color_pallet.ink[800],
    fontSize: 21,
    lineHeight: 28,
  },
  tileDetail: {
    color: color_pallet.ink[600],
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
