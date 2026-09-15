import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { SegmentControl } from '@/components/common/SegmentControl';
import { Text } from '@/components/common/Text';
import { radius, spacing } from '@/constants/theme';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import type { DateRange, DateRangePreset } from '@/types/app';
import { addDays, buildDateRange, daysBetween, formatLongDate, toISODate } from '@/utils/date';

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  style?: StyleProp<ViewStyle>;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function DateRangeSelector({ value, onChange, style }: DateRangeSelectorProps) {
  const t = useT();
  const language = useLanguage();
  const { colors } = useTheme();
  const [customOpen, setCustomOpen] = useState(false);
  const [since, setSince] = useState(value.since);
  const [until, setUntil] = useState(value.until);
  const [error, setError] = useState<string | null>(null);

  const options = [
    { value: '7d' as const, label: t('range.7d') },
    { value: '30d' as const, label: t('range.30d') },
    { value: '90d' as const, label: t('range.90d') },
    { value: 'custom' as const, label: t('range.custom') },
  ];

  const select = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setSince(value.since);
      setUntil(value.until);
      setError(null);
      setCustomOpen(true);
      return;
    }
    onChange(buildDateRange(preset));
  };

  const applyCustom = () => {
    if (!ISO.test(since) || !ISO.test(until) || since > until) {
      setError(t('range.customTitle'));
      return;
    }
    const days = daysBetween(since, until);
    if (days > 365) {
      setError(t('range.customTitle'));
      return;
    }
    onChange({ preset: 'custom', since, until });
    triggerHaptic('selection');
    setCustomOpen(false);
  };

  const quick = [14, 60, 180].map((n) => ({
    label: t('range.lastNDays', { n }),
    since: toISODate(addDays(new Date(), -(n - 1))),
    until: toISODate(new Date()),
  }));

  return (
    <View style={style}>
      <SegmentControl options={options} value={value.preset} onChange={select} />
      {value.preset === 'custom' ? (
        <Pressable onPress={() => select('custom')} accessibilityRole="button" accessibilityLabel={t('range.customTitle')}>
          <Text variant="caption" color="secondary" align="center" style={{ marginTop: spacing.sm }}>
            {formatLongDate(value.since, language)} – {formatLongDate(value.until, language)} · {daysBetween(value.since, value.until)} {t('range.days')}
          </Text>
        </Pressable>
      ) : null}
      <BottomSheet visible={customOpen} onClose={() => setCustomOpen(false)} title={t('range.customTitle')}>
        <View style={styles.sheetBody}>
          <View style={styles.quickRow}>
            {quick.map((q) => (
              <Pressable
                key={q.label}
                accessibilityRole="button"
                accessibilityLabel={q.label}
                onPress={() => {
                  setSince(q.since);
                  setUntil(q.until);
                  setError(null);
                }}
                style={[styles.quick, { backgroundColor: colors.secondaryButton }]}
              >
                <Text variant="captionStrong">{q.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.inputs}>
            <View style={styles.inputCol}>
              <Text variant="caption" color="secondary">
                {t('range.since')}
              </Text>
              <TextInput
                value={since}
                onChangeText={setSince}
                placeholder="2026-01-01"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
                style={[styles.input, { borderColor: colors.borderStrong, color: colors.text }]}
                accessibilityLabel={t('range.since')}
              />
            </View>
            <View style={styles.inputCol}>
              <Text variant="caption" color="secondary">
                {t('range.until')}
              </Text>
              <TextInput
                value={until}
                onChangeText={setUntil}
                placeholder="2026-01-31"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
                style={[styles.input, { borderColor: colors.borderStrong, color: colors.text }]}
                accessibilityLabel={t('range.until')}
              />
            </View>
          </View>
          {error ? (
            <Text variant="caption" color="danger" style={{ marginTop: spacing.sm }}>
              YYYY-MM-DD · max 365 {t('range.days')}
            </Text>
          ) : null}
          <Button title={t('common.apply')} onPress={applyCustom} style={{ marginTop: spacing.xl }} />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetBody: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quick: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  inputs: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  inputCol: { flex: 1 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, marginTop: spacing.xs, fontSize: 15 },
});
