import Slider from '@react-native-community/slider';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Primitives';
import { StatCounter } from '@/components/common/StatCounter';
import { Text } from '@/components/common/Text';
import { radius, spacing } from '@/constants/theme';
import { useSimulationActions, useSimulationEnabled, useOverrides } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT, type TranslationKey } from '@/i18n';
import { applyFactor } from '@/services/simulation/resolve';
import type { MetricKey } from '@/types/app';
import { GROWTH_PRESETS, overrideKey, type SimulationScope } from '@/types/simulation';
import { clamp, formatCompact, formatNumber, parseNumericInput } from '@/utils/format';

/* ------------------------------------------------------------------ */
/* Context: any screen can open the editor for a metric                 */
/* ------------------------------------------------------------------ */

export interface EditorRequest {
  scope: SimulationScope;
  metric: MetricKey;
  realValue: number;
  /** Optional label override (e.g. media caption) */
  subtitle?: string;
}

interface EditorContextValue {
  open: (request: EditorRequest) => void;
}

const EditorContext = createContext<EditorContextValue>({ open: () => undefined });

export function useMetricEditor(): EditorContextValue {
  return useContext(EditorContext);
}

export function metricLabelKey(metric: MetricKey): TranslationKey {
  return `metric.${metric}` as TranslationKey;
}

/**
 * Provider that hosts a single bottom-sheet editor. When Simulation Mode is off it
 * first asks whether to turn it on (real data is never edited).
 */
export function MetricEditorProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<EditorRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const [askEnable, setAskEnable] = useState(false);
  const enabled = useSimulationEnabled();
  const { setEnabled } = useSimulationActions();

  const open = useCallback(
    (req: EditorRequest) => {
      setRequest(req);
      if (!enabled) {
        setAskEnable(true);
      } else {
        setVisible(true);
      }
    },
    [enabled],
  );

  const value = useMemo(() => ({ open }), [open]);

  return (
    <EditorContext.Provider value={value}>
      {children}
      <EnablePrompt
        visible={askEnable}
        onClose={() => setAskEnable(false)}
        onConfirm={() => {
          setEnabled(true);
          setAskEnable(false);
          triggerHaptic('medium');
          setTimeout(() => setVisible(true), 220);
        }}
      />
      {request ? <SimulationMetricEditor visible={visible} request={request} onClose={() => setVisible(false)} /> : null}
    </EditorContext.Provider>
  );
}

function EnablePrompt({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: () => void }) {
  const t = useT();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('sim.badgeLong')}>
      <View style={styles.promptBody}>
        <Text variant="body" color="secondary" align="center">
          {t('sim.turnOnPrompt')}
        </Text>
        <Text variant="caption" color="tertiary" align="center" style={{ marginTop: spacing.sm }}>
          {t('sim.dataIsolation')}
        </Text>
        <Button title={t('sim.turnOn')} variant="simulation" onPress={onConfirm} style={{ marginTop: spacing.xl }} />
        <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ marginTop: spacing.sm }} />
      </View>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Editor sheet                                                         */
/* ------------------------------------------------------------------ */

interface EditorProps {
  visible: boolean;
  request: EditorRequest;
  onClose: () => void;
}

export function SimulationMetricEditor({ visible, request, onClose }: EditorProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const overrides = useOverrides();
  const { setOverride, clearOverride } = useSimulationActions();
  const { scope, metric, realValue } = request;
  const existing = overrides[overrideKey(scope, metric)];

  const [value, setValue] = useState(existing ?? realValue);
  const [text, setText] = useState(formatNumber(existing ?? realValue, language));
  const [focused, setFocused] = useState(false);

  // Reset the draft whenever the sheet opens for a (possibly different) metric.
  const currentKey = `${visible ? 'open' : 'closed'}:${overrideKey(scope, metric)}`;
  const [prevKey, setPrevKey] = useState(currentKey);
  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    if (visible) {
      const initial = existing ?? realValue;
      setValue(initial);
      setText(formatNumber(initial, language));
    }
  }

  const sliderMax = useMemo(() => Math.max(1_000_000, realValue * 20, value), [realValue, value]);
  const isRate = metric === 'avg_watch_time';

  const commit = (next: number) => {
    const safe = clamp(Math.round(next), 0, Number.MAX_SAFE_INTEGER);
    setValue(safe);
    setText(formatNumber(safe, language));
  };

  const onChangeText = (input: string) => {
    setText(input);
    const parsed = parseNumericInput(input);
    if (parsed !== null) setValue(parsed);
  };

  const apply = () => {
    setOverride(scope, metric, value);
    triggerHaptic('success');
    onClose();
  };

  const reset = () => {
    clearOverride(scope, metric);
    triggerHaptic('light');
    onClose();
  };

  const delta = realValue > 0 ? ((value - realValue) / realValue) * 100 : null;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text variant="heading" weight="700">
              {t(metricLabelKey(metric))}
            </Text>
            {request.subtitle ? (
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {request.subtitle}
              </Text>
            ) : null}
          </View>
          <Chip label={t('sim.badge')} tone="simulation" small />
        </View>

        <View style={styles.valuesRow}>
          <View style={styles.valueBox}>
            <Text variant="caption" color="secondary">
              {t('sim.realValue')}
            </Text>
            <Text variant="title" weight="700" style={{ marginTop: 2 }}>
              {isRate ? realValue.toString() : formatNumber(realValue, language)}
            </Text>
          </View>
          <View style={styles.valueBox}>
            <Text variant="caption" color="secondary">
              {t('sim.simulatedValue')}
            </Text>
            <View style={styles.simValueRow}>
              <StatCounter value={value} format="full" variant="title" weight="700" color="simulation" durationMs={400} />
              {delta !== null && delta !== 0 ? (
                <Text variant="small" color={delta > 0 ? 'success' : 'danger'} style={{ marginLeft: spacing.sm }}>
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(0)}%
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.inputWrap, { borderColor: focused ? colors.simulation : colors.borderStrong, backgroundColor: colors.surfaceElevated }]}>
          <TextInput
            value={text}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setText(formatNumber(value, language));
            }}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            selectTextOnFocus
            style={[styles.input, { color: colors.text }]}
            accessibilityLabel={t('sim.simulatedValue')}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
          />
          <Text variant="caption" color="secondary">
            {formatCompact(value, language)}
          </Text>
        </View>

        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={sliderMax}
          value={Math.min(value, sliderMax)}
          step={1}
          onValueChange={(v) => commit(v)}
          onSlidingComplete={() => triggerHaptic('selection')}
          minimumTrackTintColor={colors.simulation}
          maximumTrackTintColor={colors.borderStrong}
          thumbTintColor={colors.simulation}
          accessibilityLabel={t('sim.simulatedValue')}
        />
        <View style={styles.sliderLabels}>
          <Text variant="small" color="tertiary">
            0
          </Text>
          <Text variant="small" color="tertiary">
            {t('sim.sliderMax')} {formatCompact(sliderMax, language)}
          </Text>
        </View>

        <Text variant="captionStrong" color="secondary" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          {t('sim.presets')}
        </Text>
        <View style={styles.presets}>
          {GROWTH_PRESETS.map((preset) => (
            <Pressable
              key={preset.label}
              accessibilityRole="button"
              accessibilityLabel={preset.label}
              onPress={() => {
                triggerHaptic('selection');
                commit(applyFactor(realValue, preset.factor));
              }}
              style={({ pressed }) => [
                styles.preset,
                { backgroundColor: pressed ? colors.simulationSoft : colors.secondaryButton, borderColor: colors.borderStrong },
              ]}
            >
              <Text variant="captionStrong">{preset.label}</Text>
            </Pressable>
          ))}
        </View>

        <Button title={t('sim.applySimulation')} variant="simulation" size="lg" onPress={apply} style={{ marginTop: spacing.xl }} />
        <Pressable onPress={reset} accessibilityRole="button" accessibilityLabel={t('sim.resetToReal')} style={styles.resetLink}>
          <Text variant="bodyStrong" color="secondary" align="center">
            {t('sim.resetToReal')}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  promptBody: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  valuesRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  valueBox: { flex: 1 },
  simValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52 },
  input: { flex: 1, fontSize: 22, fontWeight: '700', paddingVertical: 0 },
  slider: { width: '100%', height: 40, marginTop: spacing.md },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  resetLink: { paddingVertical: spacing.lg },
});
