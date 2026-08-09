import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { UiText } from '@/components/ui/Text';
import { semanticColors } from '@/styles/colors';
import { field, radius, spacing } from '@/styles/tokens';
import { formatTimeLabel, nearbyTimeSuggestions, resolveTimeInput } from '@/utils/timeInput';

type SmartTimeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  minuteStep?: 1 | 5 | 15;
  allowEmpty?: boolean;
  placeholder?: string;
  style?: ViewStyle;
};

export function SmartTimeField({
  value,
  onChange,
  minuteStep = 15,
  allowEmpty = false,
  placeholder = 'h:mm am',
  style,
}: SmartTimeFieldProps) {
  const [query, setQuery] = useState(() => formatTimeLabel(value));
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!focused) setQuery(formatTimeLabel(value));
  }, [focused, value]);

  const commit = (candidate = query) => {
    if (!candidate.trim() && allowEmpty) {
      onChange('');
      setQuery('');
      setFocused(false);
      return;
    }
    const resolved = resolveTimeInput(candidate, minuteStep);
    if (resolved) {
      onChange(resolved);
      setQuery(formatTimeLabel(resolved));
    } else {
      setQuery(formatTimeLabel(value));
    }
    setFocused(false);
  };

  const suggestions = nearbyTimeSuggestions(query, minuteStep);

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.inputShell, focused && field.focused]}>
        <Feather name="clock" size={17} color={semanticColors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => commit(), 120);
          }}
          onSubmitEditing={() => commit()}
          placeholder={placeholder}
          placeholderTextColor={semanticColors.textSubtle}
          returnKeyType="done"
          selectTextOnFocus
          style={styles.input}
        />
      </View>
      {focused && (
        <View style={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPressIn={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
              }}
              onPress={() => commit(suggestion)}
              style={styles.suggestion}
            >
              <UiText variant="bodySmall">{formatTimeLabel(suggestion)}</UiText>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 4 },
  inputShell: {
    ...field.base,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  input: { color: semanticColors.text, flex: 1, minHeight: 46, paddingVertical: 0 },
  suggestions: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.borderStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 52,
    zIndex: 20,
  },
  suggestion: {
    borderBottomColor: semanticColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
});
