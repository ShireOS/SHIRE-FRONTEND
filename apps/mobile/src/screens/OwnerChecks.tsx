import { fetchOwnerChecks, type OwnerChecksPayload } from '@/api/ownerAnalytics';
import { color_pallet, semanticColors, statusColors } from '@/styles/colors';
import { card, divider, layout, radius, spacing } from '@/styles/tokens';
import { typography } from '@/styles/typography';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatCurrency(value: unknown) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatNumber(value: unknown) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Number.isFinite(number) ? number : 0,
  );
}

function formatPartySize(value: unknown) {
  if (value === null || value === undefined) return 'DNE guests';
  return `${formatNumber(value)} guests`;
}

function formatTime(value?: string | null) {
  if (!value) return 'Open';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 5);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function OwnerChecks() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const restaurantId = paramValue(params.restaurantId);
  const restaurantName = paramValue(params.restaurantName) || 'Restaurant';
  const date = paramValue(params.date) || new Date().toISOString().slice(0, 10);
  const [payload, setPayload] = useState<OwnerChecksPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setError('Missing restaurant id.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchOwnerChecks(restaurantId, date, {
      onRevalidate: (data) => {
        if (!cancelled) setPayload(data);
      },
    })
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load checks.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, restaurantId]);

  const checks = payload?.checks || [];
  const buckets = useMemo(() => payload?.hourly_buckets || [], [payload]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color={color_pallet.ink[800]} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[typography.eyebrow, styles.eyebrow]}>{restaurantName}</Text>
          <Text style={[typography.h2, styles.title]}>Hourly checks</Text>
          <Text style={[typography.caption, styles.subtitle]}>{date}</Text>
        </View>
      </View>

      {isLoading && (
        <View style={styles.stateCard}>
          <ActivityIndicator color={color_pallet.sky[700]} />
          <Text style={[typography.bodySmall, styles.stateText]}>Loading checks...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorCard}>
          <Text style={[typography.caption, styles.errorTitle]}>Checks endpoint unavailable</Text>
          <Text style={[typography.bodySmall, styles.errorCopy]}>{error}</Text>
          <Text style={[typography.caption, styles.errorHint]}>
            Expected endpoint: /restaurants/:id/owner-checks?date=YYYY-MM-DD
          </Text>
        </View>
      )}

      {!isLoading && !error && (
        <>
          <View style={styles.summaryGrid}>
            <SummaryTile label="Sales" value={formatCurrency(payload?.totals?.sales)} />
            <SummaryTile label="Orders" value={formatNumber(payload?.totals?.orders || checks.length)} />
            <SummaryTile label="Covers" value={formatNumber(payload?.totals?.covers)} />
            <SummaryTile label="Avg Check" value={formatCurrency(payload?.totals?.avg_check)} />
          </View>

          <View style={styles.section}>
            <Text style={[typography.h3, styles.sectionTitle]}>By hour</Text>
            {buckets.length > 0 ? (
              buckets.map((bucket, index) => (
                <View key={`${bucket.hour || bucket.label || index}`} style={styles.hourRow}>
                  <Text style={[typography.caption, styles.hourLabel]}>
                    {bucket.label || bucket.hour || 'Hour'}
                  </Text>
                  <View style={styles.hourMeta}>
                    <Text style={[typography.caption, styles.hourValue]}>
                      {formatNumber(bucket.orders || bucket.checks)} checks
                    </Text>
                    <Text style={[typography.title, styles.hourSales]}>{formatCurrency(bucket.sales)}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[typography.bodySmall, styles.emptyText]}>No hourly buckets returned yet.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[typography.h3, styles.sectionTitle]}>Checks</Text>
            {checks.length > 0 ? (
              checks.map((check, index) => (
                <View key={check.id || `${check.order_number}-${index}`} style={styles.checkRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.caption, styles.checkTitle]}>
                      #{check.order_number || check.id || 'Check'}
                    </Text>
                    <Text style={[typography.caption, styles.checkMeta]}>
                      {formatTime(check.opened_at)}-{formatTime(check.closed_at)} · Table {check.table_number || 'DNE'}
                    </Text>
                    <Text style={[typography.caption, styles.checkMeta]}>
                      {check.waiter_name || 'Unassigned'} · {formatPartySize(check.party_size)} · {check.payment_status || check.status || 'status DNE'}
                    </Text>
                  </View>
                  <Text style={[typography.title, styles.checkTotal]}>{formatCurrency(check.total)}</Text>
                </View>
              ))
            ) : (
              <Text style={[typography.bodySmall, styles.emptyText]}>No individual checks returned yet.</Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={[typography.caption, styles.tileLabel]}>{label}</Text>
      <Text style={[typography.h3, styles.tileValue]}>{value}</Text>
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
    paddingTop: spacing[10],
    paddingBottom: spacing[12],
  },
  header: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'center',
  },
  backButton: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: radius.pill,
    backgroundColor: semanticColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: semanticColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: color_pallet.ink[500],
  },
  title: {
    color: color_pallet.ink[900],
    marginTop: spacing[1] / 2,
  },
  subtitle: {
    color: color_pallet.ink[500],
    marginTop: spacing[1] / 2,
  },
  stateCard: {
    ...card.base,
    marginTop: spacing[6],
    alignItems: 'center',
  },
  stateText: {
    color: color_pallet.ink[500],
    marginTop: spacing[2],
  },
  errorCard: {
    marginTop: spacing[6],
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
    marginTop: spacing[1],
  },
  errorHint: {
    color: color_pallet.ink[500],
    marginTop: spacing[2],
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginTop: spacing[6],
  },
  summaryTile: {
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
  section: {
    marginTop: spacing[6],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: divider.backgroundColor,
    paddingTop: spacing[4],
  },
  sectionTitle: {
    color: color_pallet.ink[900],
    marginBottom: spacing[2],
  },
  hourRow: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: semanticColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hourLabel: {
    color: color_pallet.ink[800],
  },
  hourMeta: {
    alignItems: 'flex-end',
  },
  hourValue: {
    color: color_pallet.ink[500],
  },
  hourSales: {
    color: color_pallet.ink[900],
    marginTop: spacing[1] / 2,
  },
  checkRow: {
    minHeight: 78,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: semanticColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  checkTitle: {
    color: color_pallet.ink[800],
  },
  checkMeta: {
    color: color_pallet.ink[500],
    marginTop: spacing[1] / 2,
  },
  checkTotal: {
    color: color_pallet.ink[900],
  },
  emptyText: {
    color: color_pallet.ink[500],
    paddingVertical: spacing[3],
  },
});
