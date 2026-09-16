import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { PercentField } from '@/components/simulation/PercentField';
import { radius, spacing } from '@/constants/theme';
import { usePostAudienceSplits } from '@/features/analytics/useAudienceSplits';
import { useAudienceMix, useSimulationActions } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT } from '@/i18n';
import { clampPercent, round1 } from '@/services/analytics/audienceMix';
import { formatPercent } from '@/utils/format';

const FOLLOWER_PRESETS = [0.3, 0.5, 0.7, 1, 2, 5];
const WOMEN_PRESETS = [3, 5, 7, 10, 20];
const VARIANCE_PRESETS = [0, 0.5, 1, 2, 5];

export interface AudienceMixEditorProps {
  /** Set to edit one post instead of the account-wide mix. */
  mediaId?: string;
  onApplied?: () => void;
  /** Inline card (Simulation Lab) or sheet body. */
  compact?: boolean;
}

/**
 * The two audience splits every stats screen shows: followers vs non-followers and
 * women vs men.
 *
 * Without a `mediaId` it edits the account-wide mix — the base value plus how far a
 * single video may drift from it, which is what makes one reel read 6 / 94 and the next
 * 8 / 92 while the account keeps the mix. With a `mediaId` it pins that one post, and
 * "follow the mix" hands it back to the drift.
 */
export function AudienceMixEditor({ mediaId, onApplied, compact = false }: AudienceMixEditorProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const mix = useAudienceMix();
  const actions = useSimulationActions();
  const splits = usePostAudienceSplits(mediaId);

  const isPost = Boolean(mediaId);
  const [followerShare, setFollowerShare] = useState(isPost ? splits.followerShare : mix.followerShare);
  const [followerVariance, setFollowerVariance] = useState(mix.followerVariance);
  const [womenShare, setWomenShare] = useState(isPost ? splits.women : mix.womenShare);
  const [genderVariance, setGenderVariance] = useState(mix.genderVariance);

  // Re-sync when the stored values change underneath (scenario switch, reset elsewhere).
  const signature = `${mix.followerShare}|${mix.followerVariance}|${mix.womenShare}|${mix.genderVariance}|${splits.followerShare}|${splits.women}`;
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setFollowerShare(isPost ? splits.followerShare : mix.followerShare);
    setFollowerVariance(mix.followerVariance);
    setWomenShare(isPost ? splits.women : mix.womenShare);
    setGenderVariance(mix.genderVariance);
  }

  const pct = (value: number) => formatPercent(value, language, 1).replace('+', '');
  const spread = (base: number, variance: number) => `${pct(clampPercent(base - variance))} – ${pct(clampPercent(base + variance))}`;

  const apply = () => {
    if (mediaId) actions.setMediaAudienceMix(mediaId, { followerShare, womenShare });
    else actions.setAudienceMix({ followerShare, followerVariance, womenShare, genderVariance });
    triggerHaptic('success');
    onApplied?.();
  };

  const reset = () => {
    if (mediaId) actions.clearMediaAudienceMix(mediaId);
    else actions.resetAudienceMix();
    triggerHaptic('warning');
    onApplied?.();
  };

  const isCustomPost = isPost && (splits.followerIsCustom || splits.genderIsCustom);

  return (
    <View style={compact ? undefined : styles.body}>
      <Text variant="caption" color="secondary">
        {isPost ? t('audienceMix.postSubtitle') : t('audienceMix.subtitle')}
      </Text>

      <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
        <View style={styles.summaryItem}>
          <Text variant="small" color="secondary" numberOfLines={1}>
            {t('audienceMix.nonFollowers')}
          </Text>
          <Text variant="heading" weight="700" numberOfLines={1}>
            {pct(round1(100 - followerShare))}
          </Text>
          <Text variant="small" color="tertiary" numberOfLines={1}>
            {t('audienceMix.followers')} {pct(followerShare)}
          </Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text variant="small" color="secondary" numberOfLines={1}>
            {t('insights.men')}
          </Text>
          <Text variant="heading" weight="700" numberOfLines={1}>
            {pct(round1(100 - womenShare))}
          </Text>
          <Text variant="small" color="tertiary" numberOfLines={1}>
            {t('insights.women')} {pct(womenShare)}
          </Text>
        </View>
      </View>

      <PercentField
        label={t('audienceMix.followerShare')}
        counterpart={`${t('audienceMix.nonFollowers')} · ${pct(round1(100 - followerShare))}`}
        value={followerShare}
        onChange={setFollowerShare}
        presets={FOLLOWER_PRESETS}
        fine
      />
      {isPost ? null : (
        <PercentField
          label={t('audienceMix.followerVariance')}
          value={followerVariance}
          onChange={setFollowerVariance}
          presets={VARIANCE_PRESETS}
          max={50}
          suffix="±%"
          hint={t('audienceMix.range', { range: spread(followerShare, followerVariance) })}
          tone="simulation"
        />
      )}

      <PercentField
        label={t('audienceMix.womenShare')}
        counterpart={`${t('insights.men')} · ${pct(round1(100 - womenShare))}`}
        value={womenShare}
        onChange={setWomenShare}
        presets={WOMEN_PRESETS}
      />
      {isPost ? null : (
        <PercentField
          label={t('audienceMix.genderVariance')}
          value={genderVariance}
          onChange={setGenderVariance}
          presets={VARIANCE_PRESETS}
          max={50}
          suffix="±%"
          hint={t('audienceMix.range', { range: spread(womenShare, genderVariance) })}
          tone="simulation"
        />
      )}

      <Text variant="small" color="tertiary" style={{ marginTop: spacing.sm }}>
        {isPost ? t('audienceMix.postHint') : t('audienceMix.hint')}
      </Text>

      <Button title={t('common.apply')} size="lg" onPress={apply} style={{ marginTop: spacing.lg }} />
      {!isPost || isCustomPost ? (
        <Pressable onPress={reset} accessibilityRole="button" accessibilityLabel={isPost ? t('audienceMix.followMix') : t('audienceMix.resetDefaults')} style={styles.clearLink}>
          <Text variant="bodyStrong" color="secondary" align="center">
            {isPost ? t('audienceMix.followMix') : t('audienceMix.resetDefaults')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function AudienceMixSheet({ visible, onClose, mediaId }: { visible: boolean; onClose: () => void; mediaId?: string }) {
  const t = useT();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={mediaId ? t('audienceMix.postTitle') : t('audienceMix.title')}>
      <AudienceMixEditor mediaId={mediaId} onApplied={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  summary: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.md },
  summaryItem: { flex: 1 },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: spacing.md },
  clearLink: { paddingVertical: spacing.md },
});
