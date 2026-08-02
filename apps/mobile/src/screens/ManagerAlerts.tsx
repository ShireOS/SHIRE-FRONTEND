import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  actOnManagerInboxItem,
  fetchManagerInbox,
  type ManagerInboxItem,
} from '@/api/managerInbox';
import { PageHeader, ScreenShell, SegmentedControl } from '@/components/scheduling/ScheduleKit';
import { UiButton } from '@/components/ui/Button';
import { UiText } from '@/components/ui/Text';
import { palette, semanticColors, statusColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';
import { getOwnerRestaurant } from '../../packages/supabase';

function formatDate(value?: string | null) {
  if (!value) return 'Not specified';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? String(value) : parsed.toLocaleString();
}

function localDateTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.valueOf())) return '';
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export default function ManagerAlerts() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [scope, setScope] = useState<'open' | 'all'>('open');
  const [items, setItems] = useState<ManagerInboxItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const load = useCallback(async (id: string, selectedScope: 'open' | 'all') => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchManagerInbox(id, selectedScope);
      setItems(response.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load alerts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getOwnerRestaurant()
      .then((restaurant) => {
        if (!restaurant?.id) throw new Error('No restaurant selected.');
        setRestaurantId(restaurant.id);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Could not load alerts.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (restaurantId) void load(restaurantId, scope);
  }, [load, restaurantId, scope]);

  useEffect(() => {
    if (!selected) return;
    setCustomTime(localDateTime(selected.expected_at));
    setNote('');
  }, [selected]);

  const act = async (action: string) => {
    if (!restaurantId || !selected) return;
    setSaving(true);
    setError('');
    try {
      const parsedCustom = action === 'custom_time' ? new Date(customTime) : null;
      if (action === 'custom_time' && (!parsedCustom || Number.isNaN(parsedCustom.valueOf()))) {
        throw new Error('Enter the custom time as YYYY-MM-DDTHH:mm.');
      }
      await actOnManagerInboxItem(restaurantId, selected, {
        action,
        ...(parsedCustom ? { custom_clock_out_at: parsedCustom.toISOString() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setSelectedId(null);
      await load(restaurantId, scope);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not complete that action.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={loading}
            onRefresh={() => restaurantId && void load(restaurantId, scope)}
          />
        )}
      >
        <PageHeader
          eyebrow="Manager actions"
          title="Alerts"
          subtitle="Schedule approvals and operational exceptions in one queue."
        />
        <SegmentedControl
          value={scope}
          options={[{ id: 'open', label: 'Open' }, { id: 'all', label: 'All' }]}
          onChange={setScope}
        />

        {error ? <UiText tone="danger" style={styles.error}>{error}</UiText> : null}
        {!loading && items.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="check-circle" size={28} color={statusColors.success.text} />
            <UiText variant="title" style={styles.emptyTitle}>Nothing needs action</UiText>
            <UiText variant="bodySmall" tone="muted" style={styles.center}>New requests and clock exceptions will appear here.</UiText>
          </View>
        ) : items.map((item) => (
          <Pressable
            key={`${item.source}:${item.id}`}
            accessibilityRole="button"
            onPress={() => setSelectedId(item.id)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={[
              styles.icon,
              item.severity === 'critical' ? styles.iconCritical : item.severity === 'warning' ? styles.iconWarning : styles.iconInfo,
            ]}>
              <Feather
                name={item.source === 'operational' ? 'alert-triangle' : 'calendar'}
                size={17}
                color={item.severity === 'critical' ? statusColors.danger.text : item.severity === 'warning' ? statusColors.warning.text : statusColors.info.text}
              />
            </View>
            <View style={styles.rowText}>
              <UiText variant="bodySmall" style={styles.rowTitle}>{item.title}</UiText>
              <UiText variant="caption" tone="muted">{item.type.replace(/_/g, ' ')} · {formatDate(item.occurred_at)}</UiText>
            </View>
            <Feather name="chevron-right" size={18} color={semanticColors.textSubtle} />
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={Boolean(selected)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedId(null)}>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeading}>
              <UiText variant="eyebrow" tone="muted">{selected?.type.replace(/_/g, ' ')}</UiText>
              <UiText variant="h2">{selected?.title}</UiText>
            </View>
            <Pressable accessibilityLabel="Close alert" onPress={() => setSelectedId(null)} style={styles.closeButton}>
              <Feather name="x" size={20} color={semanticColors.text} />
            </Pressable>
          </View>
          <UiText tone="muted">{selected?.message}</UiText>
          <View style={styles.detailBand}>
            <View style={styles.detailCell}>
              <UiText variant="eyebrow" tone="muted">Employee</UiText>
              <UiText variant="bodySmall">{selected?.employee_name || 'Not specified'}</UiText>
            </View>
            <View style={styles.detailCell}>
              <UiText variant="eyebrow" tone="muted">Expected time</UiText>
              <UiText variant="bodySmall">{formatDate(selected?.expected_at)}</UiText>
            </View>
          </View>

          {selected?.source === 'operational' && selected.available_actions.length > 0 ? (
            <View style={styles.actionStack}>
              <UiText variant="eyebrow" tone="muted">Custom clock-out</UiText>
              <TextInput
                accessibilityLabel="Custom clock-out time"
                value={customTime}
                onChangeText={setCustomTime}
                placeholder="YYYY-MM-DDTHH:mm"
                placeholderTextColor={semanticColors.textSubtle}
                autoCapitalize="none"
                style={styles.input}
              />
              <UiText variant="eyebrow" tone="muted">Manager note</UiText>
              <TextInput
                accessibilityLabel="Manager note"
                value={note}
                onChangeText={setNote}
                placeholder="Optional audit note"
                placeholderTextColor={semanticColors.textSubtle}
                style={styles.input}
              />
              <UiButton label="Use scheduled time" disabled={saving} onPress={() => void act('scheduled_time')} />
              <UiButton label="Use custom time" variant="secondary" disabled={saving || !customTime} onPress={() => void act('custom_time')} />
              <UiButton label="Clock out now" variant="secondary" disabled={saving} onPress={() => void act('clock_out_now')} />
              <UiButton label="Still working / dismiss" variant="ghost" disabled={saving} onPress={() => void act('dismiss')} />
            </View>
          ) : selected?.available_actions.length ? (
            <View style={styles.twoActions}>
              <UiButton label="Deny" variant="danger" disabled={saving} style={styles.flexButton} onPress={() => void act('deny')} />
              <UiButton label="Approve" disabled={saving} style={styles.flexButton} onPress={() => void act('approve')} />
            </View>
          ) : null}
          {error ? <UiText tone="danger" style={styles.error}>{error}</UiText> : null}
        </ScrollView>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing[6], gap: spacing[4], paddingBottom: spacing[16] },
  error: { borderLeftWidth: 2, borderLeftColor: statusColors.danger.text, paddingLeft: spacing[4] },
  empty: { alignItems: 'center', paddingVertical: spacing[16], gap: spacing[2] },
  emptyTitle: { marginTop: spacing[2] },
  center: { textAlign: 'center' },
  row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing[4], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: semanticColors.border, paddingVertical: spacing[4] },
  rowPressed: { opacity: 0.65 },
  icon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  iconCritical: { backgroundColor: statusColors.danger.bg },
  iconWarning: { backgroundColor: statusColors.warning.bg },
  iconInfo: { backgroundColor: statusColors.info.bg },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { fontWeight: '700' },
  modalContent: { padding: spacing[8], gap: spacing[6], backgroundColor: palette.bg.DEFAULT, minHeight: '100%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[4] },
  modalHeading: { flex: 1, gap: spacing[1] },
  closeButton: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: semanticColors.border, alignItems: 'center', justifyContent: 'center' },
  detailBand: { flexDirection: 'row', borderWidth: 1, borderColor: semanticColors.border },
  detailCell: { flex: 1, minHeight: 82, padding: spacing[4], gap: spacing[1] },
  actionStack: { gap: spacing[4] },
  input: { minHeight: 46, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, paddingHorizontal: spacing[4], color: semanticColors.text, backgroundColor: semanticColors.surface },
  twoActions: { flexDirection: 'row', gap: spacing[4] },
  flexButton: { flex: 1 },
});
