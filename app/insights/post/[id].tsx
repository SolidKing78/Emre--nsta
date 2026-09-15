import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { RetentionChart } from '@/components/analytics/RetentionChart';
import { ChipRow, InsightBars, SectionHeading, TopTabs } from '@/components/analytics/insights/primitives';
import { LineChart } from '@/components/charts/LineChart';
import { AppHeader } from '@/components/common/AppHeader';
import { BottomSheet } from '@/components/common/BottomSheet';
import { IconButton } from '@/components/common/IconButton';
import { Divider, ListRow, ToggleRow } from '@/components/common/Primitives';
import { Screen } from '@/components/common/Screen';
import { ErrorState } from '@/components/common/States';
import { StatCounter } from '@/components/common/StatCounter';
import { Text } from '@/components/common/Text';
import { BookmarkIcon, CommentIcon, HeartIcon, InfoIcon, RepostIcon, ShareIcon, TrendUpIcon } from '@/components/icons';
import { EngagementBoostSheet } from '@/components/simulation/EngagementBoostEditor';
import { useMetricEditor } from '@/components/simulation/SimulationMetricEditor';
import { radius, spacing, touch } from '@/constants/theme';
import { useAudience } from '@/features/instagram/hooks';
import { useMediaDetail } from '@/features/instagram/useMediaDetail';
import { useDisplayMetrics, useSimulationActions, useSimulationEnabled, useSimulationIndicators, type DisplayMetric } from '@/features/simulation/useSimulation';
import { triggerHaptic } from '@/hooks/useHaptics';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage, useT, type TranslationKey } from '@/i18n';
import { buildPostBreakdown, buildPostViewSeries, completePostMetrics } from '@/services/analytics/postInsights';
import type { AppMetric, MetricKey } from '@/types/app';
import { SIMULATABLE_MEDIA_METRICS } from '@/types/simulation';
import { formatPercent, formatWatchTime } from '@/utils/format';

type Tab = 'overview' | 'engagement' | 'audience';
type AudienceChip = 'age' | 'country' | 'gender';
type ViewerChip = 'all' | 'followers' | 'nonFollowers';
type InfoKey = 'summary' | 'sources' | 'viewsOverTime' | 'actions' | 'interactions' | 'viewers' | 'audience';

const AGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const INFO_TEXT: Record<InfoKey, TranslationKey> = {
  summary: 'postInsights.infoSummary',
  sources: 'postInsights.infoSources',
  viewsOverTime: 'postInsights.infoViewsOverTime',
  actions: 'postInsights.infoActions',
  interactions: 'postInsights.infoInteractions',
  viewers: 'postInsights.infoViewers',
  audience: 'postInsights.infoAudience',
};

/**
 * Instagram "Gönderi istatistikleri" / "Reels videosu istatistikleri": thumbnail,
 * the five action counts, then Genel Bakış / Etkileşim / Hedef Kitle. Every number
 * is a scenario display value (dials + growth rate + explicit edits): long-press any
 * of them to edit. The header carries only Instagram's 📈 (account insights); a
 * long-press on it opens the scenario tools, so the screen itself stays 1:1.
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

  const detail = useMediaDetail(id);
  const audienceQuery = useAudience();
  const media = detail.media;
  const realMedia = detail.realMedia;
  const isReel = media?.type === 'REEL' || media?.type === 'VIDEO';

  // Source metrics + deterministic fill-ins (+ the daily view series) → scenario overlay.
  const breakdown = useMemo(() => (realMedia ? buildPostBreakdown(realMedia, audienceQuery.data) : null), [realMedia, audienceQuery.data]);
  const baseMetrics = useMemo<AppMetric[]>(() => {
    if (!realMedia) return [];
    return completePostMetrics(realMedia, detail.realInsight).map((m) => (m.key === 'views' ? { ...m, series: buildPostViewSeries(realMedia, m.value) } : m));
  }, [realMedia, detail.realInsight]);
  const metrics = useDisplayMetrics(detail.scope, baseMetrics);
  const byKey = (key: MetricKey): DisplayMetric | undefined => metrics.find((m) => m.key === key);
  const audience = audienceQuery.data ?? null;

  const viewSeries = useMemo(() => {
    const series = byKey('views')?.series ?? [];
    const share = viewerChip === 'all' ? 1 : viewerChip === 'followers' ? (breakdown?.followerShare ?? 100) / 100 : (breakdown?.nonFollowerShare ?? 0) / 100;
    return series.map((p) => ({ date: p.date, value: Math.round(p.value * share) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, viewerChip, breakdown]);

  const openEditor = (key: MetricKey) => {
    const m = byKey(key);
    if (m) editor.open({ scope: detail.scope, metric: key, realValue: m.realValue, subtitle: media?.caption.split('\n')[0] });
  };
  const pressProps = (key: MetricKey) => ({
    onLongPress: () => openEditor(key),
    delayLongPress: touch.longPressMs,
  });

  const pct = (value: number) => formatPercent(value, language, 1).replace('+', '');
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

  // Same four cards for posts and reels (Instagram Android): watch time lives in the Etkileşim tab.
  const summaryCards: { key: MetricKey; label: TranslationKey }[] = [
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

  const ages = audience ? [...audience.ages].sort((a, b) => AGE_ORDER.indexOf(a.label) - AGE_ORDER.indexOf(b.label)) : [];

  return (
    <Screen>
      <AppHeader
        title={title}
        showBack
        right={
          <IconButton accessibilityLabel={t('insights.title')} onPress={() => router.push('/insights')} onLongPress={() => setMenuOpen(true)}>
            <TrendUpIcon size={28} color={colors.text} strokeWidth={1.7} />
          </IconButton>
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
                        <Text variant="body" color="secondary" numberOfLines={1}>
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

                {isReel ? (
                  <>
                    <SectionHeading title={t('postInsights.viewsOverTime')} onInfo={() => setInfo('viewsOverTime')} />
                    <ChipRow<ViewerChip>
                      value={viewerChip}
                      onChange={setViewerChip}
                      options={[
                        { value: 'all', label: t('postInsights.chipAll') },
                        { value: 'followers', label: t('postInsights.chipFollowers') },
                        { value: 'nonFollowers', label: t('postInsights.chipNonFollowers') },
                      ]}
                    />
                    <View style={styles.chart}>
                      {viewSeries.length > 1 ? (
                        <LineChart data={viewSeries} height={200} />
                      ) : (
                        <Text variant="body" color="secondary">
                          {t('insights.noData')}
                        </Text>
                      )}
                    </View>
                  </>
                ) : breakdown ? (
                  <>
                    <SectionHeading title={t('postInsights.sources')} onInfo={() => setInfo('sources')} />
                    <InsightBars max={100} rows={breakdown.sources.map((s) => ({ label: t(`postInsights.source.${s.key}`), value: s.share, display: pct(s.share) }))} />
                  </>
                ) : null}
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
                {isReel ? (
                  <>
                    <SectionHeading title={t('feed.reel')} />
                    <View style={styles.rows}>
                      {row('views', t('postInsights.views'))}
                      {row('avg_watch_time', t('postInsights.avgWatchTime'))}
                      {row('replays', t('metric.replays'))}
                    </View>
                    {detail.realInsight?.retention ? (
                      <View style={styles.retention}>
                        <RetentionChart retention={detail.realInsight.retention} />
                      </View>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}

            {tab === 'audience' && breakdown ? (
              <>
                <SectionHeading title={isReel ? t('postInsights.reelViewersTitle') : t('postInsights.viewers')} onInfo={() => setInfo('viewers')} />
                <InsightBars max={100} rows={[{ label: t('postInsights.followersBar'), value: breakdown.followerShare, display: pct(breakdown.followerShare) }]} />
                <InsightBars max={100} colorA={colors.simulation} rows={[{ label: t('postInsights.nonFollowersBar'), value: breakdown.nonFollowerShare, display: pct(breakdown.nonFollowerShare) }]} />

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
                    <InsightBars max={100} rows={ages.map((a) => ({ label: a.label, value: a.value, display: pct(a.value) }))} />
                  ) : chip === 'country' ? (
                    <InsightBars max={100} rows={audience.countries.map((c) => ({ label: c.label, value: c.value, display: pct(c.value) }))} />
                  ) : (
                    <InsightBars
                      max={100}
                      rows={[
                        { label: t('insights.women'), value: audience.gender.women, display: pct(audience.gender.women) },
                        { label: t('insights.men'), value: audience.gender.men, display: pct(audience.gender.men) },
                      ]}
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
                  {t('postInsights.longPressHint')} {t('postInsights.menuHint')}
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
  top: { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.md },
  counts: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', paddingHorizontal: spacing.lg, marginTop: spacing.xl + 4 },
  count: { alignItems: 'center', minWidth: 56 },
  countText: { marginTop: spacing.md, fontSize: 17 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { width: '47%', flexGrow: 1, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, minHeight: 96, justifyContent: 'space-between' },
  cardValue: { fontSize: 26, marginTop: spacing.sm },
  chart: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  rows: { paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md + 2 },
  retention: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  notice: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: spacing.lg, marginTop: spacing.xl, padding: spacing.sm + 2, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  info: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
