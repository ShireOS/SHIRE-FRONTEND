import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  cancelScheduledChange,
  listScheduledChanges,
  publishScheduledChangeNow,
  type ScheduledChange,
} from '@/api/scheduledChanges';
import { semanticColors, statusColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';

import { UiText } from './Text';

const OPEN_STATUSES = new Set(['pending', 'processing', 'failed']);

export function ScheduledChangesPanel() {
  const [changes, setChanges] = useState<ScheduledChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setChanges((await listScheduledChanges()).filter((change) => OPEN_STATUSES.has(change.status)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load scheduled changes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (change: ScheduledChange, action: 'publish' | 'cancel') => {
    setBusyId(change.id);
    setError('');
    try {
      if (action === 'publish') await publishScheduledChangeNow(change.id);
      else await cancelScheduledChange(change.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update scheduled change.');
    } finally {
      setBusyId('');
    }
  };

  if (!loading && changes.length === 0 && !error) return null;

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.titleRow}><Feather name="clock" size={17} color={semanticColors.text} /><UiText variant="title">Scheduled changes</UiText></View>
        <Pressable accessibilityLabel="Refresh scheduled changes" disabled={loading} onPress={() => void load()} style={styles.iconButton}>
          {loading ? <ActivityIndicator size="small" color={semanticColors.text} /> : <Feather name="refresh-cw" size={15} color={semanticColors.text} />}
        </Pressable>
      </View>
      {error ? <UiText variant="bodySmall" style={styles.error}>{error}</UiText> : null}
      {changes.map((change) => (
        <View key={change.id} style={styles.row}>
          <View style={styles.copy}><UiText variant="bodySmall" numberOfLines={1}>{change.label}</UiText><UiText variant="caption" tone="muted">{new Date(change.scheduled_for).toLocaleString()} · {change.status}</UiText></View>
          <Pressable accessibilityLabel={`Publish ${change.label} now`} disabled={busyId === change.id || change.status === 'processing'} onPress={() => void act(change, 'publish')} style={styles.iconButton}><Feather name="play" size={14} color={semanticColors.text} /></Pressable>
          <Pressable accessibilityLabel={`Cancel ${change.label}`} disabled={busyId === change.id || change.status === 'processing'} onPress={() => void act(change, 'cancel')} style={[styles.iconButton, styles.cancelButton]}><Feather name="x" size={15} color={statusColors.danger.strong} /></Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, padding: spacing[4], gap: spacing[3], backgroundColor: semanticColors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderTopWidth: 1, borderTopColor: semanticColors.border, paddingTop: spacing[3] },
  copy: { flex: 1, gap: spacing[1] },
  iconButton: { width: 36, height: 36, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { borderColor: statusColors.danger.border },
  error: { color: statusColors.danger.text },
});
