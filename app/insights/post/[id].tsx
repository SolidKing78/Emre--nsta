import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { FactorList } from '@/components/analytics/insights/FactorList';
import { ChipRow, InsightBars, SectionHeading, TopTabs } from '@/components/analytics/insights/primitives';
import { ComparisonChart } from '@/components/charts/ComparisonChart';
import { PlaybackChart } from '@/components/charts/PlaybackChart';
import { AppHeader } from '@/components/common/AppHeader';
import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { Chip, Divider, ListRow, ToggleRow } from '@/components/common/Primitives';
import { Screen } from '@/components/common/Screen';
import { ErrorState } from '@/components/common/States';
import { StatCounter } from '@/components/common/StatCounter';
import { Text } from '@/components/common/Text';
import { MediaVideo } from '@/components/feed/MediaVideo';
import { BookmarkIcon, ChevronRightIcon, CommentIcon, HeartIcon, InfoIcon, MoreIcon, RepostIcon, ShareIcon, TrendUpIcon } from '@/components/icons';
import { AudienceMixSheet } from '@/components/simulation/AudienceMixEditor';
import { EngagementBoostSheet } from '@/components/simulation/EngagementBoostEditor';
import { useMetricEditor } from '@/components/simulation/SimulationMetricEditor';
import { StatPercentSheet, type StatEdit } from '@/components/simulation/StatPercentSheet';
import { radius, spacing, touch } from '@/constants/theme';
import { useEffectiveAudience, usePostAudienceSplits } from '@/features/analytics/useAudienceSplits';
import { useMediaDetail } from '@/features/instagram/useMediaDetail';
import {
  useAudienceMix,
  useDisplayMetrics,
  useMediaAudienceMixMap,
  useMediaStats,
  useSimulationActions,
  useSimulationEnabled,
  useSimulationIndicators,
  type DisplayMetric,
} from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT, type TranslationKey } from '@/i18n';
import { buildPostBreakdown, completePostMetrics } from '@/services/analytics/postInsights';
import {
  applyBucketOverrides,
  buildEngagementCurve,
  buildViewFactors,
  buildViewsOverTime,
  buildWatchCurve,
  durationOf,
  statKey,
} from '@/services/analytics/reelInsights';
import type { AppMetric, MetricKey } from '@/types/app';
import { SIMULATABLE_MEDIA_METRICS } from '@/types/simulation';
import { formatShare, formatWatchTime } from '@/utils/format';

type Tab = 'overview' | 'engagement' | 'audience';
type AudienceChip = 'age' | 'country' | 'gender';
type ViewerChip = 'all' | 'followers' | 'nonFollowers';
type InfoKey = 'summary' | 'sources' | 'viewsOverTime' | 'actions' | 'interactions' | 'viewers' | 'audience' | 'factors' | 'watchTime' | 'engagementTiming';

const AGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const INFO_TEXT: Record<InfoKey, TranslationKey> = {
  summary: 'postInsights.infoSummary',
  sources: 'postInsights.infoSources',
  viewsOverTime: 'postInsights.infoViewsOverTime',
  actions: 'postInsights.infoActions',
  interactions: 'postInsights.infoInteractions',
  viewers: 'postInsights.infoViewers',
  audience: 'postInsights.infoAudience',
  factors: 'postInsights.infoFactors',
  watchTime: 'postInsights.infoWatchTime',
  engagementTiming: 'postInsights.infoEngagementTiming',
};

/**
 * Instagram "Gönderi istatistikleri" / "Reels videosu istatistikleri", section for section:
 * thumbnail, the five action counts, then Genel Bakış / Etkileşim / Hedef Kitle.
 *
 * Genel Bakış carries the summary cards, the cumulative view curve against a typical post,
 * the rates that drove the reach, the watch-time curve and the view sources; Etkileşim the
 * two count lists and when people interacted; Hedef Kitle the follower split and the
 * age / country / gender bars.
 *
 * **Every number is editable.** Counts go through the scenario overlay (long-press → the
 * metric editor); percentages — factor rates, view sources, age and country bars, the
 * curves' shape — are per-post overrides (long-press → the percentage sheet). The header
 * carries Instagram's 📈 and ⋯; ⋯ opens the scenario tools.
 */
export default function PostInsightsScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const t = useT();
  const language = useLanguage();
  const { width } = useWindowDimensions();
  const editor = useMetricEditor();
  const simulation = useSimulationEnabled();
  const indicators = useSimulationIndicators();
  const actions = useSimulationActions();
  const [tab, setTab] = useState<Tab>(tabParam === 'engagement' || tabParam === 'audience' ? tabParam : 'overview');
  const [chip, setChip] = useState<AudienceChip>('age');
  const [viewerChip, setViewerChip] = useState<ViewerChip>('all');
  const [info, setInfo] = useState<InfoKey | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [statEdit, setStatEdit] = useState<StatEdit | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);

  const detail = useMediaDetail(id);
  const audience = useEffectiveAudience();
  const mix = useAudienceMix();
  const mediaAudienceMix = useMediaAudienceMixMap();
  const media = detail.media;
  const realMedia = detail.realMedia;
  const mediaId = media?.id ?? id;
  const stats = useMediaStats(mediaId);
  const isReel = media?.type === 'REEL' || media?.type === 'VIDEO';

  // Source metrics + deterministic fill-ins → scenario overlay.
  const splits = usePostAudienceSplits(mediaId);
  const baseMetrics = useMemo<AppMetric[]>(() => (realMedia ? completePostMetrics(realMedia, detail.realInsight) : []), [realMedia, detail.realInsight]);
  const metrics = useDisplayMetrics(detail.scope, baseMetrics);
  const byKey = (key: MetricKey): DisplayMetric | undefined => metrics.find((m) => m.key === key);

  const values = useMemo(() => Object.fromEntries(metrics.map((m) => [m.key, m.value])) as Partial<Record<MetricKey, number>>, [metrics]);
  const factors = useMemo(() => (realMedia ? buildViewFactors(realMedia, values, stats) : []), [realMedia, values, stats]);
  const viewsOverTime = useMemo(() => (realMedia ? buildViewsOverTime(realMedia, values.views ?? 0, stats) : null), [realMedia, values.views, stats]);
  const durationSec = realMedia ? durationOf(realMedia, values.avg_watch_time) : 30;
  const watchCurve = useMemo(
    () => (realMedia ? buildWatchCurve(realMedia, durationSec, detail.realInsight?.retention, stats) : null),
    [realMedia, durationSec, detail.realInsight?.retention, stats],
  );
  const engagementCurve = useMemo(() => (realMedia ? buildEngagementCurve(realMedia, durationSec, stats) : null), [realMedia, durationSec, stats]);

  const breakdown = useMemo(
    () => (realMedia ? buildPostBreakdown(realMedia, mix, mediaAudienceMix[realMedia.id]) : null),
    [realMedia, mix, mediaAudienceMix],
  );
  const sources = useMemo(() => {
    if (!breakdown) return [];
    return applyBucketOverrides(
      breakdown.sources.map((s) => ({ key: s.key, label: t(`postInsights.source.${s.key}`), percent: s.share })),
      'source',
      stats,
    ).sort((a, b) => b.percent - a.percent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown, stats, language]);

  const ages = useMemo(() => {
    if (!audience) return [];
    const ordered = [...audience.ages].sort((a, b) => AGE_ORDER.indexOf(a.label) - AGE_ORDER.indexOf(b.label));
    return applyBucketOverrides(ordered.map((a) => ({ key: a.label, label: a.label, percent: a.value })), 'age', stats);
  }, [audience, stats]);
  const countries = useMemo(() => {
    if (!audience) return [];
    return applyBucketOverrides(audience.countries.map((c) => ({ key: c.label, label: c.label, percent: c.value })), 'country', stats).sort((a, b) => b.percent - a.percent);
  }, [audience, stats]);

  // The chips scale both curves, so "Takipçiler" shows the slice of views they account for.
  const viewerShare = viewerChip === 'all' ? 1 : viewerChip === 'followers' ? splits.followerShare / 100 : splits.nonFollowerShare / 100;

  const openEditor = (key: MetricKey) => {
    const m = byKey(key);
    if (m) editor.open({ scope: detail.scope, metric: key, realValue: m.realValue, subtitle: media?.caption.split('\n')[0] });
  };
  const pressProps = (key: MetricKey) => ({
    onLongPress: () => openEditor(key),
    delayLongPress: touch.longPressMs,
  });
  const openStat = (edit: StatEdit) => {
    triggerHaptic('selection');
    setStatEdit(edit);
  };

  const pct = (value: number) => formatShare(value, language);
  const valueColor = (m: DisplayMetric | undefined) => (indicators && m?.isSimulated ? ('simulation' as const) : ('primary' as const));
  const cardBg = isDark ? colors.sheet : colors.surfaceElevated;

  const resetPost = () => {
    setMenuOpen(false);
    Alert.alert(t('postInsights.resetPost'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.reset'),
        style: 'destructive',
        onPress: () => {
          for (const key of SIMULATABLE_MEDIA_METRICS) actions.clearOverride(detail.scope, key);
          actions.clearMediaStats(mediaId);
          actions.clearMediaAudienceMix(mediaId);
          triggerHaptic('warning');
        },
      },
    ]);
  };

  if (detail.error && !media) {
    return (
      <Screen>
        <AppHeader title={t('postInsights.title')} showBack />
        <ErrorState error={detail.error} onRetry={detail.refetch} />
      </Screen>
    );
  }

  const title = isReel ? t('postInsights.titleReel') : t('postInsights.title');
  const thumbWidth = isReel ? Math.round(width * 0.33) : Math.min(200, Math.round(width * 0.44));
  // Instagram crops the post thumbnail square here; reels keep 9:16.
  const thumbAspect = isReel ? 9 / 16 : 1;

  const counts: { key: MetricKey; icon: React.ReactNode; label: TranslationKey }[] = [
    { key: 'likes', icon: <HeartIcon size={26} color={colors.text} strokeWidth={1.6} />, label: 'postInsights.likes' },
    { key: 'comments', icon: <CommentIcon size={26} color={colors.text} strokeWidth={1.6} />, label: 'postInsights.comments' },
    { key: 'reposts', icon: <RepostIcon size={26} color={colors.text} strokeWidth={1.6} />, label: 'postInsights.reposts' },
    { key: 'shares', icon: <ShareIcon size={26} color={colors.text} strokeWidth={1.6} />, label: 'postInsights.shares' },
    { key: 'saves', icon: <BookmarkIcon size={26} color={colors.text} strokeWidth={1.6} />, label: 'postInsights.saves' },
  ];

  // Reels swap "Erişilen hesaplar" for "Görüntüleyenler" and profile visits for watch time.
  const summaryCards: { key: MetricKey; label: TranslationKey }[] = isReel
    ? [
        { key: 'views', label: 'postInsights.views' },
        { key: 'reach', label: 'postInsights.reelViewers' },
        { key: 'avg_watch_time', label: 'postInsights.avgWatchTime' },
        { key: 'follows_from_post', label: 'postInsights.follows' },
      ]
    : [
        { key: 'views', label: 'postInsights.views' },
        { key: 'reach', label: 'postInsights.reach' },
        { key: 'profile_visits', label: 'postInsights.profileVisits' },
        { key: 'follows_from_post', label: 'postInsights.follows' },
      ];

  const row = (key: MetricKey, label: string) => {
    const m = byKey(key);
    if (!m) return null;
    const isDuration = key === 'avg_watch_time';
    return (
      <Pressable key={key} {...pressProps(key)} style={styles.row} accessibilityRole="button" accessibilityLabel={`${label} ${m.value}`}>
        <Text variant="body" style={{ fontSize: 17, flex: 1 }}>
          {label}
        </Text>
        {isDuration ? (
          <Text variant="bodyStrong" weight="700" color={valueColor(m)} style={{ fontSize: 17 }}>
            {formatWatchTime(m.value, language)}
          </Text>
        ) : (
          <StatCounter value={m.value} format={m.value < 10_000 ? 'full' : 'compact'} variant="bodyStrong" weight="700" color={valueColor(m)} style={{ fontSize: 17 }} />
        )}
      </Pressable>
    );
  };

  /**
   * The clip preview above each playback curve. Instagram plays the reel there rather
   * than showing its cover, so this mounts the real player (muted, looping) whenever the
   * post has a video to play and falls back to the cover frame when it does not.
   */
  const clipWidth = Math.round(width * 0.26);
  const clipHeight = Math.round(clipWidth / (9 / 16));
  const clipPreview = media ? (
    <View style={styles.clip}>
      <View style={[styles.clipFrame, { width: clipWidth, height: clipHeight, backgroundColor: colors.skeleton }]}>
        {isReel && media.mediaUrl ? (
          <MediaVideo media={media} uri={media.mediaUrl} poster={media.thumbnailUrl} width={clipWidth} height={clipHeight} muted loop />
        ) : (
          <Image
            source={{ uri: media.thumbnailUrl || media.mediaUrl }}
            style={{ width: clipWidth, height: clipHeight }}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessibilityIgnoresInvertColors
          />
        )}
      </View>
    </View>
  ) : null;

  return (
    <Screen>
      <AppHeader
        title={title}
        showBack
        right={
          <View style={[styles.headerPill, { backgroundColor: colors.surfaceElevated }]}>
            <Pressable
              onPress={() => router.push('/insights')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('insights.title')}
              style={styles.headerAction}
            >
              <TrendUpIcon size={24} color={colors.text} strokeWidth={1.9} />
            </Pressable>
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('postInsights.menuTitle')} style={styles.headerAction}>
              <MoreIcon size={22} color={colors.text} />
            </Pressable>
          </View>
        }
      />
      {!media ? (
        <ActivityIndicator color={colors.textSecondary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          {/* Thumbnail + the five counts */}
          <View style={styles.top}>
            <Pressable onPress={() => router.push(`/media/${media.id}`)} accessibilityRole="imagebutton" accessibilityLabel={media.caption.slice(0, 40) || media.type}>
              <Image
                source={{ uri: media.thumbnailUrl || media.mediaUrl }}
                style={{ width: thumbWidth, height: Math.round(thumbWidth / thumbAspect), borderRadius: radius.lg, backgroundColor: colors.skeleton }}
                contentFit="cover"
                cachePolicy="memory-disk"
                accessibilityIgnoresInvertColors
              />
            </Pressable>
            <View style={styles.counts}>
              {counts.map((c) => {
                const m = byKey(c.key);
                return (
                  <Pressable key={c.key} {...pressProps(c.key)} style={styles.count} accessibilityRole="button" accessibilityLabel={`${t(c.label)} ${m?.value ?? 0}`}>
                    {c.icon}
                    <StatCounter value={m?.value ?? 0} format={(m?.value ?? 0) < 10_000 ? 'full' : 'compact'} variant="bodyStrong" weight="600" color={valueColor(m)} style={styles.countText} />
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Sticky tabs */}
          <View style={{ backgroundColor: colors.background }}>
            <TopTabs<Tab>
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'overview', label: t('postInsights.tabOverview') },
                { value: 'engagement', label: t('postInsights.tabEngagement') },
                { value: 'audience', label: t('postInsights.tabAudience') },
              ]}
            />
          </View>

          <View>
            {tab === 'overview' ? (
              <>
                <SectionHeading title={t('postInsights.summary')} onInfo={() => setInfo('summary')} />
                <View style={styles.cards}>
                  {summaryCards.map((card) => {
                    const m = byKey(card.key);
                    const isDuration = card.key === 'avg_watch_time';
                    return (
                      <Pressable key={card.key} {...pressProps(card.key)} style={[styles.card, { backgroundColor: cardBg }]} accessibilityRole="button" accessibilityLabel={`${t(card.label)} ${m?.value ?? 0}`}>
                        <Text variant="caption" color="secondary" numberOfLines={1}>
                          {t(card.label)}
                        </Text>
                        {isDuration ? (
                          <Text variant="heading" weight="700" color={valueColor(m)} style={styles.cardValue}>
                            {formatWatchTime(m?.value ?? 0, language)}
                          </Text>
                        ) : (
                          <StatCounter value={m?.value ?? 0} format={(m?.value ?? 0) < 100_000 ? 'full' : 'compact'} variant="heading" weight="700" color={valueColor(m)} style={styles.cardValue} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {/* Cumulative views against a typical post */}
                {viewsOverTime ? (
                  <>
                    <SectionHeading title={t('postInsights.viewsOverTime')} onInfo={() => setInfo('viewsOverTime')} right={viewsOverTime.isCustom && indicators ? <Chip label={t('audienceMix.custom')} tone="simulation" small /> : undefined} />
                    <ChipRow<ViewerChip>
                      value={viewerChip}
                      onChange={setViewerChip}
                      options={[
                        { value: 'all', label: t('postInsights.chipAll') },
                        { value: 'followers', label: t('postInsights.chipFollowers') },
                        { value: 'nonFollowers', label: t('postInsights.chipNonFollowers') },
                      ]}
                    />
                    <Pressable
                      style={styles.chart}
                      delayLongPress={touch.longPressMs}
                      accessibilityRole="button"
                      accessibilityLabel={t('postInsights.viewsOverTime')}
                      onLongPress={() =>
                        openStat({
                          key: statKey('views', 'typical'),
                          title: isReel ? t('postInsights.typicalReel') : t('postInsights.typicalPost'),
                          subtitle: t('postInsights.infoViewsOverTime'),
                          value: Math.round(((viewsOverTime.typical[viewsOverTime.typical.length - 1]?.value ?? 0) / Math.max(1, values.views ?? 1)) * 1000) / 10,
                          max: 400,
                          isCustom: viewsOverTime.isCustom,
                        })
                      }
                    >
                      <ComparisonChart
                        primary={viewsOverTime.points.map((p) => ({ t: p.t, value: Math.round(p.value * viewerShare) }))}
                        secondary={viewsOverTime.typical.map((p) => ({ t: p.t, value: Math.round(p.value * viewerShare) }))}
                        domain={viewsOverTime.windowMinutes}
                        labels={viewsOverTime.labels}
                        primaryLabel={isReel ? t('postInsights.thisReel') : t('postInsights.thisPost')}
                        secondaryLabel={isReel ? t('postInsights.typicalReel') : t('postInsights.typicalPost')}
                      />
                    </Pressable>
                  </>
                ) : null}

                {/* What drove the reach */}
                <SectionHeading title={t('postInsights.factors')} onInfo={() => setInfo('factors')} />
                <Text variant="caption" color="secondary" style={styles.sectionSub}>
                  {t('postInsights.factorsSub')}
                </Text>
                <FactorList
                  factors={factors}
                  format={pct}
                  indicators={indicators}
                  onEdit={(factor) =>
                    openStat({
                      key: statKey('factor', factor.key),
                      title: t(`postInsights.factor.${factor.key}`),
                      value: factor.percent,
                      max: factor.key === 'skip' ? 100 : 25,
                      isCustom: factor.isCustom,
                    })
                  }
                />

                {/* How long people watched */}
                {isReel && watchCurve ? (
                  <>
                    <SectionHeading title={t('postInsights.watchTime')} onInfo={() => setInfo('watchTime')} />
                    {clipPreview}
                    <Pressable
                      style={styles.chart}
                      delayLongPress={touch.longPressMs}
                      accessibilityRole="button"
                      accessibilityLabel={t('postInsights.watchTime')}
                      onLongPress={() =>
                        openStat({
                          key: statKey('watch', 'end'),
                          title: t('postInsights.watchTime'),
                          subtitle: t('postInsights.infoWatchTime'),
                          value: watchCurve.values[watchCurve.values.length - 1] ?? 0,
                          max: 100,
                          isCustom: watchCurve.isCustom,
                        })
                      }
                    >
                      <PlaybackChart values={watchCurve.values} max={watchCurve.max} durationSec={watchCurve.durationSec} />
                    </Pressable>
                  </>
                ) : null}

                {/* Where the views came from */}
                {sources.length > 0 ? (
                  <>
                    <SectionHeading title={t('postInsights.sources')} onInfo={() => setInfo('sources')} />
                    <InsightBars
                      max={100}
                      rows={sources.map((s) => ({ key: s.key, label: s.label, value: s.percent, display: pct(s.percent), custom: indicators && s.isCustom }))}
                      onRowLongPress={(bar) =>
                        openStat({
                          key: statKey('source', String(bar.key)),
                          title: bar.label,
                          subtitle: t('postInsights.infoSources'),
                          value: bar.value,
                          isCustom: sources.find((s) => s.key === bar.key)?.isCustom ?? false,
                        })
                      }
                    />
                  </>
                ) : null}

                {/* Instagram's ad entry point */}
                <SectionHeading title={t('postInsights.ads')} />
                <ListRow
                  title={isReel ? t('postInsights.promoteReel') : t('postInsights.promotePost')}
                  icon={<TrendUpIcon size={22} color={colors.text} strokeWidth={1.9} />}
                  right={<ChevronRightIcon size={16} color={colors.textTertiary} />}
                  chevron={false}
                  onPress={() => setPromoteOpen(true)}
                />
              </>
            ) : null}

            {tab === 'engagement' ? (
              <>
                <SectionHeading title={t('postInsights.actionsAfterView')} onInfo={() => setInfo('actions')} />
                <View style={styles.rows}>
                  {row('profile_visits', t('postInsights.profileVisits'))}
                  {row('follows_from_post', t('postInsights.follows'))}
                </View>
                <SectionHeading title={t('postInsights.interactions')} onInfo={() => setInfo('interactions')} />
                <View style={styles.rows}>
                  {row('likes', t('postInsights.likes'))}
                  {row('comments', t('postInsights.comments'))}
                  {row('reposts', t('postInsights.reposts'))}
                  {row('shares', t('postInsights.shares'))}
                  {row('saves', t('postInsights.saves'))}
                </View>

                {/* When people interacted during playback */}
                {isReel && engagementCurve ? (
                  <>
                    <SectionHeading title={t('postInsights.engagementTiming')} onInfo={() => setInfo('engagementTiming')} />
                    {clipPreview}
                    <Pressable
                      style={styles.chart}
                      delayLongPress={touch.longPressMs}
                      accessibilityRole="button"
                      accessibilityLabel={t('postInsights.engagementTiming')}
                      onLongPress={() =>
                        openStat({
                          key: statKey('engagement', 'peak'),
                          title: t('postInsights.engagementTiming'),
                          subtitle: t('postInsights.infoEngagementTiming'),
                          value: engagementCurve.values[0] ?? 0,
                          max: 100,
                          isCustom: engagementCurve.isCustom,
                        })
                      }
                    >
                      <PlaybackChart values={engagementCurve.values} max={engagementCurve.max} durationSec={engagementCurve.durationSec} smooth={false} />
                    </Pressable>
                  </>
                ) : null}
              </>
            ) : null}

            {tab === 'audience' ? (
              <>
                <SectionHeading
                  title={isReel ? t('postInsights.reelViewersTitle') : t('postInsights.viewers')}
                  onInfo={() => setInfo('viewers')}
                  right={indicators && splits.followerIsCustom ? <Chip label={t('audienceMix.custom')} tone="simulation" small /> : undefined}
                />
                {/* Long-press either split to pin it for this post; the Simulation Lab sets the account-wide mix. */}
                <InsightBars
                  max={100}
                  rows={[{ key: 'followers', label: t('postInsights.followersBar'), value: splits.followerShare, display: pct(splits.followerShare), custom: indicators && splits.followerIsCustom }]}
                  onRowLongPress={() => setAudienceOpen(true)}
                />
                <InsightBars
                  max={100}
                  colorA={colors.simulation}
                  rows={[{ key: 'nonFollowers', label: t('postInsights.nonFollowersBar'), value: splits.nonFollowerShare, display: pct(splits.nonFollowerShare), custom: indicators && splits.followerIsCustom }]}
                  onRowLongPress={() => setAudienceOpen(true)}
                />

                <SectionHeading title={t('postInsights.audienceDetails')} onInfo={() => setInfo('audience')} />
                <ChipRow<AudienceChip>
                  value={chip}
                  onChange={setChip}
                  options={[
                    { value: 'age', label: t('postInsights.chipAge') },
                    { value: 'country', label: t('postInsights.chipCountry') },
                    { value: 'gender', label: t('postInsights.chipGender') },
                  ]}
                />
                {audience ? (
                  chip === 'age' ? (
                    <InsightBars
                      max={100}
                      rows={ages.map((a) => ({ key: a.key, label: a.label, value: a.percent, display: pct(a.percent), custom: indicators && a.isCustom }))}
                      onRowLongPress={(bar) =>
                        openStat({
                          key: statKey('age', String(bar.key)),
                          title: bar.label,
                          subtitle: t('postInsights.infoAudience'),
                          value: bar.value,
                          isCustom: ages.find((a) => a.key === bar.key)?.isCustom ?? false,
                        })
                      }
                    />
                  ) : chip === 'country' ? (
                    <InsightBars
                      max={100}
                      rows={countries.map((c) => ({ key: c.key, label: c.label, value: c.percent, display: pct(c.percent), custom: indicators && c.isCustom }))}
                      onRowLongPress={(bar) =>
                        openStat({
                          key: statKey('country', String(bar.key)),
                          title: bar.label,
                          subtitle: t('postInsights.infoAudience'),
                          value: bar.value,
                          isCustom: countries.find((c) => c.key === bar.key)?.isCustom ?? false,
                        })
                      }
                    />
                  ) : (
                    // Gender is per post, not the account average: this post's own split.
                    <InsightBars
                      max={100}
                      rows={[
                        { key: 'men', label: t('insights.men'), value: splits.men, display: pct(splits.men), custom: indicators && splits.genderIsCustom },
                        { key: 'women', label: t('insights.women'), value: splits.women, display: pct(splits.women), custom: indicators && splits.genderIsCustom },
                      ]}
                      onRowLongPress={() => setAudienceOpen(true)}
                    />
                  )
                ) : (
                  <Text variant="body" color="secondary" style={{ padding: spacing.lg }}>
                    {t('insights.noData')}
                  </Text>
                )}
              </>
            ) : null}

            {indicators ? (
              <View style={[styles.notice, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <InfoIcon size={14} color={colors.textSecondary} />
                <Text variant="small" color="secondary" style={{ flex: 1, marginLeft: spacing.sm }}>
                  {detail.realInsight?.source === 'estimated' ? `${t('dashboard.estimatedNotice')} ` : ''}
                  {t('postInsights.longPressHint')}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}

      {/* ⋯ — the scenario tools for this post */}
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={t('postInsights.menuTitle')}>
        <ToggleRow
          title={t('sim.badgeLong')}
          value={simulation}
          onValueChange={(v) => {
            triggerHaptic(v ? 'medium' : 'light');
            actions.setEnabled(v);
          }}
        />
        <Divider inset={spacing.lg} />
        <ListRow
          title={t('boost.title')}
          subtitle={t('dashboard.boostSub')}
          onPress={() => {
            setMenuOpen(false);
            setTimeout(() => setBoostOpen(true), 250);
          }}
        />
        <Divider inset={spacing.lg} />
        <ListRow
          title={t('audienceMix.postTitle')}
          subtitle={t('audienceMix.menuSub')}
          onPress={() => {
            setMenuOpen(false);
            setTimeout(() => setAudienceOpen(true), 250);
          }}
        />
        <Divider inset={spacing.lg} />
        <ListRow
          title={t('media.simulate')}
          subtitle={t('sim.longPressHint')}
          onPress={() => {
            setMenuOpen(false);
            if (media) setTimeout(() => router.push(`/simulation/media/${media.id}`), 220);
          }}
        />
        <Divider inset={spacing.lg} />
        <ListRow title={t('postInsights.resetPost')} chevron={false} danger onPress={resetPost} />
      </BottomSheet>
      <EngagementBoostSheet visible={boostOpen} onClose={() => setBoostOpen(false)} />
      <AudienceMixSheet visible={audienceOpen} onClose={() => setAudienceOpen(false)} mediaId={mediaId} />
      <StatPercentSheet edit={statEdit} mediaId={mediaId} onClose={() => setStatEdit(null)} />

      {/* Boosting a post happens inside Instagram, so this only hands the user over. */}
      <BottomSheet visible={promoteOpen} onClose={() => setPromoteOpen(false)} title={isReel ? t('postInsights.promoteReel') : t('postInsights.promotePost')}>
        <View style={styles.info}>
          <Text variant="title">{t('dashboard.igOnlyTitle')}</Text>
          <Text variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
            {t('media.promoteBody')}
          </Text>
          <Button
            title={t('dashboard.openInstagram')}
            variant="secondary"
            onPress={() => {
              const url = media?.permalink || 'https://www.instagram.com/';
              setPromoteOpen(false);
              void Linking.openURL(url);
            }}
            style={{ marginTop: spacing.xl }}
          />
        </View>
      </BottomSheet>

      <BottomSheet visible={info !== null} onClose={() => setInfo(null)} title={t('insights.infoTitle')}>
        <View style={styles.info}>
          <Text variant="body" color="secondary">
            {info ? t(INFO_TEXT[info]) : ''}
          </Text>
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerPill: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.xs },
  headerAction: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  top: { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.md },
  counts: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', paddingHorizontal: spacing.lg, marginTop: spacing.xl + 4 },
  count: { alignItems: 'center', minWidth: 56 },
  countText: { marginTop: spacing.md, fontSize: 17 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { width: '47%', flexGrow: 1, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 96, justifyContent: 'space-between' },
  cardValue: { fontSize: 22, marginTop: spacing.sm },
  chart: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  sectionSub: { paddingHorizontal: spacing.lg, marginTop: -spacing.sm, marginBottom: spacing.sm },
  clip: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.lg },
  clipFrame: { borderRadius: radius.sm, overflow: 'hidden' },
  rows: { paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md + 2 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: spacing.lg, marginTop: spacing.xl, padding: spacing.sm + 2, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  info: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
