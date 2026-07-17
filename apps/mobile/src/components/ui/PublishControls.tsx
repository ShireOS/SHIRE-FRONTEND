import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { UiButton } from './Button';
import { UiText } from './Text';
import { palette, semanticColors, statusColors } from '@/styles/colors';
import { radius, spacing } from '@/styles/tokens';

type Props = {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onPublishNow: () => void | Promise<void>;
  onSchedule: (scheduledFor: string, timezone: string) => void | Promise<void>;
};

function defaults() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return { day, time };
}

export function PublishControls({ label, busy, disabled, onPublishNow, onSchedule }: Props) {
  const initial = defaults();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  const [error, setError] = useState('');

  const schedule = async () => {
    const value = new Date(`${day}T${time}:00`);
    if (Number.isNaN(value.getTime()) || value.getTime() < Date.now() + 10_000) {
      setError('Choose a valid future date and time.');
      return;
    }
    setError('');
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setOpen(false);
    await onSchedule(value.toISOString(), timezone);
  };

  return <>
    <View style={styles.actions}>
      <UiButton label={busy ? 'Saving...' : label} disabled={disabled || busy} onPress={() => void onPublishNow()} style={styles.action} />
      <UiButton label="Save later" variant="secondary" disabled={disabled || busy} onPress={() => setOpen(true)} style={styles.action} />
    </View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View><UiText variant="eyebrow" tone="muted">Publish later</UiText><UiText variant="title">{label}</UiText></View>
            <Pressable accessibilityLabel="Close" onPress={() => setOpen(false)} style={styles.close}><Feather name="x" size={20} color={semanticColors.text} /></Pressable>
          </View>
          <UiText variant="bodySmall" tone="muted">Date</UiText>
          <TextInput value={day} onChangeText={setDay} placeholder="YYYY-MM-DD" autoCapitalize="none" style={styles.input} />
          <UiText variant="bodySmall" tone="muted">Time</UiText>
          <TextInput value={time} onChangeText={setTime} placeholder="HH:MM" keyboardType="numbers-and-punctuation" style={styles.input} />
          {error ? <UiText variant="bodySmall" style={styles.error}>{error}</UiText> : null}
          <View style={styles.actions}>
            <UiButton label="Cancel" variant="secondary" onPress={() => setOpen(false)} style={styles.action} />
            <UiButton label="Schedule" disabled={busy} onPress={() => void schedule()} style={styles.action} />
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  action: { flexGrow: 1, minWidth: 130 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'center', padding: spacing[5] },
  modal: { backgroundColor: semanticColors.surface, borderRadius: radius.lg, padding: spacing[5], gap: spacing[2], maxWidth: 520, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[2] },
  close: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: semanticColors.border, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 46, borderWidth: 1, borderColor: semanticColors.border, borderRadius: radius.md, paddingHorizontal: spacing[3], color: semanticColors.text, backgroundColor: palette.stone[50] },
  error: { color: statusColors.danger.text },
});
