import {
  fetchGuestFeedback,
  updateGuestFeedbackStatus,
  type GuestFeedback,
  type GuestFeedbackStatus,
} from '@/api/guestFeedback';
import { semanticColors, statusColors } from '@/styles/colors';
import { card, layout, radius, spacing } from '@/styles/tokens';
import { typography } from '@/styles/typography';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getOwnerRestaurant, type OwnerRestaurant } from '../../packages/supabase';

const FILTERS: { id: GuestFeedbackStatus | 'all'; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'all', label: 'All' },
];

function formatCategory(value: string) {
  return value.replace(/_/g, ' ');
}

function severityTone(severity: GuestFeedback['severity']) {
  if (severity === 'high') return statusColors.danger;
  if (severity === 'low') return statusColors.success;
  return statusColors.warning;
}

export default function OwnerFeedback() {
  const [restaurant, setRestaurant] = useState<OwnerRestaurant | null>(null);
  const [status, setStatus] = useState<GuestFeedbackStatus | 'all'>('open');
  const [feedback, setFeedback] = useState<GuestFeedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOwnerRestaurant()
      .then((nextRestaurant) => {
        if (!cancelled) setRestaurant(nextRestaurant);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load restaurant.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restaurant?.id) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchGuestFeedback(restaurant.id, status)
      .then((items) => {
        if (!cancelled) setFeedback(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load feedback.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurant, status]);

  const setFeedbackStatus = async (item: GuestFeedback, nextStatus: GuestFeedbackStatus) => {
    if (!restaurant?.id) return;
    setUpdatingId(item.id);
    setFeedback((current) => current.filter((row) => row.id !== item.id || status === 'all'));
    try {
      const updated = await updateGuestFeedbackStatus(restaurant.id, item.id, nextStatus);
      setFeedback((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setFeedback((current) => [item, ...current]);
      setError(err instanceof Error ? err.message : 'Could not update feedback.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={[typography.caption, styles.eyebrow]}>Guest feedback</Text>
          <Text style={[typography.h1, styles.title]}>Complaints</Text>
        </View>
        <Feather name="alert-circle" size={24} color={semanticColors.primary} />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((filter) => (
          <Pressable
            key={filter.id}
            onPress={() => setStatus(filter.id)}
            style={[styles.filterButton, status === filter.id && styles.filterButtonActive]}
          >
            <Text style={[styles.filterText, status === filter.id && styles.filterTextActive]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isLoading ? <Text style={styles.muted}>Loading feedback...</Text> : null}
      {!isLoading && feedback.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={[typography.body, styles.muted]}>No guest feedback in this view.</Text>
        </View>
      ) : null}

      {feedback.map((item) => {
        const tone = severityTone(item.severity);
        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                <Text style={[styles.badgeText, { color: tone.text }]}>{item.severity}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{formatCategory(item.category)}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>
            <Text style={[typography.h3, styles.summary]}>{item.summary}</Text>
            {item.details ? <Text style={[typography.bodySmall, styles.details]}>{item.details}</Text> : null}
            <Text style={styles.meta}>
              {[item.guestName, item.guestPhone, item.source].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.actions}>
              {item.status === 'open' ? (
                <Pressable
                  disabled={updatingId === item.id}
                  onPress={() => setFeedbackStatus(item, 'reviewed')}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Review</Text>
                </Pressable>
              ) : null}
              {item.status !== 'resolved' ? (
                <Pressable
                  disabled={updatingId === item.id}
                  onPress={() => setFeedbackStatus(item, 'resolved')}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Resolve</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
    padding: layout.screenPadding,
    paddingBottom: spacing[10],
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: semanticColors.textMuted,
    textTransform: 'uppercase',
  },
  title: {
    color: semanticColors.text,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  filterButton: {
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  filterButtonActive: {
    backgroundColor: semanticColors.text,
    borderColor: semanticColors.text,
  },
  filterText: {
    color: semanticColors.textMuted,
    fontWeight: '700',
  },
  filterTextActive: {
    color: semanticColors.textInverse,
  },
  card: {
    ...card.raised,
    gap: spacing[3],
  },
  emptyCard: {
    ...card.base,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  badge: {
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  badgeText: {
    color: semanticColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  summary: {
    color: semanticColors.text,
  },
  details: {
    color: semanticColors.textMuted,
    lineHeight: 20,
  },
  meta: {
    color: semanticColors.textSubtle,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  primaryButton: {
    backgroundColor: semanticColors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  primaryButtonText: {
    color: semanticColors.textInverse,
    fontWeight: '800',
  },
  secondaryButton: {
    borderColor: semanticColors.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  secondaryButtonText: {
    color: semanticColors.text,
    fontWeight: '800',
  },
  error: {
    color: statusColors.danger.text,
  },
  muted: {
    color: semanticColors.textMuted,
  },
});
