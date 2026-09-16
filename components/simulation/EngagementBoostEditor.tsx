import Slider from '@react-native-community/slider';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { Divider } from '@/components/common/Primitives';
import { Text } from '@/components/common/Text';
import { ChevronDownIcon, ChevronRightIcon } from '@/components/icons';
import { fontStyles } from '@/constants/fonts';
import { radius, spacing } from '@/constants/theme';
import { flattenMedia, useAccount, useAccountInsights, useMediaFeed } from '@/features/instagram/hooks';
import { useBoosts, useGrowthPercent, useSimulationActions, useSimulationEnabled } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { lowerCase, useLanguage, useT, type TranslationKey } from '@/i18n';
import { applyBoost, boostsEqual, countBoosts, effectiveDial, normalizeBoosts } from '@/services/simulation/boost';
import { clampGrowth, GROWTH_RATE_PRESETS } from '@/services/simulation/growth';
import { BOOST_KEYS, type BoostKey, type BoostMap } from '@/types/simulation';
import { buildDateRange } from '@/utils/date';
import { formatCompact } from '@/utils/format';

const SLIDER_MIN = -50;
const SLIDER_MAX = 300;

interface PreviewEntry {
  /** Real value the dial is previewed against. */
  value: number;
  /** i18n key of the unit line ("avg. per post", "last 30 days"). */
  unit: TranslationKey;
}

/**
 * Real reference values for the live preview: follower count, average plays per
 * video, account views (30 days), average likes / comments per post.
 */
export function useBoostPreview(): Partial<Record<BoostKey, PreviewEntry>> {
  const { data: account } = useAccount();
  const range = useMemo(() => buildDateRange('30d'), []);
  const insights = useAccountInsights(range);
  const feed = useMediaFeed();
  const media = useMemo(() => flattenMedia(feed.data?.pages), [feed.data]);
  const views30 = insights.data?.metrics.find((m) => m.key === 'views')?.value;

  return useMemo(() => {
    const out: Partial<Record<BoostKey, PreviewEntry>> = {};
    const avg = (values: number[]) => (values.length > 0 ? Math.round(values.reduce((acc, v) => acc + v, 0) / values.length) : undefined);
    if (account) out.followers = { value: account.followersCount, unit: 'metric.totalFollowers' };
    const plays = avg(media.map((m) => m.viewCount).filter((v): v is number => v !== undefined));
    if (plays !== undefined) out.plays = { value: plays, unit: 'boost.avgPerVideo' };
    if (views30 !== undefined) out.views = { value: views30, unit: 'boost.last30' };
    const likes = avg(media.map((m) => m.likeCount));
    if (likes !== undefined) out.likes = { value: likes, unit: 'boost.avgPerPost' };
    const comments = avg(media.map((m) => m.commentCount));
    if (comments !== undefined) out.comments = { value: comments, unit: 'boost.avgPerPost' };
    return out;
  }, [account, media, views30]);
}

function formatPercent(percent: number): string {
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

interface EngagementBoostEditorProps {
  onApplied?: () => void;
  /** Inline card (Scenario Lab) or sheet body. */
  compact?: boolean;
}

/**
 * "Etkileşimi artır": five dials — followers, plays, views, likes, comments — each
 * its own percentage. Tap a row to expand its slider; Apply commits all at once.
 */
export function EngagementBoostEditor({ onApplied, compact = false }: EngagementBoostEditorProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const current = useBoosts();
  const growth = useGrowthPercent();
  const enabled = useSimulationEnabled();
  const actions = useSimulationActions();
  const preview = useBoostPreview();

  const [draft, setDraft] = useState<BoostMap>(() => ({ ...current }));
  const [expanded, setExpanded] = useState<BoostKey | null>(null);
  const [text, setText] = useState<string>('');
  const [prevCurrent, setPrevCurrent] = useState(current);
  if (current !== prevCurrent) {
    setPrevCurrent(current);
    setDraft({ ...current });
  }

  const dirty = !boostsEqual(normalizeBoosts(draft), current);
  const setCount = countBoosts(draft);

  const commit = (key: BoostKey, next: number) => {
    const clamped = clampGrowth(next);
    setDraft((d) => ({ ...d, [key]: clamped }));
    setText(String(clamped));
  };

  const toggle = (key: BoostKey) => {
    triggerHaptic('selection');
    const next = expanded === key ? null : key;
    setExpanded(next);
    if (next) setText(String(draft[next] ?? 0));
  };

  const apply = () => {
    actions.setBoosts(draft);
    if (!enabled) actions.setEnabled(true);
    triggerHaptic('success');
    onApplied?.();
  };

  const clear = () => {
    actions.clearBoosts();
    setDraft({});
    setExpanded(null);
    triggerHaptic('light');
    onApplied?.();
  };

  return (
    <View style={compact ? undefined : styles.body}>
      <Text variant="caption" color="secondary" style={compact ? styles.subtitleCompact : styles.subtitle}>
        {t('boost.subtitle')}
      </Text>

      {BOOST_KEYS.map((key, index) => {
        const value = draft[key];
        const isSet = value !== undefined && value !== 0;
        const isOpen = expanded === key;
        const entry = preview[key];
        // A dial that is not set follows the other dials (coupled model) or the growth rate.
        const effective = effectiveDial(draft, key, growth);
        const after = entry ? applyBoost(entry.value, effective.percent) : undefined;
        const tone = effective.percent > 0 ? 'success' : effective.percent < 0 ? 'danger' : 'tertiary';
        return (
          <View key={key}>
            {index > 0 ? <Divider /> : null}
            <Pressable
              onPress={() => toggle(key)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${t(`boost.${key}`)} ${isSet ? formatPercent(value) : t('boost.notSet')}`}
              style={styles.row}
            >
              <View style={{ flex: 1 }}>
                <Text variant="body">{t(`boost.${key}`)}</Text>
                <Text variant="small" color="tertiary" numberOfLines={2}>
                  {t(`boost.${key}Hint`)}
                </Text>
                {entry ? (
                  <View style={styles.previewRow}>
                    <Text variant="caption" color="secondary">
                      {formatCompact(entry.value, language)}
                    </Text>
                    {after !== undefined && after !== entry.value ? (
                      <>
                        <Text variant="caption" color="tertiary" style={{ marginHorizontal: 6 }}>
                          →
                        </Text>
                        <Text variant="captionStrong">{formatCompact(after, language)}</Text>
                      </>
                    ) : null}
                    <Text variant="small" color="tertiary" style={{ marginLeft: 6 }}>
                      · {lowerCase(t(entry.unit), language)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.rowRight}>
                <Text variant="bodyStrong" weight="700" color={effective.source === 'set' ? tone : effective.source === 'none' ? 'tertiary' : 'secondary'}>
                  {effective.source === 'none' ? t('boost.notSet') : formatPercent(effective.percent)}
                </Text>
                {effective.source === 'induced' || effective.source === 'growth' ? (
                  <Text variant="small" color="tertiary">
                    {effective.source === 'induced' ? t('boost.induced') : t('boost.fromGrowth')}
                  </Text>
                ) : null}
              </View>
              {isOpen ? <ChevronDownIcon size={16} color={colors.textTertiary} /> : <ChevronRightIcon size={16} color={colors.textTertiary} />}
            </Pressable>

            {isOpen ? (
              <View style={styles.editor}>
                <View style={styles.editorHeader}>
                  <Slider
                    style={styles.slider}
                    minimumValue={SLIDER_MIN}
                    maximumValue={SLIDER_MAX}
                    step={1}
                    value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, value ?? 0))}
                    onValueChange={(v) => commit(key, v)}
                    onSlidingComplete={() => triggerHaptic('selection')}
                    minimumTrackTintColor={(value ?? 0) < 0 ? colors.danger : colors.primary}
                    maximumTrackTintColor={colors.borderStrong}
                    thumbTintColor={colors.primary}
                    accessibilityLabel={t(`boost.${key}`)}
                  />
                  <View style={[styles.inputWrap, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceElevated }]}>
                    <TextInput
                      value={text}
                      onChangeText={(v) => {
                        setText(v);
                        const parsed = Number(v.replace(',', '.').replace('%', '').replace('+', ''));
                        if (Number.isFinite(parsed)) setDraft((d) => ({ ...d, [key]: clampGrowth(parsed) }));
                      }}
                      onBlur={() => setText(String(draft[key] ?? 0))}
                      keyboardType="numbers-and-punctuation"
                      returnKeyType="done"
                      selectTextOnFocus
                      style={[styles.input, { color: colors.text }]}
                      accessibilityLabel={`${t(`boost.${key}`)} %`}
                    />
                    <Text variant="captionStrong" color="secondary">
                      %
                    </Text>
                  </View>
                </View>
                <View style={styles.presets}>
                  {GROWTH_RATE_PRESETS.map((p) => {
                    const active = value === p;
                    return (
                      <Pressable
                        key={p}
                        onPress={() => {
                          triggerHaptic('selection');
                          commit(key, p);
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
                      commit(key, -25);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('boost.decline')}
                    style={[styles.preset, { backgroundColor: value === -25 ? colors.text : colors.secondaryButton }]}
                  >
                    <Text variant="captionStrong" style={{ color: value === -25 ? colors.background : colors.text }}>
                      −25%
                    </Text>
                  </Pressable>
                  {isSet ? (
                    <Pressable
                      onPress={() => {
                        triggerHaptic('selection');
                        commit(key, 0);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('boost.notSet')}
                      style={[styles.preset, { backgroundColor: colors.secondaryButton }]}
                    >
                      <Text variant="captionStrong" color="secondary">
                        {t('boost.notSet')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        );
      })}

      <Text variant="small" color="tertiary" style={{ marginTop: spacing.md }}>
        {t('boost.hint')}
      </Text>

      <Button
        title={setCount > 0 ? `${t('boost.apply')} · ${t('boost.active', { n: setCount, total: BOOST_KEYS.length })}` : t('boost.apply')}
        size="lg"
        onPress={apply}
        disabled={!dirty}
        style={{ marginTop: spacing.lg }}
      />
      {countBoosts(current) > 0 ? (
        <Pressable onPress={clear} accessibilityRole="button" accessibilityLabel={t('boost.clear')} style={styles.clearLink}>
          <Text variant="bodyStrong" color="secondary" align="center">
            {t('boost.clear')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface EngagementBoostSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function EngagementBoostSheet({ visible, onClose }: EngagementBoostSheetProps) {
  const t = useT();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('boost.title')} disableGesture>
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <EngagementBoostEditor onApplied={onClose} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  subtitle: { marginBottom: spacing.sm },
  subtitleCompact: { marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  rowRight: { alignItems: 'flex-end' },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  editor: { paddingBottom: spacing.md },
  editorHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  slider: { flex: 1, height: 40 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2, height: 40, minWidth: 84 },
  input: { flex: 1, fontSize: 16, paddingVertical: 0, textAlign: 'right', marginRight: 2, ...fontStyles.bold },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  preset: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  clearLink: { paddingVertical: spacing.md },
});
