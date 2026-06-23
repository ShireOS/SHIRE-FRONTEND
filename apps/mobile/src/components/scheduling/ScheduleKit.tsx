import { Feather } from '@expo/vector-icons';
import type React from 'react';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import type {
  Announcement,
  Conversation,
  EmployeeRequest,
  EmployeeShift,
  StaffContact,
} from '@/api/employeeOps';
import { palette, semanticColors, statusColors } from '@/styles/colors';
import { shadowMd, shadowSm } from '@/styles/shadows';
import { radius, spacing } from '@/styles/tokens';

import { UiText } from '../ui/Text';

export const opsAccent = '#ff6f4d';
export const opsTeal = '#42c7b7';
export const opsLavender = '#dfe8ff';

export const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date | string, days: number) {
  const value = typeof date === 'string' ? new Date(`${date}T12:00:00`) : new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

export function startOfWeek(date = new Date()) {
  const value = new Date(date);
  const day = value.getDay();
  value.setDate(value.getDate() - day);
  value.setHours(12, 0, 0, 0);
  return value;
}

export function formatTime(value?: string | null) {
  if (!value) return 'DNE';
  const [rawHour, rawMinute] = String(value).slice(0, 5).split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute || 0);
  if (!Number.isFinite(hour)) return String(value);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

export function shiftHours(shift: EmployeeShift) {
  const start = timeToMinutes(shift.shift_start);
  let end = timeToMinutes(shift.shift_end);
  if (end <= start) end += 24 * 60;
  return Math.max(0, (end - start) / 60);
}

function timeToMinutes(value?: string | null) {
  const [hour, minute] = String(value || '00:00').slice(0, 5).split(':').map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

export function groupShiftsByDate(shifts: EmployeeShift[]) {
  return shifts.reduce<Record<string, EmployeeShift[]>>((acc, shift) => {
    const key = String(shift.shift_date).slice(0, 10);
    acc[key] = [...(acc[key] || []), shift];
    return acc;
  }, {});
}

export function ScreenShell({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.screen, style]}>
      {children}
    </View>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={{ flex: 1 }}>
        {eyebrow && <UiText variant="eyebrow" tone="muted">{eyebrow}</UiText>}
        <UiText variant="h2" style={styles.pageTitle}>{title}</UiText>
        {subtitle && <UiText variant="bodySmall" tone="muted" style={styles.pageSubtitle}>{subtitle}</UiText>}
      </View>
      {action}
    </View>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  accent,
}: {
  name: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  label: string;
  accent?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.iconButton, accent && styles.iconButtonAccent]}
    >
      <Feather name={name} size={20} color={accent ? '#FFFFFF' : palette.ink[800]} />
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[styles.segmentButton, active && styles.segmentButtonActive]}
          >
            <UiText
              variant="caption"
              style={[styles.segmentText, active && styles.segmentTextActive]}
            >
              {option.label}
            </UiText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function WeekStrip({
  weekStart,
  selectedDate,
  onSelectDate,
}: {
  weekStart: string;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
}) {
  const start = new Date(`${weekStart}T12:00:00`);
  return (
    <View style={styles.weekStrip}>
      {Array.from({ length: 7 }, (_, index) => {
        const date = addDays(start, index);
        const key = toDateKey(date);
        const active = key === selectedDate;
        return (
          <Pressable
            key={key}
            onPress={() => onSelectDate(key)}
            style={[styles.dayPill, active && styles.dayPillActive]}
          >
            <UiText variant="caption" style={[styles.dayName, active && styles.dayNameActive]}>
              {WEEK_DAYS[date.getDay()]}
            </UiText>
            <UiText variant="title" style={[styles.dayNumber, active && styles.dayNumberActive]}>
              {date.getDate()}
            </UiText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LocationFilterRow({
  location,
  onFilter,
}: {
  location?: string;
  onFilter?: () => void;
}) {
  return (
    <View style={styles.locationRow}>
      <Feather name="map-pin" size={19} color={palette.sky[600]} />
      <UiText variant="body" style={styles.locationText} numberOfLines={1}>
        {location || 'Restaurant'}
      </UiText>
      <IconButton name="sliders" label="Filter schedule" onPress={onFilter} />
    </View>
  );
}

export function ShiftRow({
  shift,
  showPerson = false,
}: {
  shift: EmployeeShift;
  showPerson?: boolean;
}) {
  const role = shift.role || shift.waiter_role || 'Staff';
  const name = shift.waiter_name || 'Assigned staff';
  return (
    <Pressable style={styles.shiftRow}>
      <View style={styles.avatar}>
        <UiText variant="caption" style={styles.avatarText}>
          {(showPerson ? name : role).slice(0, 1).toUpperCase()}
        </UiText>
      </View>
      <View style={styles.shiftMain}>
        {showPerson && <UiText variant="body" style={styles.shiftName}>{name}</UiText>}
        <UiText variant={showPerson ? 'bodySmall' : 'title'} style={showPerson ? styles.shiftTimeSmall : styles.shiftTime}>
          {formatTime(shift.shift_start)}-{formatTime(shift.shift_end)}
        </UiText>
        <View style={styles.metaLine}>
          <View style={styles.roleDot} />
          <UiText variant="bodySmall" tone="muted" numberOfLines={1}>
            {role}{shift.section_name ? ` | ${shift.section_name}` : ''}
          </UiText>
        </View>
        {shift.notes && (
          <View style={styles.noteLine}>
            <Feather name="file-text" size={13} color={palette.sky[600]} />
            <UiText variant="caption" tone="muted" numberOfLines={1}>{shift.notes}</UiText>
          </View>
        )}
      </View>
      <Feather name="chevron-right" size={18} color={palette.ink[300]} />
    </Pressable>
  );
}

export function DayScheduleSection({
  dateKey,
  shifts,
  showPerson = false,
}: {
  dateKey: string;
  shifts: EmployeeShift[];
  showPerson?: boolean;
}) {
  const date = new Date(`${dateKey}T12:00:00`);
  return (
    <View style={styles.daySection}>
      <View style={styles.daySectionHeader}>
        <UiText variant="title">
          {date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </UiText>
        <View style={styles.countPill}>
          <Feather name="users" size={13} color={palette.ink[500]} />
          <UiText variant="caption" tone="muted">{shifts.length}</UiText>
        </View>
      </View>
      {shifts.length === 0 ? (
        <UiText variant="bodySmall" tone="muted" style={styles.emptyDay}>
          You are not scheduled to work.
        </UiText>
      ) : (
        shifts.map((shift) => <ShiftRow key={shift.id} shift={shift} showPerson={showPerson} />)
      )}
    </View>
  );
}

export function RequestRow({
  request,
  onApprove,
  onDeny,
}: {
  request: EmployeeRequest;
  onApprove?: () => void;
  onDeny?: () => void;
}) {
  return (
    <View style={styles.requestRow}>
      <View style={{ flex: 1 }}>
        <View style={styles.requestTitleLine}>
          <UiText variant="caption" style={styles.requestType}>
            {String(request.request_type || 'request').replaceAll('_', ' ')}
          </UiText>
          <UiText variant="caption" style={styles.requestStatus}>
            {request.status || 'pending'}
          </UiText>
        </View>
        <UiText variant="body" style={styles.requestTitle}>
          {request.waiter_name || request.title || 'Employee request'}
        </UiText>
        <UiText variant="bodySmall" tone="muted">
          {[request.start_date, request.end_date && request.end_date !== request.start_date ? request.end_date : null]
            .filter(Boolean)
            .join(' to ') || request.notes || 'No date attached'}
        </UiText>
      </View>
      {onApprove && onDeny && (
        <View style={styles.requestActions}>
          <Pressable style={styles.approveButton} onPress={onApprove}>
            <Feather name="check" size={16} color="#FFFFFF" />
          </Pressable>
          <Pressable style={styles.denyButton} onPress={onDeny}>
            <Feather name="x" size={16} color={statusColors.danger.text} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function ConversationRow({ conversation }: { conversation: Conversation }) {
  const members = conversation.members || [];
  const title = conversation.title || members.map((member) => member.name).filter(Boolean).join(', ') || 'Staff chat';
  return (
    <View style={styles.conversationRow}>
      <View style={styles.chatAvatar}>
        <Feather name={members.length > 1 ? 'users' : 'message-circle'} size={18} color={opsAccent} />
      </View>
      <View style={{ flex: 1 }}>
        <UiText variant="body" style={styles.shiftName} numberOfLines={1}>{title}</UiText>
        <UiText variant="bodySmall" tone="muted" numberOfLines={1}>
          {conversation.last_message_preview || 'No messages yet'}
        </UiText>
      </View>
      <Feather name="chevron-right" size={18} color={palette.ink[300]} />
    </View>
  );
}

export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  return (
    <View style={styles.announcementCard}>
      <UiText variant="title">{announcement.title}</UiText>
      <UiText variant="bodySmall" tone="muted" style={{ marginTop: spacing[2] }}>
        {announcement.body}
      </UiText>
    </View>
  );
}

export function ContactRow({ contact }: { contact: StaffContact }) {
  return (
    <View style={styles.contactRow}>
      <View style={styles.avatar}>
        <UiText variant="caption" style={styles.avatarText}>{(contact.name || '?').slice(0, 1)}</UiText>
      </View>
      <View style={{ flex: 1 }}>
        <UiText variant="body" style={styles.shiftName}>{contact.name || 'Staff'}</UiText>
        <UiText variant="bodySmall" tone="muted">{contact.role || 'Staff'}</UiText>
      </View>
    </View>
  );
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={palette.ink[400]}
      multiline={multiline}
      style={[styles.textField, multiline && styles.textFieldMultiline]}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: semanticColors.background,
  },
  pageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
  },
  pageTitle: {
    marginTop: spacing[1],
  },
  pageSubtitle: {
    marginTop: spacing[1],
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
    ...shadowSm,
  },
  iconButtonAccent: {
    backgroundColor: opsAccent,
    borderColor: opsAccent,
  },
  segmented: {
    backgroundColor: palette.stone[50],
    borderRadius: radius.lg,
    flexDirection: 'row',
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    padding: spacing[1],
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: opsAccent,
    ...shadowSm,
  },
  segmentText: {
    color: opsAccent,
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  weekStrip: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  dayPill: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    minHeight: 64,
    justifyContent: 'center',
  },
  dayPillActive: {
    backgroundColor: opsTeal,
    ...shadowMd,
  },
  dayName: {
    color: palette.ink[400],
  },
  dayNameActive: {
    color: '#FFFFFF',
  },
  dayNumber: {
    color: palette.ink[600],
    marginTop: spacing[1],
  },
  dayNumberActive: {
    color: '#FFFFFF',
  },
  locationRow: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderBottomColor: semanticColors.border,
    borderTopColor: semanticColors.border,
    borderBottomWidth: 1,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    minHeight: 58,
    paddingHorizontal: spacing[5],
  },
  locationText: {
    flex: 1,
  },
  daySection: {
    backgroundColor: semanticColors.elevated,
    borderBottomColor: semanticColors.border,
    borderBottomWidth: 1,
  },
  daySectionHeader: {
    alignItems: 'center',
    backgroundColor: palette.stone[50],
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  countPill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[1],
  },
  emptyDay: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
  },
  shiftRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#ffd9d0',
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  avatarText: {
    color: opsAccent,
    fontFamily: 'Inter_700Bold',
  },
  shiftMain: {
    flex: 1,
  },
  shiftName: {
    fontFamily: 'Inter_600SemiBold',
  },
  shiftTime: {
    color: palette.ink[900],
  },
  shiftTimeSmall: {
    color: palette.ink[500],
    marginTop: spacing[1],
  },
  metaLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  roleDot: {
    backgroundColor: '#ee6d77',
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  noteLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[1],
    marginTop: spacing[2],
  },
  requestRow: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
  },
  requestTitleLine: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  requestType: {
    color: opsAccent,
    textTransform: 'capitalize',
  },
  requestStatus: {
    color: palette.ink[500],
    textTransform: 'capitalize',
  },
  requestTitle: {
    fontFamily: 'Inter_600SemiBold',
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  approveButton: {
    alignItems: 'center',
    backgroundColor: opsTeal,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  denyButton: {
    alignItems: 'center',
    backgroundColor: statusColors.danger.bg,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  conversationRow: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderBottomColor: semanticColors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  chatAvatar: {
    alignItems: 'center',
    backgroundColor: '#fff0ea',
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  announcementCard: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[4],
  },
  contactRow: {
    alignItems: 'center',
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
  },
  textField: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: semanticColors.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: spacing[3],
  },
  textFieldMultiline: {
    minHeight: 96,
    paddingTop: spacing[3],
    textAlignVertical: 'top',
  },
});
