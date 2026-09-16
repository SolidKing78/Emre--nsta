import Slider from '@react-native-community/slider';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/common/Text';
import { fontStyles } from '@/constants/fonts';
import { radius, spacing } from '@/constants/theme';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { clampPercent, round1 } from '@/services/analytics/audienceMix';

/**
 * A 0–100 slider spends almost all of its travel above 10 %, which is useless for a
 * value that lives around 0.7. Squaring the position keeps the low end readable while
 * the slider still reaches the top.
 */
export function positionToPercent(position: number, max: number): number {
  return round1((position / 100) ** 2 * max);
}

export function percentToPosition(percent: number, max: number): number {
  return Math.sqrt(Math.max(0, Math.min(max, percent)) / (max || 1)) * 100;
}

/** Presets that make sense for a value of this size, when the caller has none of its own. */
export function presetsFor(value: number, max = 100): readonly number[] {
  const base = value < 1 ? [0, 0.2, 0.5, 1, 2, 5] : value < 5 ? [0, 1, 2, 5, 10] : value < 30 ? [5, 10, 20, 30, 50] : [10, 25, 50, 75, 100];
  return base.filter((p) => p <= max);
}

export interface PercentFieldProps {
  label: string;
  /** Rendered under the label, e.g. "Takipçi olmayanlar · %99,3". */
  counterpart?: string;
  value: number;
  onChange: (value: number) => void;
  presets?: readonly number[];
  /** Fine control near zero; linear otherwise. */
  fine?: boolean;
  max?: number;
  suffix?: string;
  hint?: string;
  tone?: 'primary' | 'simulation';
}

/** Slider + number box + presets for one percentage. */
export function PercentField({ label, counterpart, value, onChange, presets, fine = false, max = 100, suffix = '%', hint, tone = 'primary' }: PercentFieldProps) {
  const { colors } = useTheme();
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    // Only rewrite the field when the change came from outside it — otherwise typing
    // "0." would be rewritten to "0" the moment it parses.
    const typed = Number(text.replace(',', '.'));
    if (!Number.isFinite(typed) || Math.abs(typed - value) > 0.049) setText(String(value));
  }

  const accent = tone === 'simulation' ? colors.simulation : colors.primary;
  const chips = presets ?? presetsFor(value, max);
  const commit = (next: number) => {
    const clamped = clampPercent(next, 0, max);
    setText(String(clamped));
    onChange(clamped);
  };

  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <Text variant="captionStrong">{label}</Text>
          {counterpart ? (
            <Text variant="small" color="secondary" style={{ marginTop: 2 }}>
              {counterpart}
            </Text>
          ) : null}
        </View>
        <View style={[styles.inputWrap, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceElevated }]}>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              const parsed = Number(v.replace(',', '.').replace('%', ''));
              if (Number.isFinite(parsed)) onChange(clampPercent(parsed, 0, max));
            }}
            onBlur={() => setText(String(value))}
            keyboardType="decimal-pad"
            returnKeyType="done"
            selectTextOnFocus
            style={[styles.input, { color: colors.text }]}
            accessibilityLabel={label}
          />
          <Text variant="captionStrong" color="secondary">
            {suffix}
          </Text>
        </View>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={fine ? 100 : max}
        step={fine ? 0.2 : max <= 20 ? 0.1 : 0.5}
        value={fine ? percentToPosition(value, max) : Math.min(max, value)}
        onValueChange={(v) => commit(fine ? positionToPercent(v, max) : round1(v))}
        onSlidingComplete={() => triggerHaptic('selection')}
        minimumTrackTintColor={accent}
        maximumTrackTintColor={colors.borderStrong}
        thumbTintColor={accent}
        accessibilityLabel={label}
      />

      <View style={styles.presets}>
        {chips.map((p) => {
          const active = Math.abs(value - p) < 0.05;
          return (
            <Pressable
              key={p}
              onPress={() => {
                triggerHaptic('selection');
                commit(p);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${p}${suffix}`}
              style={[styles.preset, { backgroundColor: active ? colors.text : colors.secondaryButton }]}
            >
              <Text variant="small" weight="600" style={{ color: active ? colors.background : colors.text }}>
                {p}
                {suffix}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {hint ? (
        <Text variant="small" color="tertiary" style={{ marginTop: spacing.xs }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: spacing.lg },
  fieldHeader: { flexDirection: 'row', alignItems: 'center' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 42, minWidth: 104 },
  input: { flex: 1, fontSize: 17, paddingVertical: 0, textAlign: 'right', marginRight: 4, ...fontStyles.bold },
  slider: { width: '100%', height: 36, marginTop: spacing.xs },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -2 },
  preset: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
});
