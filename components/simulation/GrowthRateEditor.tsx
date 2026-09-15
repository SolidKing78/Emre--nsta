import Slider from '@react-native-community/slider';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { radius, spacing } from '@/constants/theme';
import { useGrowthPercent, useSimulationActions, useSimulationEnabled } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import { applyGrowth, clampGrowth, GROWTH_RATE_PRESETS } from '@/services/simulation/growth';
import type { AppMetric, MetricKey } from '@/types/app';
import { formatCompact } from '@/utils/format';

const PREVIEW_KEYS: MetricKey[] = ['views', 'reach', 'interactions', 'followers', 'likes', 'saves'];
const SLIDER_MIN = -50;
const SLIDER_MAX = 300;

interface GrowthRateEditorProps {
  /** Real account metrics used for the live preview (optional). */
  previewMetrics?: readonly AppMetric[];
  onApplied?: () => void;
  /** Inline card (Simulation Lab) or sheet body. */
  compact?: boolean;
}

/**
 * One percentage that moves every metric like a real Instagram growth curve.
 * Explicit per-metric edits still win over the rate.
 */
export function GrowthRateEditor({ previewMetrics, onApplied, compact = false }: GrowthRateEditorProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const current = useGrowthPercent();
  const enabled = useSimulationEnabled();
  const actions = useSimulationActions();
  const [draft, setDraft] = useState(current);
  const [text, setText] = useState(String(current));
  const [prevCurrent, setPrevCurrent] = useState(current);
  if (current !== prevCurrent) {
    setPrevCurrent(current);
    setDraft(current);
    setText(String(current));
  }

  const commit = (next: number) => {
    const clamped = clampGrowth(next);
    setDraft(clamped);
    setText(String(clamped));
  };

  const apply = () => {
    actions.setGrowthPercent(draft);
    if (!enabled) actions.setEnabled(true);
    triggerHaptic('success');
    onApplied?.();
  };

  const clear = () => {
    actions.setGrowthPercent(0);
    triggerHaptic('light');
    onApplied?.();
  };

  const sign = draft > 0 ? '+' : '';
  const preview = (previewMetrics ?? []).filter((m) => PREVIEW_KEYS.includes(m.key)).slice(0, compact ? 4 : 6);

  return (
    <View style={compact ? undefined : styles.body}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="secondary">
            {t('growthRate.current')}
          </Text>
          <Text variant="metric" weight="700" color={draft < 0 ? 'danger' : draft > 0 ? 'success' : 'primary'}>
            {sign}
            {draft}%
          </Text>
        </View>
        <View style={[styles.inputWrap, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceElevated }]}>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              const parsed = Number(v.replace(',', '.').replace('%', '').replace('+', ''));
              if (Number.isFinite(parsed)) setDraft(clampGrowth(parsed));
            }}
            onBlur={() => setText(String(draft))}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            selectTextOnFocus
            style={[styles.input, { color: colors.text }]}
            accessibilityLabel={t('growthRate.title')}
          />
          <Text variant="bodyStrong" color="secondary">
            %
          </Text>
        </View>
      </View>
      <Text variant="caption" color="secondary" style={{ marginTop: spacing.xs }}>
        {t('growthRate.subtitle')}
      </Text>

      <Slider
        style={styles.slider}
        minimumValue={SLIDER_MIN}
        maximumValue={SLIDER_MAX}
        step={1}
        value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, draft))}
        onValueChange={(v) => commit(v)}
        onSlidingComplete={() => triggerHaptic('selection')}
        minimumTrackTintColor={draft < 0 ? colors.danger : colors.primary}
        maximumTrackTintColor={colors.borderStrong}
        thumbTintColor={colors.primary}
        accessibilityLabel={t('growthRate.title')}
      />
      <View style={styles.sliderLabels}>
        <Text variant="small" color="tertiary">
          {SLIDER_MIN}%
        </Text>
        <Text variant="small" color="tertiary">
          0%
        </Text>
        <Text variant="small" color="tertiary">
          +{SLIDER_MAX}%
        </Text>
      </View>

      <View style={styles.presets}>
        {GROWTH_RATE_PRESETS.map((p) => {
          const active = draft === p;
          return (
            <Pressable
              key={p}
              onPress={() => {
                triggerHaptic('selection');
                commit(p);
              }}
              accessibilityRole="button"
              accessibilityLabel={`+${p}%`}
              style={[styles.preset, { backgroundColor: active ? colors.text : colors.secondaryButton }]}
            >
              <Text variant="captionStrong" style={{ color: active ? colors.background : colors.text }}>
                +{p}%
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            commit(-25);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('growthRate.decline')}
          style={[styles.preset, { backgroundColor: draft === -25 ? colors.text : colors.secondaryButton }]}
        >
          <Text variant="captionStrong" style={{ color: draft === -25 ? colors.background : colors.text }}>
            −25%
          </Text>
        </Pressable>
      </View>

      {preview.length > 0 ? (
        <View style={[styles.preview, { borderColor: colors.border }]}>
          <Text variant="small" color="tertiary" style={{ marginBottom: spacing.xs }}>
            {t('growthRate.preview')}
          </Text>
          {preview.map((m) => {
            const next = applyGrowth(m.value, m.key, draft);
            return (
              <View key={m.key} style={styles.previewRow}>
                <Text variant="caption" color="secondary" style={{ flex: 1 }}>
                  {t(`metric.${m.key}`)}
                </Text>
                <Text variant="caption" color="secondary">
                  {formatCompact(m.value, language)}
                </Text>
                <Text variant="caption" color="tertiary" style={{ marginHorizontal: spacing.sm }}>
                  →
                </Text>
                <Text variant="captionStrong" style={{ minWidth: 56, textAlign: 'right' }}>
                  {formatCompact(next, language)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <Text variant="small" color="tertiary" style={{ marginTop: spacing.md }}>
        {t('growthRate.elasticity')} {t('growthRate.hint')}
      </Text>

      <Button title={t('growthRate.apply')} size="lg" onPress={apply} style={{ marginTop: spacing.lg }} />
      {current !== 0 ? (
        <Pressable onPress={clear} accessibilityRole="button" accessibilityLabel={t('growthRate.clear')} style={styles.clearLink}>
          <Text variant="bodyStrong" color="secondary" align="center">
            {t('growthRate.clear')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface GrowthRateSheetProps {
  visible: boolean;
  onClose: () => void;
  previewMetrics?: readonly AppMetric[];
}

export function GrowthRateSheet({ visible, onClose, previewMetrics }: GrowthRateSheetProps) {
  const t = useT();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('growthRate.title')}>
      <GrowthRateEditor previewMetrics={previewMetrics} onApplied={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 46, minWidth: 110 },
  input: { flex: 1, fontSize: 20, fontWeight: '700', paddingVertical: 0, textAlign: 'right', marginRight: 4 },
  slider: { width: '100%', height: 40, marginTop: spacing.md },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  preset: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  preview: { marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  previewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  clearLink: { paddingVertical: spacing.md },
});
