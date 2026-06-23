import { fetchOwnerChecks, type OwnerChecksPayload } from '@/api/ownerAnalytics';
import { color_pallet } from '@/styles/colors';
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

    fetchOwnerChecks(restaurantId, date)
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
    paddingHorizontal: 16,
    paddingTop: 64,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: color_pallet.cream[100],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color_pallet.stone[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: color_pallet.ink[500],
  },
  title: {
    color: color_pallet.ink[900],
    marginTop: 2,
  },
  subtitle: {
    color: color_pallet.ink[500],
    marginTop: 2,
  },
  stateCard: {
    marginTop: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: color_pallet.stone[200],
    backgroundColor: color_pallet.elevated.DEFAULT,
    padding: 18,
    alignItems: 'center',
  },
  stateText: {
    color: color_pallet.ink[500],
    marginTop: 8,
  },
  errorCard: {
    marginTop: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(201,80,46,0.25)',
    backgroundColor: 'rgba(201,80,46,0.08)',
    padding: 14,
  },
  errorTitle: {
    color: color_pallet.danger[600],
  },
  errorCopy: {
    color: color_pallet.ink[700],
    marginTop: 4,
  },
  errorHint: {
    color: color_pallet.ink[500],
    marginTop: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 22,
  },
  summaryTile: {
    width: '48.4%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: color_pallet.stone[200],
    backgroundColor: color_pallet.elevated.DEFAULT,
    padding: 14,
  },
  tileLabel: {
    color: color_pallet.ink[500],
  },
  tileValue: {
    color: color_pallet.ink[900],
    marginTop: 8,
  },
  section: {
    marginTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color_pallet.stone[200],
    paddingTop: 14,
  },
  sectionTitle: {
    color: color_pallet.ink[900],
    marginBottom: 6,
  },
  hourRow: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color_pallet.stone[200],
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
    marginTop: 2,
  },
  checkRow: {
    minHeight: 78,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color_pallet.stone[200],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkTitle: {
    color: color_pallet.ink[800],
  },
  checkMeta: {
    color: color_pallet.ink[500],
    marginTop: 2,
  },
  checkTotal: {
    color: color_pallet.ink[900],
  },
  emptyText: {
    color: color_pallet.ink[500],
    paddingVertical: 12,
  },
});
